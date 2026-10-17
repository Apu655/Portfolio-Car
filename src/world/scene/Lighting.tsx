import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { lightingAt, localHours, type Lighting as LightingState, type RGB } from '../lighting/timeOfDay';

/** How often the time of day is re-sampled. Changes per sample are tiny, so nothing visibly jumps. */
const SAMPLE_SECONDS = 2;
/** Shadow map area: covers the whole drivable city once, re-rendered only when the sun moves. */
const SHADOW_HALF = 300;

/** `?time=21:30` previews another time of day (handy for checking the night look). */
function previewHours(search: string): number | null {
  const match = /[?&]time=(\d{1,2})(?::(\d{2}))?/.exec(search);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  return hours < 24 && minutes < 60 ? hours + minutes / 60 : null;
}

const srgb = (c: RGB, out: THREE.Color) => out.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);

const skyVertex = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = clip.xyww; // always at the far plane
}`;

const skyFragment = /* glsl */ `
uniform vec3 top;
uniform vec3 horizon;
uniform vec3 sunColor;
uniform vec3 sunDirection;
uniform float night;
varying vec3 vDirection;
void main() {
  vec3 d = normalize(vDirection);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 color = mix(horizon, top, pow(h, 0.5));
  color = mix(color, horizon * 0.55, clamp(-d.y * 3.0, 0.0, 1.0));
  float s = max(dot(d, normalize(sunDirection)), 0.0);
  float disc = pow(s, mix(900.0, 2500.0, night)) * mix(6.0, 1.5, night);
  float halo = pow(s, 10.0) * mix(0.35, 0.05, night);
  color += sunColor * (disc + halo);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

/** Collect materials whose glow or opacity follows the time of day (see `byNight` in models/materials). */
function applyNight(scene: THREE.Scene, night: number): void {
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of materials) {
      const emissive = m.userData.emissiveByNight as [number, number] | undefined;
      if (emissive) (m as THREE.MeshStandardMaterial).emissiveIntensity = emissive[0] + (emissive[1] - emissive[0]) * night;
      const opacity = m.userData.opacityByNight as [number, number] | undefined;
      if (opacity) m.opacity = opacity[0] + (opacity[1] - opacity[0]) * night;
    }
  });
}

/** Sky, sun, ambient light, fog, and reflections — all following the visitor's local clock. */
export function CityLighting({ shadows }: { shadows: boolean }) {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemisphere = useRef<THREE.HemisphereLight>(null);
  const sky = useRef<THREE.Mesh>(null);
  const preview = useMemo(() => previewHours(window.location.search), []);
  const uniforms = useMemo(
    () => ({
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      sunDirection: { value: new THREE.Vector3(0, 1, 0) },
      night: { value: 0 },
    }),
    [],
  );
  const timer = useRef(SAMPLE_SECONDS);
  const shadowRefreshes = useRef(0);
  const lastSun = useRef(new THREE.Vector3());

  useEffect(() => {
    scene.fog = new THREE.Fog('#c4d6ea', 160, 760);
    gl.shadowMap.autoUpdate = false;
    return () => {
      scene.fog = null;
    };
  }, [scene, gl]);

  const apply = (l: LightingState) => {
    const color = new THREE.Color();
    srgb(l.skyTop, uniforms.top.value);
    srgb(l.skyHorizon, uniforms.horizon.value);
    srgb(l.sunColor, uniforms.sunColor.value);
    uniforms.sunDirection.value.set(...l.sunDirection);
    uniforms.night.value = l.night;
    (scene.fog as THREE.Fog).color.copy(srgb(l.fogColor, color));
    scene.environmentIntensity = l.environmentIntensity;
    gl.toneMappingExposure = l.exposure;
    if (hemisphere.current) {
      srgb(l.hemisphereSky, hemisphere.current.color);
      srgb(l.hemisphereGround, hemisphere.current.groundColor);
      hemisphere.current.intensity = l.hemisphereIntensity;
    }
    if (sun.current) {
      srgb(l.sunColor, sun.current.color);
      sun.current.intensity = l.sunIntensity;
      sun.current.position.set(l.sunDirection[0] * 400, l.sunDirection[1] * 400, l.sunDirection[2] * 400);
      if (lastSun.current.distanceToSquared(sun.current.position) > 4) {
        lastSun.current.copy(sun.current.position);
        gl.shadowMap.needsUpdate = true;
      }
    }
    applyNight(scene, l.night);
  };

  useFrame((_, dt) => {
    sky.current?.position.copy(camera.position);
    timer.current += dt;
    // Re-render shadows a few times right after mounting, while the city's meshes finish appearing.
    if (shadowRefreshes.current < 6 && timer.current > 0.5) {
      shadowRefreshes.current++;
      gl.shadowMap.needsUpdate = true;
    }
    if (timer.current < SAMPLE_SECONDS) return;
    timer.current = 0;
    apply(lightingAt(preview ?? localHours(new Date())));
  });

  return (
    <>
      <mesh ref={sky} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[3000, 32, 16]} />
        <shaderMaterial uniforms={uniforms} vertexShader={skyVertex} fragmentShader={skyFragment} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      <hemisphereLight ref={hemisphere} args={['#bcd6ff', '#6a5c48', 0.9]} />
      <directionalLight
        ref={sun}
        castShadow={shadows}
        intensity={3}
        position={[200, 300, 150]}
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
        shadow-camera-left={-SHADOW_HALF}
        shadow-camera-right={SHADOW_HALF}
        shadow-camera-top={SHADOW_HALF}
        shadow-camera-bottom={-SHADOW_HALF}
        shadow-camera-near={10}
        shadow-camera-far={900}
      />
      {/* Reflections for glass and car paint, rendered once from simple light panels — no downloads. */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#dbe8ff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[40, 40, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#ffe2c0" position={[0, 2, -20]} scale={[40, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#bcd2ff" position={[-20, 3, 0]} rotation-y={Math.PI / 2} scale={[40, 4, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#bcd2ff" position={[20, 3, 0]} rotation-y={-Math.PI / 2} scale={[40, 4, 1]} />
      </Environment>
    </>
  );
}
