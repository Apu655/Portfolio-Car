import { useEffect, useMemo, useRef, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { usePortfolio } from '../../state/store';
import { ROADSIDE_FRAME, zoneFor } from '../district/layout';
import { ROADSIDE_BOARDS, type RoadsideBoard } from '../roadside';
import { dissolveTargets, makeDissolvable } from './dissolve';
import { enableShadows, MODEL_URLS, useModel } from './District';
import { CLICK_TOLERANCE } from './Selectable';
import { FACE_LOGICAL, FACE_PX, loadImage, paintContact, paintItem } from './signPaint';

type Detail = keyof typeof FACE_PX;

/** One roadside billboard: the frame from the landmarks model and its face, painted once (R4–R6, KTD3). */
function RoadsideBillboard({ board, template, detail }: { board: RoadsideBoard; template: THREE.Object3D; detail: Detail }) {
  const navigate = usePortfolio((s) => s.navigate);
  const group = useRef<THREE.Group>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const accent = zoneFor(board.section).accent;

  const frame = useMemo(() => enableShadows(template.clone(), true, true), [template]);
  const face = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = FACE_PX[detail].width;
    canvas.height = FACE_PX[detail].height;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    // Unlit, so the face glows at night like the gates' signs did.
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    return { canvas, ctx: canvas.getContext('2d')!, texture, material };
  }, [detail]);

  useEffect(
    () => () => {
      face.texture.dispose();
      face.material.dispose();
    },
    [face],
  );

  useEffect(() => {
    if (!board.item.image) return;
    let live = true;
    loadImage(board.item.image)
      .then((img) => live && setImage(img))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [board.item.image]);

  // Paint once, and again when the logo or screenshot arrives.
  useEffect(() => {
    const { ctx, canvas, texture } = face;
    ctx.setTransform(canvas.width / FACE_LOGICAL.width, 0, 0, canvas.height / FACE_LOGICAL.height, 0, 0);
    if (board.entries) paintContact(ctx, board.entries, accent);
    else paintItem(ctx, board.item, image, accent);
    texture.needsUpdate = true;
  }, [face, board, image, accent]);

  // The board dissolves when it hides the car (R14).
  useEffect(() => {
    if (!group.current) return;
    dissolveTargets.set(board.key, makeDissolvable(group.current, { cloneMaterials: true }));
    return () => {
      dissolveTargets.delete(board.key);
    };
  }, [board.key]);

  const open = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_TOLERANCE) return;
    event.stopPropagation();
    // Open in place: the car stays where it is, and the camera frames this board (KTD5).
    navigate(board.selection, { travel: false });
  };
  const hover = (on: boolean) => () => {
    document.body.style.cursor = on ? 'pointer' : '';
  };

  const { width, height, centerY, tilt, rotationY } = ROADSIDE_FRAME;
  return (
    <group ref={group} position={[board.position[0], 0, board.position[1]]} rotation={[0, rotationY, 0]} onClick={open} onPointerOver={hover(true)} onPointerOut={hover(false)}>
      <primitive object={frame} />
      <mesh position={[0, centerY, 0]} rotation={[-tilt, 0, 0]} material={face.material}>
        <planeGeometry args={[width, height]} />
      </mesh>
    </group>
  );
}

/** Every section's roadside billboards. Low tiers paint smaller faces to save texture memory. */
export function RoadsideBillboards({ detail }: { detail: Detail }) {
  const landmarks = useModel(MODEL_URLS.landmarks);
  const template = useMemo(() => {
    const source = landmarks.scene.getObjectByName('roadside_billboard')!;
    // Clones carry the template's place in the model; boards are positioned by their own group instead.
    const clean = source.clone();
    clean.position.set(0, 0, 0);
    clean.rotation.set(0, 0, 0);
    return clean;
  }, [landmarks]);
  return (
    <>
      {ROADSIDE_BOARDS.map((board) => (
        <RoadsideBillboard key={board.key} board={board} template={template} detail={detail} />
      ))}
    </>
  );
}
