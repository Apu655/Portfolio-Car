# Career Cosmos — 3D portfolio (prototype v0.1)

An explorable 3D portfolio: fly a spaceship through space to portfolio stations and a futuristic city whose
MetLife-inspired career tower holds one floor per role. A fast, accessible **quick view** shows the same content
as a plain page, and you can switch between the two at any time without losing your place.

Everything is procedural (no paid or downloaded 3D assets) and all content is placeholder.

## Run it locally

Requires Node.js 18+ (developed on Node 26).

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. Other commands:

| Command | What it does |
|---|---|
| `npm run build` | Type-checks and builds the production site into `dist/` |
| `npm run preview` | Serves the production build at <http://localhost:4173> |
| `npm test` | Unit and UI integration tests (Vitest + Testing Library, jsdom) |
| `npm run test:e2e` | Builds, serves, and runs browser smoke tests in your installed Google Chrome (Playwright) |
| `npm run models:export` | Exports every procedural model to `models-export/*.glb` for Blender |
| `npm run resume:placeholder` | Regenerates the placeholder `public/resume.pdf` |

## Controls

| Input | Action |
|---|---|
| `W` / `S` (or ↑ / ↓) | Thrust / brake and reverse |
| `A` / `D` (or ← / →) | Turn |
| `Space` / `Shift` (or `E` / `Q`) | Climb / descend |
| Mouse drag · wheel | Look around the ship · zoom |
| Click or tap a building | Fly there and open its panel |
| `M` | Open the menu (every section and role, keyboard-accessible) |
| `Esc` | Close the menu, then the panel |

Choosing anything from the menu engages autopilot; pressing any flight key takes back control.

## How it fits together

```
src/
  content/portfolio.ts   ← the only file to edit for your real content (roles, papers, projects, contact)
  state/                 route ↔ URL hash (#/3d/experience/<role>), zustand store, view switching
  lib/capabilities.ts    WebGL / reduced-motion / software-renderer detection → which view opens first
  models/                pure three.js builders: ship, tower, city, island terrain, stations (no React)
  world/                 React Three Fiber scene, flight model (pure + unit-tested), layout, labels
  ui/                    HUD, menu, info panel, notices (plain DOM over the canvas)
  basic/BasicSite.tsx    the quick view
scripts/                 model export (.glb) and placeholder résumé generator
e2e/                     Playwright smoke tests
```

- **Every place has a URL**: `#/3d/experience/senior-engineer`, `#/basic/research`, … Back/Forward work across views.
- **3D is the default**, except when WebGL is missing (quick view, with a note), or reduced motion is on or the GPU
  is a software renderer (quick view first, 3D one click away). An explicit `#/3d/...` link is honored when WebGL exists.
- **The quick view never downloads three.js**: the 3D world is a lazily loaded chunk.

## Replacing placeholders

1. Edit `src/content/portfolio.ts` (the tower grows a floor per role automatically).
2. Replace `public/resume.pdf` with your résumé.
3. Update the name and description in `index.html`.

## Models and Blender

Blender isn't required. Models are generated in code (`src/models/*`) so they stay small, versionable, and tied to
your content (for example, the tower's floor count). `npm run models:export` writes `.glb` files you can import into
Blender (File → Import → glTF 2.0) to refine by hand. Swapping a hand-made model back in would replace the matching
builder with a glTF loader. That isn't wired up yet.

## Known limitations (v0.1)

- No touch flight controls: on phones, navigate with the menu or by tapping buildings.
- No car or ground-level driving yet; the city is explored by flying low over it.
- Research, Projects, and Contact are single stations with list panels; only the tower has per-item geometry.
- The quick view renders in the browser, so search engines may index it poorly (no prerendering yet).
- The view switch is a fade with a camera pull-back; the "buildings fold into cards" transition is deferred.
