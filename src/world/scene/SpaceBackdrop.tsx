import { Stars } from '@react-three/drei';

const PLANETS = [
  { position: [-1400, 260, -1700] as const, radius: 240, color: '#6b3fa0', emissive: '#2a0f4f' },
  { position: [1600, -120, -900] as const, radius: 130, color: '#2d7f9a', emissive: '#082a36' },
  { position: [700, 520, 1800] as const, radius: 80, color: '#c27a3a', emissive: '#3a1c05' },
];

/** Starfield, distant planets, and lighting. Everything here is decorative and out of flight range. */
export function SpaceBackdrop() {
  return (
    <>
      <color attach="background" args={['#04050d']} />
      <Stars radius={1200} depth={600} count={5000} factor={7} saturation={0.4} fade speed={0.4} />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#8fb4ff', '#2a1640', 0.55]} />
      <directionalLight position={[300, 400, 200]} intensity={2.2} color="#fff1dc" />
      <mesh position={[900, 700, 1200]}>
        <sphereGeometry args={[60, 32, 16]} />
        <meshBasicMaterial color="#ffe3a8" toneMapped={false} />
      </mesh>
      {PLANETS.map((planet) => (
        <mesh key={planet.color} position={planet.position}>
          <sphereGeometry args={[planet.radius, 48, 24]} />
          <meshStandardMaterial color={planet.color} emissive={planet.emissive} roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}
