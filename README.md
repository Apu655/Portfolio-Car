# Apu Islam: the Career District

An interactive 3D portfolio. Drive a classic coupe through a golden-hour miniature district, seen from a fixed
isometric-style camera high above, and discover the career inside it:

Each section has its own road, entered through a gate with a lettered sign. Past the gate, its items stand
beside the road on big billboards, and a sharp caption card repeats the nearest one; click a board or its card
to open that item where you are.

- **Work (W), the cross street**: a billboard per role (MetLife, Sysonex Development, George Mason University,
  BRAC University), leading to the Career Tower.
- **Research (R), the east road**: a friendly robot stands in the road just past the gate. Drive up and it
  greets you with SeCAREly; press **E** to read the paper. A billboard per paper lines the rest of the road.
- **Projects (P), the north road**: the Projects Hall, its front showing every project's screenshot. Pull up
  and press **E** for the full project list.
- **Education (E), the west road**: billboards for Monash and BRAC, then a small campus with a clock tower.
- **Contact (C), the south road** just west of the start: a "say hello" billboard and the Contact kiosk.
- **The APU ISLAM billboard**: flickers to life when you arrive, then glows steadily.
- **The corner map**: the district drawn the way the camera shows it, with a letter per section to travel to.
- **The football pitch** near the start: eight balls carrying the tech stack to knock around with the car.

Pull into a glowing zone and press **E** to open its panel. Along the way, knock over cones, crates, barrels,
signs, and benches, smash through the brick wall, and splash across the pond. The sky follows a day cycle that
starts at your local time and runs a full day in about 12 minutes: golden sunset, blue hour, then a quiet night
with lit windows, streetlights, and headlights. A conventional **quick view** has the same content, is always one
click away, and keeps your place when you switch.

Content comes from Apu's CV and project list in `src/content/portfolio.ts`.

## Run it locally

Requires Node.js 18+ (developed on Node 26).

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:5173>. Add `?time=21:30` to the URL to start the clock at another time, for example
<http://localhost:5173/?time=21:30#/3d>.

| Command | What it does |
|---|---|
| `npm run build` | Type-checks and builds the production site into `dist/` |
| `npm run preview` | Serves the production build at <http://localhost:4173> |
| `npm test` | Unit, physics (real Rapier), and UI integration tests (Vitest, jsdom) |
| `npm run test:e2e` | Builds, serves, and drives the site in your installed Google Chrome (Playwright) |
| `npm run assets:build` | Rebuilds every 3D model with Blender (see below); `npm run assets:build -- car props` rebuilds some |
| `npm run budget` | Checks download budgets: models ≤ 3 MB, audio ≤ 2.5 MB, total 3D download ≤ 8 MB (after a build) |
| `npm run resume:placeholder` | Regenerates the placeholder `public/resume.pdf` |
| `node scripts/build-showcase.mjs` | Resizes the screenshots and logos in `assets/My Items/` into `public/showcase/` (macOS `sips`) |

### Rebuilding the 3D models

The models in `public/models/*.glb` are generated, not hand-modelled: Python scripts drive Blender headlessly.

1. Install [Blender](https://www.blender.org/download/) (developed and tested on 5.2).
2. Run `npm run assets:build`. It exports the district layout to `assets/build/layout.json`, runs
   `assets/blender/build_all.py`, compresses each model with meshopt, and checks the model budget.

The layout in `src/world/district/layout.ts` is the single source of truth: roads, zones, props, trees, the pond,
and colliders all come from it, so Blender and the runtime always agree.

## Controls

| Input | Action |
|---|---|
| `W` / `↑` | Accelerate |
| `S` / `↓` | Brake, then reverse |
| `A` `D` / `←` `→` | Steer |
| `Space` | Handbrake |
| `R` | Recover: put the car back on its wheels (it also happens on its own after a flip) |
| `E` | Open the stop whose glowing zone you're in |
| `Esc` | Close the menu, then the panel (pressing `W` again also closes the panel and drives off) |
| `M` | Fast-travel menu (keyboard and screen-reader friendly) |
| `N` | Enlarge or shrink the corner map |
| Click or tap the Career Tower, robot, hall, campus, or kiosk | Fast travel there and open its panel |
| Click or tap a roadside billboard | Open that item where you are |
| Scroll · pinch | Zoom in and out (the camera angle itself is fixed) |
| Touch | Push the joystick toward where you want to drive; Brake, Recover, and an "Open" button inside a zone |
| Any key or tap during the opening fly-over | Skip it |

**Day dial** (top bar): pause or resume the day cycle and drag to any time. On phones it collapses to a time chip.

**Sound** (top bar): a mute toggle, a volume slider, and a Background music switch, all remembered. Nothing
plays until your first click, tap, or key press, as browsers require. The music is a soft ambient score generated
in the browser, so it is copyright-free and adds nothing to the download.

**Map** (bottom-right corner): click a letter to travel there; press `N` for a larger map with a legend.

## How it fits together

```
src/
  content/portfolio.ts   ← the only file to edit for your content (role, papers, projects, education, contact)
  state/                 URL hash routing (#/3d/research, #/basic/education…), store, view switching
  lib/capabilities.ts    WebGL / reduced-motion / software-renderer detection → which view opens first
  world/district/        the layout as data (roads, zones, props, pond, billboard) and the static colliders
  world/physics/         Rapier raycast vehicle tuning, pond drag and grip, prop masses and reset rules
  world/scene/           React Three Fiber components: district, car, props, water, billboard, labels
  world/camera/          fixed-view follow camera, zoom, panel framing, the opening, and see-through buildings
  world/lighting/        day clock, time-of-day keyframes, sky, night glow, quality tiers, post-processing
  world/audio/           synthesized soundscape: engine and tires, impacts, splashes, ambience, voice limiter
  world/events.ts        event bus and telemetry: physics publishes, audio, effects, and HUD listen
  ui/                    HUD, day dial, sound controls, welcome card, E prompt, menu, info panel, touch controls
  basic/BasicSite.tsx    the conventional quick view
assets/blender/          Python model scripts (car, tower, district, gates and kiosk, landmarks, billboard, buildings, props)
e2e/                     Playwright smoke tests (drive to the tower, pond, cones, fast travel, fps report)
```

- **Every place has a URL**, and Back/Forward work across views.
- **3D opens first**, except without WebGL (quick view, with a note), or with reduced motion on or a software-only
  GPU (quick view first; the district is one click away). Reduced motion also skips the fly-over and the
  billboard flicker.
- **Physics** runs on a fixed 60 Hz step. The car is a Rapier raycast vehicle with suspension; props are dynamic
  bodies that sleep until hit and quietly tidy themselves up once you've driven away.
- **Performance:**
  - The quick view never downloads three.js, physics, models, or sounds; the district is a lazily loaded chunk.
  - Three quality tiers (shadows, resolution, ambient occlusion and bloom); the site steps down a tier if the
    frame rate stays low.
  - Current 3D download: about 2.7 MB in total (1.4 MB of models).

## Replacing placeholders

1. Edit `src/content/portfolio.ts`. The billboards and captions read from it through `src/content/showcase.ts`;
   a new role, paper, or degree also needs a billboard slot in `ROADSIDE_BILLBOARDS` (`src/world/district/layout.ts`),
   and a test fails until it has one.
2. Add the LinkedIn and Google Scholar URLs to `profile.contact` (the CV names them without links).
3. Replace `public/resume.pdf` with your résumé.
4. For new screenshots or logos, put them in `assets/My Items/`, list them in `scripts/build-showcase.mjs`, and run it.

## Known limitations

- All sounds and the music are synthesized in the browser; recorded CC0 samples can replace individual sounds
  later (list them in `public/audio/LICENSES.md`).
- Billboards open by click, tap, or their caption card; only the stops (tower, robot, hall, campus, kiosk) answer to **E**.
- No traffic or pedestrians.
- The quick view renders in the browser, so search engines may index it poorly (no prerendering yet).
