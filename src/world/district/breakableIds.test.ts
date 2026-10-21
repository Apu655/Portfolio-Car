// The district model tags every vertex of every lamp and tree with its object id (KTD1 of the knock-overs and
// boost plan), so the runtime can hide one object inside the merged meshes. Decodes the shipped model to check.
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { BREAKABLE, lampId, treeId } from '../scene/breakables';
import { LAMPS, TREES } from './layout';

async function idsByMesh(): Promise<Map<string, Set<number>>> {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(resolve(process.cwd(), 'public/models/district.glb'));
  const out = new Map<string, Set<number>>();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    for (const primitive of mesh.listPrimitives()) {
      const attribute = primitive.getAttribute('_OBJ_INDEX');
      if (!attribute) continue;
      const ids = out.get(node.getName()) ?? new Set<number>();
      for (let i = 0; i < attribute.getCount(); i++) ids.add(Math.round(attribute.getScalar(i)));
      out.set(node.getName(), ids);
    }
  }
  return out;
}

const range = (n: number, id: (i: number) => number) => Array.from({ length: n }, (_, i) => id(i)).sort((a, b) => a - b);
const sorted = (ids: Set<number> | undefined) => [...(ids ?? [])].sort((a, b) => a - b);
const union = (...sets: Array<Set<number> | undefined>) => new Set(sets.flatMap((s) => [...(s ?? [])]));

describe('object ids in the district model', () => {
  it('tags every part of every lamp with that lamp’s id, and nothing else', async () => {
    const meshes = await idsByMesh();
    expect(sorted(meshes.get('lamp_posts'))).toEqual(range(LAMPS.length, lampId));
    expect(sorted(meshes.get('lamp_heads'))).toEqual(range(LAMPS.length, lampId));
  });

  it('tags every trunk, canopy and pit with its tree’s id', async () => {
    const meshes = await idsByMesh();
    expect(sorted(meshes.get('tree_trunks'))).toEqual(range(TREES.length, treeId));
    expect(sorted(union(meshes.get('tree_leaf_a'), meshes.get('tree_leaf_b'), meshes.get('tree_leaf_c')))).toEqual(range(TREES.length, treeId));
    const pits = TREES.flatMap((t, i) => (t.pit ? [treeId(i)] : []));
    expect(sorted(meshes.get('tree_pits'))).toEqual(pits.sort((a, b) => a - b));
  });

  it('leaves no lamp or tree vertex untagged, and only lamps and trees carry ids', async () => {
    const meshes = await idsByMesh();
    expect([...meshes.keys()].sort()).toEqual(['lamp_heads', 'lamp_posts', 'tree_leaf_a', 'tree_leaf_b', 'tree_leaf_c', 'tree_pits', 'tree_trunks']);
    for (const ids of meshes.values()) {
      expect(ids.has(0)).toBe(false);
      for (const id of ids) expect(id).toBeLessThan(BREAKABLE.flags);
    }
  });
});
