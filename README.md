# Career City: 3D driving portfolio (v0.2)

Drive a retro coupe around a modern 3D city. A boulevard loop passes five landmark towers, each holding part of a
career:

- **MetLife Career Tower**: experience (Software Engineer – AI, Nov 2023 – Jul 2026).
- **AI Research Tower**: publications in healthcare AI, NLP, and LLM research.
- **Projects Tower**: projects with demos and GitHub links.
- **Education Tower**: degrees and achievements.
- **Contact Tower**: email, LinkedIn, GitHub, and the résumé.

Pull into a tower's glowing zone and press **E** to read its panel. The lighting follows the visitor's local
time, so midnight shows a lit-up night city and 1 PM shows full daylight. A conventional **quick view** has the
same content and is always one click away. Switching between the two keeps your place.

Everything is procedural (no paid or downloaded 3D assets). Content marked "Placeholder" is waiting for yours.

## Run it locally

Requires Node.js 18+ (developed on Node 26).

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. Add `?time=21:30` to the URL to preview another time of day, for example
<http://localhost:5173/?time=21:30#/3d>.

| Command | What it does |
|---|---|
| `npm run build` | Type-checks and builds the production site into `dist/` |
| `npm run preview` | Serves the production build at <http://localhost:4173> |
| `npm test` | Unit and UI integration tests (Vitest + Testing Library, jsdom) |
| `npm run test:e2e` | Builds, serves, and drives the site in your installed Google Chrome (Playwright) |
| `npm run models:export` | Exports the car and the five towers to `models-export/*.glb` for Blender |
| `npm run resume:placeholder` | Regenerates the placeholder `public/resume.pdf` |

## Controls

| Input | Action |
|---|---|
| `W` / `↑` | Accelerate |
| `S` / `↓` | Brake, then reverse |
| `A` `D` / `←` `→` | Steer |
| `Space` | Handbrake |
| `E` | Open the tower whose glowing entrance zone you're in |
| `Esc` | Close the menu, then the panel (pressing `W` again also closes the panel and drives off) |
| `M` | Fast-travel menu (keyboard and screen-reader friendly) |
| Click or tap a tower | Fast travel there and open its panel |
| Mouse drag · wheel | Look around · zoom |
| Touch | On-screen joystick, Brake, and an "Open" button inside a zone |

## How it fits together

```
src/
  content/portfolio.ts     ← the only file to edit for your content (role, papers, projects, education, contact)
  state/                   URL hash routing (#/3d/research, #/basic/education…), store, view switching
  lib/capabilities.ts      WebGL / reduced-motion / software-renderer detection → which view opens first
  world/city/cityLayout.ts the city plan as data: boulevard loop, streets, lots, tower sites, zones, colliders
  world/drive/             pure, unit-tested car model and keyboard/touch input
  world/lighting/          pure time-of-day lighting keyframes
  world/scene/             React Three Fiber components: lighting, city, landmarks, car rig, labels
  models/                  procedural three.js builders: retro coupe, five landmarks, roads, buildings, trees
  ui/                      HUD, welcome card, E prompt, fast-travel menu, info panel, touch controls
  basic/BasicSite.tsx      the conventional quick view
e2e/                       Playwright smoke tests (drive to a tower, press E, switch views)
```

- **Every place has a URL**, and Back/Forward work across views.
- **3D opens first**, except without WebGL (quick view, with a note), or with reduced motion on or a software-only
  GPU (quick view first; the city is one click away).
- **Performance:**
  - The quick view never downloads three.js; the city is a lazily loaded chunk.
  - Buildings, trees, streetlights, and road markings are instanced.
  - Shadows render once and refresh only when the sun moves.
  - Phones skip shadows.

## Replacing placeholders

1. Edit `src/content/portfolio.ts`.
2. Replace `public/resume.pdf` with your résumé.
3. Update the name and description in `index.html`.

## Known limitations (v0.2)

- No traffic, pedestrians, or audio, and no manual day/night toggle (only the `?time=` preview).
- Driving is arcade-style: no suspension or damage. The car slides along walls.
- The quick view renders in the browser, so search engines may index it poorly (no prerendering yet).
- In a narrow portrait window, the Career Tower starts near the edge of the view from the spawn point.
