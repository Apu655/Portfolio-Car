import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { SHOWCASE, type ShowcaseItem } from '../../content/showcase';
import { usePortfolio } from '../../state/store';
import { GATE_FRAME, SECTION_GATES, SECTION_LETTERS, SECTION_TITLES, zoneFor, type SectionGate } from '../district/layout';
import { useGateCaptions } from '../gateCaptions';
import { dissolveTargets, makeDissolvable } from './dissolve';
import { FADE_SECONDS, HEADER_PX, PAGE_SECONDS, pageCount, paintHeader, paintItem, paintSeeAll, SCREEN_PX, screenItem } from './gateScreens';

/** Pixels the pointer may move between press and release and still count as a click. */
const CLICK_TOLERANCE = 6;

const NOUNS: Record<SectionGate['section'], string> = {
  experience: 'roles',
  research: 'papers',
  projects: 'projects',
  education: 'degrees',
  contact: 'ways to reach me',
};

const images = new Map<string, Promise<HTMLImageElement>>();
function loadImage(url: string): Promise<HTMLImageElement> {
  let p = images.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    images.set(url, p);
  }
  return p;
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx: canvas.getContext('2d')!, texture };
}

/** One gate's header sign and two screens that page through the section's items (R5–R7). */
function GateScreens({ gate, index }: { gate: SectionGate; index: number }) {
  const items = SHOWCASE[gate.section];
  const accent = zoneFor(gate.section).accent;
  const navigate = usePortfolio((s) => s.navigate);
  const group = useRef<THREE.Group>(null);
  const [loaded, setLoaded] = useState<Record<string, HTMLImageElement>>({});
  const page = useRef(-1);
  const fade = useRef(1);

  const header = useMemo(() => {
    const c = makeCanvas(HEADER_PX.width, HEADER_PX.height);
    paintHeader(c.ctx, SECTION_LETTERS[gate.section], SECTION_TITLES[gate.section], accent);
    c.texture.needsUpdate = true;
    return c;
  }, [gate.section, accent]);
  const screens = useMemo(() => [makeCanvas(SCREEN_PX.width, SCREEN_PX.height), makeCanvas(SCREEN_PX.width, SCREEN_PX.height)] as const, []);
  const backing = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1b2233', roughness: 0.5 }), []);
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c39545', roughness: 0.3, metalness: 1 }), []);
  const materials = useMemo(
    () => ({
      header: new THREE.MeshBasicMaterial({ map: header.texture, toneMapped: false }),
      screens: screens.map((s) => new THREE.MeshBasicMaterial({ map: s.texture, toneMapped: false })),
    }),
    [header, screens],
  );

  // Load the section's logos and screenshots once; screens repaint as they arrive.
  useEffect(() => {
    let live = true;
    for (const item of items) {
      if (!item.image) continue;
      loadImage(item.image)
        .then((img) => live && setLoaded((prev) => ({ ...prev, [item.image!]: img })))
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
  }, [items]);

  const paint = (p: number) => {
    const shown = ([0, 1] as const).map((side) => {
      const i = screenItem(items.length, p, side);
      return i < 0 ? null : items[i];
    }) as [ShowcaseItem | null, ShowcaseItem | null];
    useGateCaptions.getState().publish(gate.section, shown);
    screens.forEach((s, side) => {
      const i = screenItem(items.length, p, side as 0 | 1);
      if (i < 0) paintSeeAll(s.ctx, items.length, NOUNS[gate.section], accent);
      else {
        const item: ShowcaseItem = items[i];
        paintItem(s.ctx, item, item.image ? loaded[item.image] ?? null : null, accent, `${i + 1} / ${items.length}`);
      }
      s.texture.needsUpdate = true;
    });
  };

  // Repaint when an image arrives.
  useEffect(() => {
    if (page.current >= 0) paint(page.current);
    // paint reads only refs and memoized canvases.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // The gate's screens dissolve with its frame when they hide the car (R8).
  useEffect(() => {
    if (!group.current) return;
    const key = `gate-${gate.section}#screens`;
    dissolveTargets.set(key, makeDissolvable(group.current, { cloneMaterials: false }));
    return () => {
      dissolveTargets.delete(key);
    };
  }, [gate.section]);

  useFrame(({ clock }, dt) => {
    const reduced = usePortfolio.getState().reducedMotion;
    // Gates turn pages out of step with each other, so the street never flips all at once.
    const t = clock.elapsedTime + index * 1.7;
    const next = Math.floor(t / PAGE_SECONDS) % pageCount(items.length);
    if (next !== page.current) {
      page.current = next;
      paint(next);
      fade.current = reduced ? 1 : 0.25;
    }
    if (fade.current < 1) {
      fade.current = Math.min(1, fade.current + dt / FADE_SECONDS);
      for (const m of materials.screens) m.color.setScalar(fade.current);
    }
  });

  const open = (side: 0 | 1) => (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_TOLERANCE) return;
    event.stopPropagation();
    const i = screenItem(items.length, Math.max(0, page.current), side);
    const itemId = i >= 0 ? items[i].itemId : undefined;
    navigate(itemId ? { section: gate.section, itemId } : { section: gate.section });
  };
  const hover = (on: boolean) => () => {
    document.body.style.cursor = on ? 'pointer' : '';
  };

  const { screen: sc, header: hd } = GATE_FRAME;
  return (
    <group ref={group} position={[gate.center[0], 0, gate.center[1]]} rotation={[0, gate.rotationY, 0]}>
      <group position={[0, hd.centerY, hd.z]} rotation={[-hd.tilt, 0, 0]}>
        <mesh material={materials.header}>
          <planeGeometry args={[hd.width, hd.height]} />
        </mesh>
        <mesh position={[0, 0, -0.16]} material={backing}>
          <boxGeometry args={[hd.width + 0.3, hd.height + 0.3, 0.28]} />
        </mesh>
      </group>
      {([0, 1] as const).map((side) => (
        <group key={side} position={[side === 0 ? -sc.offsetX : sc.offsetX, sc.centerY, sc.z]} rotation={[-sc.tilt, 0, 0]}>
          <mesh material={materials.screens[side]} onClick={open(side)} onPointerOver={hover(true)} onPointerOut={hover(false)}>
            <planeGeometry args={[sc.width, sc.height]} />
          </mesh>
          {/* A display box behind the screen, and two brass struts back to the beam. */}
          <mesh position={[0, 0, -0.2]} material={backing} castShadow>
            <boxGeometry args={[sc.width + 0.3, sc.height + 0.3, 0.34]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (sc.width / 2 - 0.5), -0.4, -0.75]} rotation={[0.55, 0, 0]} material={brass}>
              <boxGeometry args={[0.12, 0.12, 1.4]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** The five section gates' screens and header signs; the frames themselves come from the kiosks model. */
export function SectionGates() {
  return (
    <>
      {SECTION_GATES.map((gate, i) => (
        <GateScreens key={gate.section} gate={gate} index={i} />
      ))}
    </>
  );
}
