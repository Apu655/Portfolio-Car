import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { carRefs } from '../carRef';
import { POND } from '../district/layout';
import { on, telemetry, type Vec3 } from '../events';
import { lightingState } from '../lighting/state';
import { reflectionStale } from './waterReflection';

const RIPPLES = 16;
const RIPPLE_LIFE = 2.4;
const PARTICLES = 320;
const TRACKS = 160;
const TRACK_LIFE = 4;
const TRACK_SPACING = 0.45;
const SURFACE_Y = -0.04;
/** Height of a track print above the tire's contact point, so it never sinks into the surface. */
const TRACK_LIFT = 0.015;

const waterVertex = /* glsl */ `
  varying vec2 vLocal;
  varying vec3 vWorld;
  void main() {
    vLocal = position.xy;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const waterFragment = /* glsl */ `
  uniform float uTime;
  uniform float uNight;
  uniform vec4 uRipples[${RIPPLES}];
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uSky;
  uniform samplerCube uReflect;
  uniform float uHasReflect;
  varying vec2 vLocal;
  varying vec3 vWorld;

  void main() {
    float n = length(vLocal);                 // 0 center, 1 shoreline (geometry is a unit circle scaled to the ellipse)
    float depth = smoothstep(1.0, 0.55, n);
    vec3 color = mix(uShallow, uDeep, depth);

    // Gentle ambient waves plus the ring buffer of ripples from splashes.
    float wave = sin(vWorld.x * 1.3 + uTime * 1.1) * sin(vWorld.z * 1.7 - uTime * 0.9) * 0.5;
    float rings = 0.0;
    for (int i = 0; i < ${RIPPLES}; i++) {
      vec4 r = uRipples[i];
      float age = uTime - r.z;
      if (r.w <= 0.0 || age < 0.0 || age > ${RIPPLE_LIFE.toFixed(1)}) continue;
      float d = distance(vWorld.xz, r.xy);
      float front = age * 2.6;
      float band = exp(-pow((d - front) * 3.0, 2.0));
      rings += band * sin((d - front) * 14.0) * r.w * (1.0 - age / ${RIPPLE_LIFE.toFixed(1)});
    }
    float sparkle = wave * 0.06 + rings * 0.5;

    vec3 view = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(view.y, 0.0), 3.0);
    color *= mix(1.0, 0.32, uNight);
    // The surroundings mirrored in the surface, wobbled by the waves and ripples (a snapshot, KTD7).
    vec3 normal = normalize(vec3(wave * 0.05 + rings * 0.12, 1.0, wave * 0.04 - rings * 0.1));
    // Water darkens what it mirrors, so the reflection is tinted and dimmed rather than a bright copy of the sky.
    vec3 reflected = mix(uSky * mix(1.0, 0.25, uNight), textureCube(uReflect, reflect(-view, normal)).rgb, uHasReflect) * vec3(0.5, 0.58, 0.62);
    color = mix(color, reflected, 0.3 + fresnel * 0.55);
    color += vec3(1.0, 0.95, 0.85) * max(sparkle, 0.0) * mix(1.0, 0.35, uNight);

    // Foam at the shore: a broken band that breathes with the waves.
    float shore = smoothstep(0.88, 1.0, n);
    float broken = 0.55 + 0.45 * sin(uTime * 1.6 + vWorld.x * 2.0 + vWorld.z * 1.3);
    float foam = shore * broken * (0.7 + 0.3 * sin(vWorld.z * 5.0 + uTime));
    color = mix(color, vec3(0.92, 0.95, 0.93) * mix(1.0, 0.4, uNight), foam * 0.55);
    float alpha = mix(0.6, 0.88, depth);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

interface Particle {
  life: number;
  max: number;
  p: THREE.Vector3;
  v: THREE.Vector3;
}

/** The pond: an animated surface with ripples, pooled splash droplets, and wet tire tracks after leaving the water. */
export function Water() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uNight: { value: 0 },
      uRipples: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0)) },
      uShallow: { value: new THREE.Color('#3f9e96') },
      uDeep: { value: new THREE.Color('#0f4a63') },
      uSky: { value: new THREE.Color('#bfe0ef') },
      uReflect: { value: null as THREE.Texture | null },
      uHasReflect: { value: 0 },
    }),
    [],
  );

  // Built here rather than as a <shaderMaterial> element: the element copies scalar uniform values into its own
  // uniforms, so the time, night level and reflection written below would never reach the surface.
  const surfaceMaterial = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: waterVertex, fragmentShader: waterFragment, uniforms, transparent: true, depthWrite: false }),
    [uniforms],
  );
  useEffect(() => () => surfaceMaterial.dispose(), [surfaceMaterial]);

  // The reflection snapshot: a small cube camera at the pond's centre, just above the surface.
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const surface = useRef<THREE.Mesh>(null);
  const reflection = useMemo(() => {
    const target = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
    const camera = new THREE.CubeCamera(0.5, 400, target);
    camera.position.set(POND.center[0], 0.6, POND.center[1]);
    return { target, camera, hour: Number.NaN, wait: 2 };
  }, []);
  useEffect(() => () => reflection.target.dispose(), [reflection]);
  const nextRipple = useRef(0);
  const time = useRef(0);

  const particles = useMemo<Particle[]>(
    () => Array.from({ length: PARTICLES }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3() })),
    [],
  );
  const nextParticle = useRef(0);
  const dropsActive = useRef(false);
  const dropGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLES * 3), 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(PARTICLES), 1));
    return g;
  }, []);
  const dropMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uNight: uniforms.uNight },
        vertexShader: /* glsl */ `
          attribute float alpha;
          varying float vAlpha;
          void main() {
            vAlpha = alpha;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = clamp(4.5 * (30.0 / -mv.z), 1.5, 14.0);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uNight;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5 || vAlpha <= 0.0) discard;
            vec3 c = mix(vec3(0.9, 0.97, 1.0), vec3(0.4, 0.5, 0.6), uNight);
            gl_FragColor = vec4(c, vAlpha * smoothstep(0.5, 0.2, d));
          }
        `,
      }),
    [uniforms],
  );

  const tracks = useRef<THREE.InstancedMesh>(null);
  // Wet prints darken the surface and catch the sky like a thin film of water (R14): a glossy dark material
  // whose opacity follows each print's wetness, carried in its instance colour.
  const trackMaterial = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#15171b', roughness: 0.12, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n#ifdef USE_INSTANCING_COLOR\n  diffuseColor.a = vColor.r * 0.75;\n  diffuseColor.rgb = vec3(0.08, 0.085, 0.1);\n#endif',
      );
    };
    return m;
  }, []);
  const trackAge = useMemo(() => new Float32Array(TRACKS).fill(TRACK_LIFE), []);
  const nextTrack = useRef(0);
  const tracksActive = useRef(false);
  const lastTrack = useRef(new THREE.Vector3(1e9, 0, 0));
  const scratch = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), flat: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(), p: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1), c: new THREE.Color() }),
    [],
  );

  const ripple = (x: number, z: number, intensity: number) => {
    uniforms.uRipples.value[nextRipple.current].set(x, z, time.current, Math.min(1, 0.25 + intensity));
    nextRipple.current = (nextRipple.current + 1) % RIPPLES;
  };

  const burst = (position: Vec3, intensity: number) => {
    const count = Math.round(10 + intensity * 40);
    const v = carRefs.body?.linvel();
    for (let i = 0; i < count; i++) {
      const pt = particles[nextParticle.current];
      nextParticle.current = (nextParticle.current + 1) % PARTICLES;
      const angle = Math.random() * Math.PI * 2;
      const spread = 1 + Math.random() * 2.5 * intensity;
      pt.p.set(position[0] + Math.cos(angle) * 0.6, SURFACE_Y + 0.05, position[2] + Math.sin(angle) * 0.6);
      pt.v.set(Math.cos(angle) * spread + (v?.x ?? 0) * 0.3, 2 + Math.random() * 3.5 * intensity, Math.sin(angle) * spread + (v?.z ?? 0) * 0.3);
      pt.max = pt.life = 0.6 + Math.random() * 0.5;
    }
    dropsActive.current = true;
  };

  useEffect(() => {
    const offSplash = on('splash', (e) => {
      ripple(e.position[0], e.position[2], e.intensity);
      burst(e.position, e.intensity);
    });
    const offEnter = on('waterEnter', (e) => {
      const p = telemetry.position;
      const intensity = Math.min(1, e.speed / 11);
      ripple(p[0], p[2], intensity);
      burst(p, Math.max(0.4, intensity));
    });
    return () => {
      offSplash();
      offEnter();
    };
    // ripple and burst only touch refs and stable memoized objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, dt) => {
    time.current += dt;
    uniforms.uTime.value = time.current;
    uniforms.uNight.value = lightingState.night;

    // Take the snapshot once the city has had a moment to load, then again whenever the light moves on.
    reflection.wait -= dt;
    if (reflection.wait <= 0 && reflectionStale(reflection.hour, lightingState.hours) && surface.current) {
      surface.current.visible = false;
      reflection.camera.update(gl, scene);
      surface.current.visible = true;
      uniforms.uReflect.value = reflection.target.texture;
      uniforms.uHasReflect.value = 1;
      reflection.hour = lightingState.hours;
    }

    // Droplets: simple ballistic flight, fading out as they fall back. Idle pools cost nothing.
    if (dropsActive.current) {
      const pos = dropGeometry.attributes.position as THREE.BufferAttribute;
      const alpha = dropGeometry.attributes.alpha as THREE.BufferAttribute;
      let alive = 0;
      for (let i = 0; i < PARTICLES; i++) {
        const pt = particles[i];
        if (pt.life > 0) {
          pt.life -= dt;
          pt.v.y -= 9.81 * dt;
          pt.p.addScaledVector(pt.v, dt);
          if (pt.p.y < SURFACE_Y) pt.life = 0;
          if (pt.life > 0) alive++;
        }
        pos.setXYZ(i, pt.p.x, pt.p.y, pt.p.z);
        alpha.setX(i, pt.life > 0 ? Math.min(1, pt.life / pt.max + 0.2) * 0.85 : 0);
      }
      pos.needsUpdate = true;
      alpha.needsUpdate = true;
      dropsActive.current = alive > 0; // this frame uploaded the all-faded state; stop until the next splash
    }

    // Wet tracks: dark tire prints under the rear tires for a few seconds after leaving the pond, laid on
    // whatever surface the tires touch (grass, road, curb, plaza).
    const mesh = tracks.current;
    const body = carRefs.body;
    if (!mesh) return;
    if (body && telemetry.wet > 0 && !telemetry.inWater) {
      const t = body.translation();
      scratch.p.set(t.x, 0, t.z);
      if (scratch.p.distanceTo(lastTrack.current) > TRACK_SPACING) {
        lastTrack.current.copy(scratch.p);
        const r = body.rotation();
        scratch.q.set(r.x, r.y, r.z, r.w);
        const heading = scratch.e.setFromQuaternion(scratch.q, 'YXZ').y;
        scratch.flat.setFromEuler(scratch.e.set(-Math.PI / 2, heading, 0, 'YXZ'));
        let laid = false;
        for (const contact of telemetry.rearContacts) {
          if (!contact) continue;
          const i = nextTrack.current;
          nextTrack.current = (nextTrack.current + 1) % TRACKS;
          trackAge[i] = TRACK_LIFE - telemetry.wet; // older the drier the tires are
          scratch.s.set(contact[0], contact[1] + TRACK_LIFT, contact[2]);
          scratch.m.compose(scratch.s, scratch.flat, scratch.one);
          mesh.setMatrixAt(i, scratch.m);
          laid = true;
        }
        if (laid) {
          mesh.instanceMatrix.needsUpdate = true;
          tracksActive.current = true;
        }
      }
    }
    if (!tracksActive.current) return;
    let visible = false;
    for (let i = 0; i < TRACKS; i++) {
      if (trackAge[i] >= TRACK_LIFE) continue;
      trackAge[i] = Math.min(TRACK_LIFE, trackAge[i] + dt);
      const fade = 1 - trackAge[i] / TRACK_LIFE;
      visible = true;
      // Wetness: the print's opacity, so fresher prints are darker and glossier.
      mesh.setColorAt(i, scratch.c.setRGB(fade, fade, fade));
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.visible = visible;
    tracksActive.current = visible;
  });

  return (
    <group>
      <mesh ref={surface} position={[POND.center[0], SURFACE_Y, POND.center[1]]} rotation={[-Math.PI / 2, 0, 0]} scale={[POND.radiusX, POND.radiusZ, 1]} renderOrder={1}>
        <circleGeometry args={[1, 96]} />
        <primitive object={surfaceMaterial} attach="material" />
      </mesh>
      <points geometry={dropGeometry} material={dropMaterial} frustumCulled={false} />
      <instancedMesh ref={tracks} args={[undefined, undefined, TRACKS]} frustumCulled={false} renderOrder={2} visible={false}>
        <planeGeometry args={[0.32, 0.5]} />
        <primitive object={trackMaterial} attach="material" />
      </instancedMesh>
    </group>
  );
}
