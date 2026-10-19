import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { carRefs } from '../carRef';
import { dayClock } from './clock';
import { lightingState } from './state';
import { environmentStale, lightingAt, type RGB } from './timeOfDay';

/** Materials (by name, or name prefix ending in `_`) whose glow follows the night: [day, night] emissive intensity. */
export const NIGHT_GLOW: Array<[string, number, number]> = [
  ['tower_window_lit', 0.0, 1.7],
  ['building_window_lit', 0.0, 1.4],
  ['street_lamp', 0.05, 5],
  ['tower_crown_glow', 0.1, 1.6],
  ['kiosk_glow_', 0.5, 2.4],
  ['gate_lantern', 0.2, 4],
  ['roadside_lamp', 0.3, 3],
  ['robot_eye', 1, 2.5],
  ['robot_screen', 0.8, 2],
  ['hall_window_lit', 0.05, 1.6],
  ['campus_window_lit', 0.05, 1.5],
  ['neon_', 0.3, 2.6],
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
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec3 d = normalize(vDirection);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 color = mix(horizon, top, pow(h, 0.55));
  color = mix(color, horizon * 0.6, clamp(-d.y * 3.0, 0.0, 1.0));
  float s = max(dot(d, normalize(sunDirection)), 0.0);
  color += sunColor * (pow(s, mix(900.0, 2600.0, night)) * mix(6.0, 1.4, night) + pow(s, 8.0) * mix(0.35, 0.05, night));
  // Stars come out with the night, thinning toward the horizon.
  vec2 cell = floor(vec2(atan(d.z, d.x), d.y) * 260.0);
  color += vec3(0.9, 0.95, 1.0) * step(0.9975, hash(cell)) * night * smoothstep(0.08, 0.35, d.y) * 1.4;
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

function nightRange(name: string): [number, number] | null {
  for (const [match, day, night] of NIGHT_GLOW) {
    if (match.endsWith('_') ? name.startsWith(match) : name === match) return [day, night];
  }
  return null;
}

/** Sky, sun and moon, ambient light, fog, reflections, and night glow — all driven by the in-world day clock. */
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

  // Reflections come from the time-of-day sky itself (KTD8): a small scene holding the same sky, captured into
  // an environment map and refreshed when the hour moves on, so glass and paint reflect the hour.
  const reflections = useMemo(() => {
    const envScene = new THREE.Scene();
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthWrite: false });
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), material));
    return { envScene, pmrem: new THREE.PMREMGenerator(gl), target: null as THREE.WebGLRenderTarget | null, hour: Number.NaN };
  }, [gl, uniforms]);

  useEffect(() => {
    scene.fog = new THREE.FogExp2('#c4d6ea', 0.0024);
    return () => {
      scene.fog = null;
      scene.environment = null;
      reflections.target?.dispose();
      reflections.pmrem.dispose();
    };
  }, [scene, reflections]);

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
    const fog = scene.fog as THREE.FogExp2;
    fog.color.copy(srgb(l.fogColor, scratch.color));
    fog.density = l.fogDensity;
    // Exposure is folded into the light levels, so it reads the same whichever pass does the tone mapping.
    scene.environmentIntensity = l.environmentIntensity * l.exposure;
    gl.toneMappingExposure = 1;
    if (hemisphere.current) {
      srgb(l.hemisphereSky, hemisphere.current.color);
      srgb(l.hemisphereGround, hemisphere.current.groundColor);
      hemisphere.current.intensity = l.hemisphereIntensity * l.exposure;
    }
    if (Number.isNaN(reflections.hour) || environmentStale(reflections.hour, hours)) {
      reflections.target?.dispose();
      reflections.target = reflections.pmrem.fromScene(reflections.envScene, 0, 0.1, 100);
      scene.environment = reflections.target.texture;
      reflections.hour = hours;
    }
    const light = sun.current;
    if (light) {
      // The shadow camera follows the car, so nearby props, trees, and the car itself cast crisp shadows.
      carRefs.visual?.getWorldPosition(scratch.focus);
      scratch.focus.set(Math.round(scratch.focus.x), 0, Math.round(scratch.focus.z));
      srgb(l.sunColor, light.color);
      light.intensity = l.sunIntensity * l.exposure;
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
    </>
  );
}
