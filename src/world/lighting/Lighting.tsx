import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { carRefs } from '../carRef';
import { dayClock } from './clock';
import { lightingState } from './state';
import { lightingAt, type RGB } from './timeOfDay';

/** Materials (by name, or name prefix ending in `_`) whose glow follows the night: [day, night] emissive intensity. */
export const NIGHT_GLOW: Array<[string, number, number]> = [
  ['tower_window_lit', 0.0, 1.7],
  ['building_window_lit', 0.0, 1.4],
  ['street_lamp', 0.05, 5],
  ['tower_crown_glow', 0.1, 1.6],
  ['kiosk_glow_', 0.5, 2.4],
  ['gate_lantern', 0.2, 4],
];

const SHADOW_HALF = 60;

const srgb = (c: RGB, out: THREE.Color) => out.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);

const skyVertex = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = clip.xyww;
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
  color = mix(color, horizon * 0.6, clamp(-d.y * 3.0, 0.0, 1.0));
  float s = max(dot(d, normalize(sunDirection)), 0.0);
  color += sunColor * (pow(s, mix(900.0, 2600.0, night)) * mix(6.0, 1.4, night) + pow(s, 10.0) * mix(0.35, 0.05, night));
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

function nightRange(name: string): [number, number] | null {
  for (const [match, day, night] of NIGHT_GLOW) {
    if (match.endsWith('_') ? name.startsWith(match) : name === match) return [day, night];
  }
  return null;
}

/** Sky, sun, ambient light, fog, reflections, and night glow — all driven by the in-world day clock. */
export function Lighting({ shadows, shadowMapSize }: { shadows: boolean; shadowMapSize: number }) {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemisphere = useRef<THREE.HemisphereLight>(null);
  const sky = useRef<THREE.Mesh>(null);
  const glowing = useRef<Array<{ material: THREE.MeshStandardMaterial; range: [number, number] }>>([]);
  const sinceScan = useRef(99);
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
  const scratch = useMemo(() => ({ color: new THREE.Color(), focus: new THREE.Vector3() }), []);

  useEffect(() => {
    scene.fog = new THREE.Fog('#c4d6ea', 90, 420);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame((_, dt) => {
    const hours = dayClock.hours(performance.now());
    const l = lightingAt(hours);
    lightingState.night = l.night;
    lightingState.hours = hours;

    srgb(l.skyTop, uniforms.top.value);
    srgb(l.skyHorizon, uniforms.horizon.value);
    srgb(l.sunColor, uniforms.sunColor.value);
    uniforms.sunDirection.value.set(...l.sunDirection);
    uniforms.night.value = l.night;
    sky.current?.position.copy(camera.position);
    (scene.fog as THREE.Fog).color.copy(srgb(l.fogColor, scratch.color));
    scene.environmentIntensity = l.environmentIntensity;
    gl.toneMappingExposure = l.exposure;
    if (hemisphere.current) {
      srgb(l.hemisphereSky, hemisphere.current.color);
      srgb(l.hemisphereGround, hemisphere.current.groundColor);
      hemisphere.current.intensity = l.hemisphereIntensity;
    }
    const light = sun.current;
    if (light) {
      // The shadow camera follows the car, so nearby props, trees, and the car itself cast crisp shadows.
      carRefs.visual?.getWorldPosition(scratch.focus);
      scratch.focus.set(Math.round(scratch.focus.x), 0, Math.round(scratch.focus.z));
      srgb(l.sunColor, light.color);
      light.intensity = l.sunIntensity;
      light.position.set(scratch.focus.x + l.sunDirection[0] * 150, l.sunDirection[1] * 150, scratch.focus.z + l.sunDirection[2] * 150);
      light.target.position.copy(scratch.focus);
      light.target.updateMatrixWorld();
    }

    // Night glow: rescan materials now and then (models stream in), update intensities every frame.
    sinceScan.current += dt;
    if (sinceScan.current > 2) {
      sinceScan.current = 0;
      const found = new Map<THREE.Material, [number, number]>();
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        const range = m?.name ? nightRange(m.name) : null;
        if (m && range) found.set(m, range);
      });
      glowing.current = [...found].map(([material, range]) => ({ material: material as THREE.MeshStandardMaterial, range }));
    }
    for (const { material, range } of glowing.current) material.emissiveIntensity = range[0] + (range[1] - range[0]) * l.night;
  });

  return (
    <>
      <mesh ref={sky} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[1500, 32, 16]} />
        <shaderMaterial uniforms={uniforms} vertexShader={skyVertex} fragmentShader={skyFragment} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      <hemisphereLight ref={hemisphere} args={['#bcd6ff', '#6a5c48', 0.9]} />
      <directionalLight
        ref={sun}
        castShadow={shadows}
        intensity={3}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-SHADOW_HALF}
        shadow-camera-right={SHADOW_HALF}
        shadow-camera-top={SHADOW_HALF}
        shadow-camera-bottom={-SHADOW_HALF}
        shadow-camera-near={1}
        shadow-camera-far={400}
      />
      {/* Soft studio panels rendered once for reflections on glass, paint, and brass — no downloads. */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#dbe8ff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[40, 40, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#ffe2c0" position={[0, 2, -20]} scale={[40, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#bcd2ff" position={[-20, 3, 0]} rotation-y={Math.PI / 2} scale={[40, 4, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#bcd2ff" position={[20, 3, 0]} rotation-y={-Math.PI / 2} scale={[40, 4, 1]} />
      </Environment>
    </>
  );
}
