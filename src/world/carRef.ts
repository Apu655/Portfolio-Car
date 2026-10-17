// Shared handles to the car so the camera, audio, and VFX can follow it without React state.
import type { RapierRigidBody } from '@react-three/rapier';
import type * as THREE from 'three';

export const carRefs: {
  body: RapierRigidBody | null;
  /** The visual car root (follows the chassis with interpolation). */
  visual: THREE.Object3D | null;
} = { body: null, visual: null };
