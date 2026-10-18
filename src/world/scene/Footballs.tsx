import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BallCollider, RigidBody, useRapier, type ContactForcePayload, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { profile } from '../../content/portfolio';
import { FOOTBALLS, PITCH } from '../district/layout';
import { emit } from '../events';
import { FOOTBALL, impactIntensity, impactThreshold, MIN_IMPACT, shouldReset } from '../physics/props';

/** Brand-ish colours and short badges for the tech on each ball. */
const TECH_STYLE: Record<string, { badge: string; fill: string; ink: string }> = {
  Python: { badge: 'Python', fill: '#3776ab', ink: '#ffd43b' },
  JavaScript: { badge: 'JS', fill: '#f7df1e', ink: '#222222' },
  TypeScript: { badge: 'TS', fill: '#3178c6', ink: '#ffffff' },
  Java: { badge: 'Java', fill: '#e76f00', ink: '#ffffff' },
  SQL: { badge: 'SQL', fill: '#00758f', ink: '#ffffff' },
  React: { badge: 'React', fill: '#20232a', ink: '#61dafb' },
  FastAPI: { badge: 'FastAPI', fill: '#009688', ink: '#ffffff' },
  TensorFlow: { badge: 'TF', fill: '#ff6f00', ink: '#ffffff' },
};

/** A classic panelled football with the tech's badge on two opposite sides (equirectangular texture). */
function ballTexture(tech: string): THREE.CanvasTexture {
  const style = TECH_STYLE[tech] ?? { badge: tech, fill: '#444444', ink: '#ffffff' };
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f6f4ee';
  ctx.fillRect(0, 0, 512, 256);
  // Dark pentagon patches scattered around the ball.
  ctx.fillStyle = '#25272c';
  for (const [u, v, r] of [[0, 128, 34], [128, 60, 30], [128, 196, 30], [256, 128, 34], [384, 60, 30], [384, 196, 30], [512, 128, 34], [64, 128, 18], [320, 128, 18]] as const) {
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      ctx[k ? 'lineTo' : 'moveTo'](u + Math.cos(a) * r, v + Math.sin(a) * r * 0.8);
    }
    ctx.closePath();
    ctx.fill();
  }
  // The tech badge, twice, on opposite sides.
  for (const u of [192, 448]) {
    ctx.beginPath();
    ctx.roundRect(u - 62, 98, 124, 60, 16);
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.fillStyle = style.ink;
    ctx.font = `800 ${style.badge.length > 4 ? 26 : 36}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.badge, u, 129);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Mown stripes, white lines, a centre circle, and penalty boxes, painted once. */
function pitchTexture(): THREE.CanvasTexture {
  const [w, h] = [960, 560];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#5f9447' : '#6aa150';
    ctx.fillRect((i * w) / 12, 0, w / 12, h);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.beginPath();
  ctx.moveTo(w / 2, 12);
  ctx.lineTo(w / 2, h - 12);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 80, 0, Math.PI * 2);
  ctx.stroke();
  for (const x of [12, w - 12 - 120]) ctx.strokeRect(x, h / 2 - 150, 120, 300);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A see-through net: a white grid on a transparent canvas. */
function netTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 128; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 128);
    ctx.moveTo(0, i);
    ctx.lineTo(128, i);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  return texture;
}

/** A goal frame and net, opening toward the pitch. `side` is -1 for the west end, 1 for the east end. */
function Goal({ side, net }: { side: -1 | 1; net: THREE.Material }) {
  const { width: w, height: h, depth: d } = PITCH.goal;
  const x = PITCH.center[0] + (side * PITCH.size[0]) / 2;
  const z = PITCH.center[1];
  const post = <cylinderGeometry args={[0.08, 0.08, h, 10]} />;
  return (
    <group>
      {[-1, 1].map((t) => (
        <mesh key={t} position={[x, h / 2, z + (t * w) / 2]} castShadow>
          {post}
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[x, h, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, w, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      <mesh position={[x + side * d, h / 2, z]} rotation={[0, Math.PI / 2, 0]} material={net}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {[-1, 1].map((t) => (
        <mesh key={t} position={[x + (side * d) / 2, h / 2, z + (t * w) / 2]} material={net}>
          <planeGeometry args={[d, h]} />
        </mesh>
      ))}
      <mesh position={[x + (side * d) / 2, h, z]} rotation={[-Math.PI / 2, 0, 0]} material={net}>
        <planeGeometry args={[d, w]} />
      </mesh>
    </group>
  );
}

interface BallTag {
  football: number;
}
/** The body's football tag, or undefined for any other body. */
const tagOf = (body: RapierRigidBody): BallTag | undefined => {
  const data = body.userData as Partial<BallTag> | undefined;
  return typeof data?.football === 'number' ? (data as BallTag) : undefined;
};

/** Seconds between impact sounds from the same ball. */
const IMPACT_COOLDOWN = 0.15;

/** The tech-stack footballs and their pitch: knock them around with the car (R11); they tidy themselves up. */
export function Footballs() {
  const rapier = useRapier();
  const camera = useThree((s) => s.camera);
  const textures = useMemo(() => profile.skills.slice(0, FOOTBALLS.length).map(ballTexture), []);
  const pitch = useMemo(pitchTexture, []);
  const net = useMemo(() => new THREE.MeshBasicMaterial({ map: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false }), []);
  const idle = useMemo(() => new Float32Array(FOOTBALLS.length), []);
  const lastImpact = useRef(new Map<number, number>());
  const clock = useRef(0);
  const sinceReset = useRef(0);
  const scratch = useMemo(() => ({ frustum: new THREE.Frustum(), matrix: new THREE.Matrix4(), point: new THREE.Vector3() }), []);

  // Let Rapier drop resting contacts natively, and start the balls asleep.
  useEffect(() => {
    const timer = setTimeout(
      () =>
        rapier.world.forEachRigidBody((body) => {
          if (tagOf(body)?.football === undefined) return;
          for (let i = 0; i < body.numColliders(); i++) body.collider(i).setContactForceEventThreshold(impactThreshold(FOOTBALL.mass));
          body.sleep();
        }),
      300,
    );
    return () => clearTimeout(timer);
  }, [rapier]);

  const onImpact = (payload: ContactForcePayload) => {
    const intensity = impactIntensity(payload.maxForceMagnitude, FOOTBALL.mass);
    const body = payload.target.rigidBody;
    if (intensity < MIN_IMPACT || !body) return;
    const last = lastImpact.current.get(body.handle) ?? -1;
    if (clock.current - last < IMPACT_COOLDOWN) return;
    lastImpact.current.set(body.handle, clock.current);
    const p = body.translation();
    emit({ type: 'impact', material: 'plastic', intensity: intensity * 0.7, position: [p.x, p.y, p.z], source: `football-${body.handle}` });
  };

  // Once a second, put back balls that have rolled off and sat still out of view (same rule as the props).
  useFrame((_, dt) => {
    clock.current += dt;
    sinceReset.current += dt;
    if (sinceReset.current < 1) return;
    const elapsed = sinceReset.current;
    sinceReset.current = 0;
    scratch.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    scratch.frustum.setFromProjectionMatrix(scratch.matrix);
    rapier.world.forEachRigidBody((body) => {
      const i = tagOf(body)?.football;
      if (i === undefined) return;
      const p = body.translation();
      const v = body.linvel();
      idle[i] = Math.hypot(v.x, v.y, v.z) > 0.05 ? 0 : idle[i] + elapsed;
      const [hx, hz] = FOOTBALLS[i];
      const visible = scratch.frustum.containsPoint(scratch.point.set(p.x, p.y, p.z));
      if (!shouldReset({ displaced: Math.hypot(p.x - hx, p.z - hz), tilt: 0, idleSeconds: idle[i], visible })) return;
      body.setTranslation({ x: hx, y: FOOTBALL.radius, z: hz }, false);
      body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      body.setAngvel({ x: 0, y: 0, z: 0 }, false);
      body.sleep();
      idle[i] = 0;
    });
  });

  return (
    <>
      <mesh position={[PITCH.center[0], 0.03, PITCH.center[1]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={PITCH.size} />
        <meshStandardMaterial map={pitch} roughness={0.95} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <Goal side={-1} net={net} />
      <Goal side={1} net={net} />
      {FOOTBALLS.map(([x, z], i) => (
        <RigidBody
          key={i}
          colliders={false}
          position={[x, FOOTBALL.radius, z]}
          userData={{ football: i } satisfies BallTag}
          linearDamping={0.25}
          angularDamping={0.4}
          ccd
          onContactForce={onImpact}
        >
          <BallCollider args={[FOOTBALL.radius]} mass={FOOTBALL.mass} friction={FOOTBALL.friction} restitution={FOOTBALL.restitution} />
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[FOOTBALL.radius, 28, 18]} />
            <meshStandardMaterial map={textures[i]} roughness={0.55} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}
