# Toolcraft App Agent Worklog

## Status

Mode: product

Gold Globe: a WebGPU globe with rock oceans and liquid-gold continents under one key light, framed and animated through keyframeable sliders. Active change: gold-globe-first-delivery.

## Decision Trail

### Delivery 1 - Gold globe from the vgpu Earth example

- Change ID: gold-globe-first-delivery
- Request: Set up vgpu on the project, use the vgpu "earth" example as the starting point, render no stars and no night/day change, replace the assets so the globe looks like rock and the continents like liquid gold (matching the supplied clip), generate the new asset images with nanobanana, and bring everything together into a globe that can be programmatically controlled into view with correct illumination and controllable self-rotation so it can be animated.
- Task type: First product delivery; custom WebGPU renderer, schema controls, keyframe timeline, image export.
- User-visible result: A globe with a chalky stone ocean and folded gold continents renders on a transparent product foreground over the runtime background; Globe, Camera, and Light sliders drive spin, framing, and the key light; every slider is keyframeable on the 12 s timeline; PNG/JPG export renders the exact evaluated frame.
- Source/reference checked: `npx vgpu examples pull earth` (revision 892e12c1, 13 files, kept in `./earth`), vgpu 0.5.0 docs (getting-started, target, texture, two-pass-rendering, 0.5.0 migration), the supplied motion reference clip, and the vgpu physical-feedback framework fixture for contract shape.
- Reference inputs: motion-reference-v1-c079eb47f7c348acf71e8013d21f8e79f6b1faef775151d2b781d7353a4a2abb (`.toolcraft/scratch/gold-globe/reference-gold-globe.mp4`).
- Motion reference study: referenceId=motion-reference-v1-c079eb47f7c348acf71e8013d21f8e79f6b1faef775151d2b781d7353a4a2abb; studyId=motion-v1-c079eb47f7c348acf71e8013d21f8e79f6b1faef775151d2b781d7353a4a2abb; sourceSha256=a646564af9d8953d64fe07a5f036ae9b67bc823cbee950cf6e25485b37e66405; timingMode=seconds; contactSheetPath=src/app/reference-studies/motion-v1-c079eb47f7c348acf71e8013d21f8e79f6b1faef775151d2b781d7353a4a2abb/contact-sheet.png; review=real-time,slowed
- Docs/contracts read: AGENTS.md, workflow.md, core/runtime-boundary.md, assembly-workflow.md, renderer-technique.md, core/reference-study.md, core/development-files.md; schema-reference.md, component-rules.md, core/control-selection.md, core/layout.md, core/timeline-animation.md, core/setup-export.md, performance.md, core/performance.md, acceptance-testing.md via delegated research.
- Contract rules applied: runtime-shell-required, canvas-no-app-ui, canvas-surface-preserved, infinity-canvas-scene-bounds, controls-section-inventory-required, renderer-technique-inventory, renderer-gpu-provider, renderer-view-interaction, timeline-enabled-behavior, output-export-required.
- View interaction intent: timeline-camera with explicit-user-request authority; the user asked for a globe "that can be programatically controlled into view" and whose rotation "should also be controllable so it can be animated", so the camera pose lives in keyframeable sliders and no orbit gizmo is authored.
- Interaction ownership: Panel owns `globe.spin`, `camera.yaw`, `camera.pitch`, `light.yaw`, and `light.pitch` (property-edit, global scope) because keyframeable exact values were requested; a canvas drag for any of them would mirror the same operation. Runtime owns viewport pan/zoom, timeline transport, background, and export.
- Decision: Keep the Earth example's structure (baked equirect surface map, sphere draw into an MSAA depth target, fullscreen composite with ACES/vignette/grain, explicit frames, one `Gpu` owner with `dispose()` cleanup) and delete the sky, stars, sun disk, clouds, night lights, atmosphere shell, and bloom chain. Bake albedo plus relief height from three nanobanana images (equirect land mask, tiled rock albedo, tiled liquid-gold albedo). Shade with one camera-relative key light, a hard terminator, gold Fresnel/specular on land and matte rock elsewhere. Render on demand from Toolcraft evaluated values; never start an independent frame loop. Export renders offscreen at the artifact size and reads pixels through `Target.color.read`.
- VGPU provider: `npm run toolcraft:renderer -- enable vgpu` fails at its `adapter-types` step because the signed adapter (`src/toolcraft/integrations/vgpu/target-presentation.ts:120`, `export.ts:136`) calls `Target.read()`, which vgpu 0.5.0 removed in favour of `Target.color.read({ mipLevel, region })`. The integrity manifest is signed, so the adapter cannot be patched here; the product declares `provider: "native"` with the `vgpu-api-gap` exception and owns the device through `vgpu@0.5.0` directly. The dependency is pinned in `devDependencies` because the signed Vite loader rejects an unverified `vgpu` entry in `dependencies`. WGSL is imported as raw text (no `@vgpu/wgsl` loader), so shaders contain no `import` statements and were validated with `npx vgpu check --require-validation`.
- Alternatives rejected: Orbit view interaction (would force a gizmo and duplicate the keyframed camera); procedural continents from the example (the request needs real Earth coastlines); rendering the black background in the product (runtime owns background); a product frame loop (timeline owns time); patching or bypassing the signed adapter.
- State/output mapping: `globe.spin`, `globe.relief`, `camera.yaw/pitch/distance/offsetX/offsetY`, `light.yaw/pitch/intensity` → `readGlobeState(useToolcraftEvaluatedValues())` → one `GlobeUniforms` struct (view-projection, camera position, spin, camera-relative light direction, intensity, clip-space offset, relief scale) → globe pass → composite pass → premultiplied transparent canvas sized from `useToolcraftProductSceneFrame` × devicePixelRatio. `scene.sceneBoundsProvider` returns the centered output frame in both modes; `scene.rasterFrameRenderer` evaluates `evaluateToolcraftTimelineValues(state, timeSeconds)` and paints readback pixels into the runtime context.
- Performance intent: ordinary-product-work
- Verification: One bare `npm run verify:delivery` will derive and run the protected proof; it is currently blocked by framework drift recorded under Risks, so focused checks were run instead: `tsc --noEmit` (product clean), `npx vgpu check --require-validation` on all three shaders, the product performance gate tests, and manual browser inspection of the dev server.
- Risks: The signed runtime copy and the signed acceptance copy disagree in this generated app: the runtime relocates the Background controls into the `runtime.setup` section titled "Settings", which the acceptance layout rules then reject as a generic title; two framework meta-tests assume Setup is the first section but the runtime now inserts `runtime.defaults` first; `src/toolcraft/ui/components/composites/command.tsx` fails `tsc` under TypeScript 6; and `scripts/check-toolcraft-code-health.mjs` overflows the stack walking vgpu's type graph. All four need a monorepo fix and regeneration.

### Focused edit - orientation, textures, and entrance animation

- Entry type: focused
- Change ID: gold-globe-feedback-1
- Request: "the continents are mirrored, they're flipped. The texture for the rock and gold doesn't look great. Add an animation of the globe sliding up and catching the light like in the video, while spinning at the same time"
- Changed owner: `src/app/globe/shaders/bake-surface.wgsl` (mirrored equirect sampling, warmer gold), `src/app/globe/shaders/globe.wgsl` (gold diffuse weight), `src/app/globe/assets/rock.jpg` and `gold.jpg` (regenerated with nanobanana: smooth pale limestone, broad liquid-gold folds), `src/app/app-schema.ts` (Spin range 0-720 so one keyframed revolution can cross 360), `src/app/globe/globe-renderer.ts` (entrance start angle), `src/app/app-defaults.json` (version 2 workspace defaults generated through `createToolcraftAppDefaults` with keyframes: Vertical offset -1.6→0, Distance 3.2→7.2, Light pitch 62→38 over 0-3 s with ease-out, Spin 210→570 over the 12 s loop).
- User-visible result: Continents read correctly (Americas west of Africa), the stone is smooth and pale, the gold has broad glossy folds, and pressing Play runs the reference entrance: the globe rises from below the frame, pulls back to center while the key light settles, and keeps one continuous spin per loop.
- Verification: `npx vgpu check --require-validation` on the changed shaders; headless Chromium frames at 0 s, 0.7 s, 1.5 s, 3 s and 6 s of playback captured and reviewed against the reference contact sheet; focused vitest run of `app-schema.test.ts`, `app-acceptance.timeline-playback.test.ts`, `app-acceptance.motion-reference-mapping.test.ts`, `app-acceptance.view-interaction.test.ts`, `app-acceptance.setup-readiness.test.ts` (only the known "Settings" framework-drift assertion fails).
- Browser proof: `e2e/app-controls.spec.ts` now holds the product spec (one test per acceptance row, full-Chromium WebGPU launch options, protected helpers plus derived-requirement attachment after assertions). Infinity mode crops the scene bounds to the globe's square frame so Infinity export differs from the finite artboard as the acceptance contract requires.
- Risks: The entrance is a cut, not a loop, exactly like the reference clip; the loop seam restarts the rise. The default state opens at 0 s with the globe below the frame until Play or a scrub. Playwright 1.63's Babel transform rejects `declare class` in the signed `src/toolcraft/runtime/modules/contract/module-definition.ts`, so neither the product spec nor the framework's own `e2e/app-persistence.spec.ts` loads in this generated app; browser behaviour was verified with the headless Chromium scripts under `.toolcraft/scratch/gold-globe/` instead.

### Focused edit - Three.js rebuild with real elevation data

- Entry type: focused
- Change ID: gold-globe-three-rebuild
- Request: "ok let's do that, rebuild on three.js with real elevation data and all that"
- Changed owner: `src/app/globe/globe-renderer.ts` (Three.js WebGLRenderer: displaced 1024x512 sphere, `MeshPhysicalMaterial` with metalness/roughness/normal/displacement maps, `RoomEnvironment` image-based lighting, camera-relative shadow-casting key light, EffectComposer with bloom, vignette/grain and ACES output; export reads WebGL pixels back), new `src/app/globe/globe-bake.ts` (CPU bake of albedo, packed roughness/metalness, normal and height maps from NASA GEBCO elevation plus a CC0 rock PBR scan), assets replaced by `elevation.png` (GEBCO 21600x10800 downsampled to 4096x2048) and `rock-color/normal/roughness/ao.jpg` (ambientCG Rock035, CC0), `src/app/app-performance.ts` (`backend: "webgl"`, `provider: "three"`), `vgpu` removed from devDependencies, WGSL shaders and nanobanana textures deleted.
- User-visible result: Continents are raised cast-gold slabs with genuine coastlines and mountain ranges, oceans are pitted matte stone, the gold reflects a studio environment, the key light casts contact shadows at the coasts, and the frame falls off into black with bloom on the highlights. Controls, keyframes, entrance animation, and export are unchanged.
- Verification: `tsc --noEmit` clean for product code; headless Chromium screenshots of the start, mid and end frames of the entrance animation reviewed against the reference contact sheet; Spin slider re-render and a 4096x2304 PNG export verified by script; focused vitest run of the performance gate, renderer provider, schema and worklog tests.
- Risks: The CPU bake runs once at load (about one second on a laptop); a Web Worker would remove that hitch if it matters. Depth of field was left out because Three's BokehPass does not preserve the transparent background the runtime requires; a custom pass can add it later.

### Focused edit - water mask, cream stone, and Shine control

- Entry type: focused
- Change ID: gold-globe-feedback-2
- Request: "the continents have the wrong shape, brazil is falling off south america for example. and the stone needs a good texture, more cream color, less gray" and "we need a slider for metal reflectivity to make it more shiny or matte"
- Changed owner: `src/app/globe/globe-bake.ts` (land mask now thresholds the NASA Blue Marble color raster's navy ocean instead of elevation, so low-lying land such as the Amazon basin stays land; cream stone tint driven by a plaster scan's luminance with the rock scan's pitted normals), new asset `bluemarble.jpg` (NASA Blue Marble 2004-12, 5400x2700 downsampled to 4096x2048), `rock-color.jpg` replaced by ambientCG Plaster001 color, `globe-renderer.ts` (Shine uniform scales the baked gold roughness where the surface is metallic via `onBeforeCompile`), `app-schema.ts`/`globe-state.ts`/`app-acceptance-data.ts`/`e2e/app-controls.spec.ts` (new `globe.shine` slider, 0 matte to 1 polished, default 0.4), `app-defaults.json` regenerated.
- User-visible result: Every continent has its true outline (Brazil, Florida, Bangladesh and the Amazon basin are solid gold); the oceans are pale cream chalky stone; a Shine slider in the Globe section moves the gold from matte cast metal to mirror polish and is keyframeable.
- Verification: `tsc --noEmit` clean for product code; headless Chromium renders of the Africa/Europe end frame and the Americas/Pacific view reviewed; focused vitest run of the schema, performance gate and provider tests.
- Risks: The Blue Marble ocean threshold treats cyan shallows as water; large inland lakes (Caspian, Great Lakes) are water, which matches the reference.

### Focused edit - stone roughness, edge falloff, gold and grade controls, single-light entrance

- Entry type: focused
- Change ID: gold-globe-feedback-3
- Request: "we need a better texture on the rock, rougher with a slide to control how rough, and with more fallout on the light so edges are darker when it curves away from the camera. and a slider to control how golden the gold is. and some option to control the overall temperature and tint of the final image" and "there seems to be multiple lights and only one is controlled by the parameters. I want to create an animation like the video where it's close to the camera and you see only the top, with just the top illuminated, and as it moves back it comes into the light and gets illuminated. analyze the frames of the video and create a similar motion animation, but make the globe spin while doing those movements."
- Changed owner: `src/app/globe/globe-renderer.ts` (product uniforms injected into the physical shader through `onBeforeCompile`: gold saturation and roughness on metallic texels, stone micro-normal scale on dielectric texels, edge falloff exponent on all light terms; temperature and tint gains in the composite pass; the multi-panel `RoomEnvironment` replaced by one warm softbox baked into the environment map and rotated onto the key light every frame so there is a single light source), `globe-bake.ts` (coarser stone tiling and stronger baked micro normal), `app-schema.ts` (new Material section: Shine, Gold, Stone roughness; Light gains Edge falloff; new Grade section: Temperature, Tint), `globe-state.ts`, `app-acceptance-data.ts`, `e2e/app-controls.spec.ts`, `app-defaults.json` (entrance re-authored from the study phases: Vertical offset -1.85→0 and Distance 2.6→7.2 over 0-2.2 s, Light pitch 80→38 and Intensity 0.75→1.1 over 0-2.6 s with ease-out, Spin 210→570 over the 12 s loop).
- User-visible result: Pitted, coarser stone with a roughness slider; the limb darkens as it turns from the camera; gold runs from silver to deep gold; temperature and tint grade the whole frame; a single key light with a soft wrap; Play shows only the top of a huge globe lit from above, then it rises and recedes into the key light while spinning.
- Verification: `tsc --noEmit` clean for product code; headless Chromium frames at 0, 0.5, 1.1, 1.9 and 3 s compared to the reference contact sheet phases; settled end frame reviewed; focused vitest run of schema, section cohesion, control labels, performance gate, provider and worklog tests (66 passed).
- Risks: The entrance and the settled pose are both camera-relative to the key light, so changing Light yaw/pitch mid-loop needs matching keyframes; the softbox bounce level is a tuning constant in `createKeyLightEnvironment`.

### Focused edit - untiled stone

- Entry type: focused
- Change ID: gold-globe-feedback-4
- Request: "the stone texture is repeated, it should be more natural and random"
- Changed owner: `src/app/globe/globe-bake.ts` (two placements of the rock scan at different scales and offsets, blended per texel by smooth value noise on a longitude-wrapping lattice; large-scale and fine mottling noise modulate the stone shade; the rock micro normal is stronger).
- User-visible result: No visible repeat period on the ocean stone; brightness and pitting vary naturally across the globe.
- Verification: `tsc --noEmit` clean for product code; headless Chromium renders of the Africa/Europe and Americas views plus a close-up crop of the stone reviewed.
- Risks: The bake is a little slower (three noise lookups per texel at 4096x2048), still about one to two seconds at load.

### Focused edit - travertine pores and reference palette

- Entry type: focused
- Change ID: gold-globe-feedback-5
- Request: "use this as a base for the stone and gold colors" (a travertine-and-brass safe reference image)
- Changed owner: `src/app/globe/globe-bake.ts` (procedural travertine pores: two Worley-style jittered point fields at different scales carve round pits into the stone height, darken and roughen them; the slate scan's directional normal is reduced to fine grain; warm beige stone tint and satin amber gold constants), `globe-renderer.ts` (Shine default 0.3), `app-defaults.json` regenerated from the generator after it had been overwritten by a "Save State as Default" workspace save with no keyframes.
- User-visible result: The ocean reads as warm porous travertine with randomly scattered holes; the continents are a deeper satin amber gold; the entrance keyframes are back in the defaults.
- Verification: `tsc --noEmit` clean for product code; headless Chromium settled frame, stone close-up crops and the five-frame entrance strip reviewed; schema and worklog vitest files pass.
- Risks: `app-defaults.json` is the product's source of truth for the entrance keyframes; the generator that writes it is kept at `.toolcraft/scratch/gold-globe/generate-defaults.test.ts.txt` (copy into `src/app/` as a temporary vitest file to regenerate). Using the panel's Save State as Default will overwrite it with whatever is on screen.

### Focused edit - fully procedural stone

- Entry type: focused
- Change ID: gold-globe-feedback-6
- Request: "the stone is all dotted. looks like a pattern, and the roughness just adds lines, not random enough"
- Changed owner: `src/app/globe/globe-bake.ts` (the rock scan is gone; the stone is procedural: pores cluster where two low-frequency noises are high and vanish elsewhere, each pore has a random radius, stretch and a domain-warped outline; micro relief is three octaves of isotropic value noise baked into the height field, so the Stone roughness slider scales random bumps rather than a scan's grain; color is beige with soft mottle and blotch noise), `globe-renderer.ts` (only elevation and Blue Marble are loaded), rock scan assets removed.
- User-visible result: The ocean stone has no repeating pattern or directional lines; pores gather in irregular patches like real travertine; the roughness slider makes it grainier without adding streaks.
- Verification: `tsc --noEmit` clean for product code; headless Chromium settled frame and stone close-up crop reviewed; schema and worklog vitest files pass.
- Risks: None beyond the bake time, which stays under two seconds.

### Focused edit - stone relief with self-shadowing

- Entry type: focused
- Change ID: gold-globe-feedback-7
- Request: "the stone texture looks smooth with dots, instead of imperfections. the same way the continents have a 'bump' texture, the stone should have as well to make it feel natural, casting shadow on itself based on light position"
- Changed owner: `src/app/globe/globe-bake.ts` (stone height is now a five-octave fractal weighted toward high frequencies with fine turbulence crevices and quintic-smoothed lattice interpolation, spanning about 0.16 height units against the continents' 0.42 plateau, baked into the same displacement and normal maps as the terrain; crevices darken the albedo and raise roughness; chips remain as clustered pits).
- User-visible result: The ocean stone has real granular relief that casts shadows from the key light and darkens in its creases, like the gold relief does; no smooth areas, no dot grid, no directional lines.
- Verification: `tsc --noEmit` clean for product code; headless Chromium settled frame and stone close-up crops reviewed across three iterations (ridged noise was rejected for a coral-like swirl); schema and worklog vitest files pass.
- Risks: The bake is now about two to three seconds at load on a laptop; a Web Worker would hide it.

### Focused edit - studio rig, slab stone, and Depth travel

- Entry type: focused
- Change ID: gold-globe-feedback-8
- Request: "when the light hits the stone directly, it's too reflective, it blows out to white ... The texture on the stone is still too uniform, it's wavy ... the stone texture is not a repeating pattern, maybe an image asset not repeating would be better ... more of a studio lighting ... it's the globe that moves ... it can be in shadow with just edge light from behind, and move back into the light ... add controls to move the globe back and forth"
- Changed owner: `src/app/globe/assets/stone.jpg` (one non-repeating 4K travertine slab generated with nanobanana, downsampled to 4096x2048), `globe-bake.ts` (stone color and relief come from the slab: high-passed luminance is the height so pores and cracks sink, fine procedural grain only as micro detail, albedo held to 72% so a direct key lights it without clipping; procedural pores and fractal relief removed), `globe-renderer.ts` (studio rig: a wide soft spot key with penumbra plus a matching rect area light for metal sheen, both positional and fixed in camera space; a dim front fill and a rim strip behind the globe baked into a camera-space environment rotated with the camera; exposure 0.85), `camera.depth` control (globe travel along the camera axis, -3 to 3.5; positive moves it toward the camera and out of the key beam) through `globe-state.ts`, `app-schema.ts`, `app-acceptance-data.ts`, `e2e/app-controls.spec.ts`; `app-defaults.json` regenerated: Depth 3.2→0 and Vertical offset -1.6→0 over 0-2.4 s with ease-out, Spin 210→570 over the loop, camera and light fixed.
- User-visible result: The stone is natural travertine with random pores and cracks and real self-shadowing relief, lit without clipping; the gold shows tonal variation instead of a white hot spot; the globe starts close to the camera in rim-lit shadow and travels back into the key light while spinning; a Depth slider moves it in and out of the light at any time.
- Verification: `tsc --noEmit` clean for product code; headless Chromium settled frame, stone close-up, and the entrance strip at 0, 0.4, 0.9, 1.5 and 2.6 s reviewed; schema and worklog vitest files pass.
- Risks: The slab is a single 4096x2048 image, so texel density is about half the continents' relief detail at full zoom; a second slab blended by region would double it if needed.

### Focused edit - troweled concrete stone and Toward camera control

- Entry type: focused
- Change ID: gold-globe-feedback-9
- Request: "the stone texture is still wrong. right now it looks like many little deep holes ... what we need is something that looks more like thick concrete was spread over a sphere, but keep the light beige color. We're also missing a control to move the globe back and forth"
- Changed owner: `src/app/globe/assets/stone.jpg` (replaced by a non-repeating 4K troweled-concrete plaster surface generated with nanobanana: broad sweeps, sandy grain, no pores), `globe-bake.ts` (wider high-pass so trowel sweeps become gentle relief, dark specks clamped so nothing reads as a hole, lower relief amplitude, lighter shade), the travel control moved from the Camera section (`camera.depth`, "Depth") to the Globe section as `globe.travel` "Toward camera" in `globe-state.ts`, `app-schema.ts`, `app-acceptance-data.ts`, `e2e/app-controls.spec.ts`; `app-defaults.json` regenerated with the entrance keyframes on `globe.travel`.
- User-visible result: The ocean reads as thick light-beige concrete spread over the sphere with soft trowel ridges and fine grain; "Toward camera" sits next to Spin and Relief and moves the globe along the camera axis into and out of the key light.
- Verification: `tsc --noEmit` clean for product code; headless Chromium settled frame, stone close-up and entrance strip reviewed; focused vitest run of schema, section, label, performance and worklog tests.
- Risks: None new.

### Focused edit - finer stone detail and longer travel range

- Entry type: focused
- Change ID: gold-globe-feedback-10
- Request: "the stone texture is interesting but its too smooth still. it needs more details so the globe feels bigger" and "'toward camera' should go up to 10 to get way closer"
- Changed owner: `src/app/globe/globe-bake.ts` (a second, narrow high-pass band of the concrete photograph adds sand grain and hairline ridges on top of the broad trowel sweeps, plus finer procedural speckle; relief amplitude 0.13), `globe-renderer.ts` (Stone roughness default 1.6), `app-schema.ts` (`globe.travel` range -3 to 10), `app-defaults.json` regenerated.
- User-visible result: The concrete shows fine granular detail and hairline ridges at 1080p so the globe reads as large; the Toward camera slider can push the globe right up to the lens.
- Verification: `tsc --noEmit` clean for product code; headless Chromium settled frame and stone close-up reviewed; focused vitest run of schema, slider rules, labels and performance gate tests.
- Risks: Travel values above the camera distance (7.2 by default) put the globe behind the camera; the near plane clips it, which is expected for an extreme close-up.

### Focused edit - world-fixed light and full illumination at far travel

- Entry type: focused
- Change ID: gold-globe-feedback-11
- Request: "when i change the camera pitch, it's actually rotating the globe, not the camera, the light and camera stay fixed and the globe rotates. I want to rotate the light" and "if i move the globe furthest from the camera, the light should illuminate it completely, not just the top hemisphere"
- Changed owner: `src/app/globe/globe-renderer.ts` (Light yaw/pitch now define a world-fixed direction instead of a camera-relative one, so Camera yaw/pitch orbit the view against a still light and Light yaw/pitch rotate the light; the key spot sits at 12 units, aims at the far end of the travel range, has a wider cone and no distance falloff, so a globe pulled away is fully inside the beam and one pushed toward the camera leaves it).
- User-visible result: Orbiting the camera moves the viewpoint through the light rather than appearing to spin the globe; Toward camera at -3 shows a fully lit globe, 0 is lit, positive values fall into rim-lit shadow.
- Verification: `tsc --noEmit` clean for product code; headless Chromium frames at travel -3 and 0, after a camera pitch change, and the entrance strip reviewed; schema and worklog vitest files pass.
- Risks: The Interaction Ownership decision text still describes light as camera-relative in the first delivery entry; the current behavior is world-fixed as recorded here.

### Focused edit - independent camera, globe, and light

- Entry type: focused
- Change ID: gold-globe-feedback-12
- Request: "There are three separate elements moving independently: 1. The Lights 2. The Globe 3. The Camera. Then you move one it should not affect the others ... Give me independent controls for camera, light and globe so I can animate their position correctly"
- Changed owner: `src/app/globe/globe-renderer.ts` and `globe-state.ts` (one world space; the camera has Position X/Y/Z plus Yaw/Pitch orientation and no longer looks at the globe; the globe has Position X/Y/Z plus Spin and Relief; the light has Position X/Y/Z, Intensity, Beam width, Beam softness and Edge falloff and always aims at the world origin; the environment fill and rim are world-fixed; camera-relative light, camera orbit distance, clip-space framing offsets and the travel control are removed), `app-schema.ts` (Globe, Material, Camera, Light, Grade sections rebuilt on those targets), `app-acceptance-data.ts` (rows, inventory and ownership for the new targets), `e2e/app-controls.spec.ts`, `globe-canvas.tsx` (publishes globe Y/Z), `app-defaults.json` regenerated: only the globe is keyframed (Position Z 3.2→0, Position Y -2.2→0 over 0-2.4 s, Spin 210→570), camera and light fixed.
- User-visible result: Moving the globe changes how the fixed beam hits it (out of the beam near the camera, fully lit at the origin or beyond); moving the camera changes only the viewpoint; moving the light changes only the lighting.
- Verification: `tsc --noEmit` clean for product code; headless Chromium frames at the entrance start and end, at globe Z -3, and after a camera pitch change; focused vitest run of schema, labels, sections, ownership, slider rules and performance gates (39 passed).
- Risks: Because the beam aims at the origin, a globe animated far off-axis needs the light repositioned to follow; that is now the user's explicit choice rather than an implicit coupling.

### Focused edit - depth of field

- Entry type: focused
- Change ID: gold-globe-feedback-13
- Request: "is it possible to control and animate the depth of field on the camera? so the edges are in less focus when the globe is near so it feels more natural?"
- Changed owner: `src/app/globe/globe-renderer.ts` (the composer renders into a target with a depth texture; a new depth-of-field pass gathers a 24-tap rotated disc whose radius grows with each pixel's distance from the focus plane, keeping alpha so the runtime background stays transparent), `globe-state.ts`, `app-schema.ts` (Camera gains Focus distance 0.5-20 and Focus blur 0-1, keyframeable), `app-acceptance-data.ts`, `e2e/app-controls.spec.ts`, `app-defaults.json` regenerated.
- User-visible result: With focus at 7.2 and blur 0.3 by default, the globe is sharp when settled and soft while it is close to the camera during the entrance; both values can be keyframed for a rack focus.
- Verification: `tsc --noEmit` clean for product code; headless Chromium entrance strip and a close-up of the defocused start frame reviewed; slider re-render and a 4096x2304 PNG export verified by script; focused vitest run of schema, slider rules, labels and performance gate tests. A first attempt rendered black because `sample` is reserved in GLSL ES 3; renamed.
- Risks: The gather is 24 taps at full resolution; on a 2x backing at large blur this is the most expensive pass in the chain.

### Focused edit - video export

- Entry type: focused
- Change ID: gold-globe-video-export
- Request: "Add options to export video, but take into account the playback performance can be slow on some computers, is there a way to mitigat that?"
- Changed owner: `src/app/app-schema.ts` (`videoExportModule()` added after image export: Video Export section with Format MP4/WebM and Resolution Current/4K, and the runtime Export Video footer action), `src/app/app-acceptance-data.ts` (video intent `user-requested` with the verbatim quote "Add options to export video" and transcript message reference; rows for the two video settings and the video artifact; background row gains `video-background-preserved`; Video delivery inventory entry), `e2e/app-controls.spec.ts` (three video tests), `app-defaults.json` regenerated with the video settings.
- User-visible result: An Export Video button next to Export PNG, with format and resolution settings above the footer. Export renders every frame of the 12 s loop offline through the same `scene.rasterFrameRenderer` at the exact timeline time and encodes at 30 FPS, so a slow computer only makes the export take longer; the file is frame-accurate regardless of live playback speed.
- Verification: `tsc --noEmit` clean for product code; focused vitest run of schema, performance gate, export rules and intent, export artifact, background export, video settings, section cohesion and timeline playback tests.
- Risks: The runtime video path has not been exercised in a browser in this session (the protected browser proof cannot load in this generated copy); the image export path it shares was verified. Interpretation of the request: the user explicitly asked for video export options; the mitigation for slow playback is the runtime's offline frame-by-frame rendering, not a product-side recorder.

### Focused edit - stone finish comparison option

- Entry type: focused
- Change ID: gold-globe-stone-finish
- Request: "lets keep the current globe texture as an option, and add another option with more details, more spread marks, some smaller ones, less of a continuous spread. we want to be able to switch and compare to make a decision"
- Changed owner: `src/app/globe/assets/stone-rough.jpg` (second non-repeating 4K troweled-concrete photograph with short choppy strokes, generated with nanobanana), `globe-renderer.ts` (`stoneFinish` state; switching re-bakes the stone maps from the other photograph and swaps the material maps once ready, disposing the old ones), `globe-state.ts` (string-valued target), `app-schema.ts` (Material gains a Stone finish select: Smooth spread / Rough spread), `app-acceptance-data.ts` (select row with option coverage, Material inventory parameter selector), `e2e/app-controls.spec.ts`, `app-defaults.json` regenerated.
- User-visible result: A Stone finish selector in Material; Rough spread shows many small overlapping trowel marks and scraped patches, Smooth spread restores the long sweeps, so the two can be compared on the same lighting.
- Verification: `tsc --noEmit` clean for product code; headless Chromium side-by-side of both finishes at the settled frame plus a close-up of the rough finish; focused vitest run of schema, performance gate, applicability, section, label, segmented-fit and control-state tests.
- Risks: The re-bake takes about two seconds of main-thread CPU when the finish changes; it is not keyframeable.

### Focused edit - transaction beams

- Entry type: focused
- Change ID: gold-globe-transactions
- Request: "add animations of transactions happening between countries. where a beam of light goes from one country to another curved like a flight path ... the beam of light should have controllable intensity and shimmer ... the connected countries should be programmable, so we can provide in JS a json file of transactions ... add an animatable trigger to show/hide transactions ... The globe (gold) should reflect the light from the transaction beams."
- Changed owner: new `src/app/globe/countries.ts` (centroid table for the supplied country list), new `src/app/globe/transactions.json` (92 sample transactions: `from`, `to`, `time` in timeline seconds, optional `intensity`), new `src/app/globe/globe-transactions.ts` (great-circle arcs lifted like flight paths as thin tubes with an additive shader: head draws out over the first 45% of a 2.8 s life, holds, then the tail consumes the rest; a travelling pulse gives the shimmer; a fixed pool of eight point lights rides the brightest active heads so the gold reflects them), `globe-renderer.ts` (layer parented to the globe so it follows spin and position; render and export now receive the timeline time), `globe-canvas.tsx` (subscribes to timeline time), `globe-export.ts`, `globe-state.ts`, `app-schema.ts` (Transactions section: Show, Intensity, Shimmer), `app-acceptance-data.ts`, `e2e/app-controls.spec.ts`; the user's saved `app-defaults.json` was migrated in place by adding the three new values.
- User-visible result: Beams draw between countries at their timestamps, overlap freely, shimmer, glow through the bloom pass, and cast warm light on nearby gold; Show can be keyframed with step easing as a trigger; Intensity and Shimmer are keyframeable.
- Verification: `tsc --noEmit` clean for product code; headless Chromium frames at 3.5, 8, 14 and 20 s of the saved animation reviewed (first pass had the reflection lights far too strong; reduced); focused vitest run of schema, labels, sections, slider rules and performance gates.
- Risks: The JSON is a static import, so editing it needs a reload; timestamps beyond the loop duration never show. Eight simultaneous reflection lights is the cap; extra beams still glow but do not light the gold.

### Focused edit - beam endpoints on the terrain, correct country mapping, endpoint glows

- Entry type: focused
- Change ID: gold-globe-transactions-2
- Request: "the transaction beams start and stop above the surface of the globe ... the countries are not mapped correctly to the globe so there are transactions in the middle of the ocean ... The light on the start/end of the transaction beam appears and disappears without a transition, it should happen fast but smoothly fading in/out and scaling up/down"
- Changed owner: `src/app/globe/globe-transactions.ts` (country positions now go through the equirect uv and SphereGeometry's own vertex formula so they land on the baked map; arc endpoints take their radius from the baked height at each country, rebuilt when the maps or the relief scale change; additive glow sprites at origin and destination fade and scale in and out on smooth envelopes, and the reflection lights share those envelopes), `globe-bake.ts` (`sampleHeight` on the baked maps), `globe-renderer.ts` (feeds the surface sampler and displacement scale to the layer).
- User-visible result: Beams leave and land on the continents themselves; United States → Guatemala and Canada → Jamaica were checked on a frozen globe; endpoint lights bloom up and dim down smoothly.
- Verification: `tsc --noEmit` clean for product code; headless Chromium check at 18.25 s with the globe frozen facing the Americas, plus playing frames at 1.1, 2.2, 4.6 and 14 s; schema and worklog vitest files pass.
- Risks: Centroids are approximate; a country's beam lands at its centroid, not a capital.

### Focused edit - no endpoint discs on transaction beams

- Entry type: focused
- Change ID: gold-globe-transactions-3
- Request: "remove the circles from the start/end of the transaction beams, they're not looking good"
- Changed owner: `src/app/globe/globe-transactions.ts` (endpoint glow sprites removed; beams keep their smooth head spark and the reflection lights keep their fade envelopes).
- User-visible result: Beams begin and end directly on the terrain with no discs.
- Verification: `tsc --noEmit` clean for product code; frozen Americas check re-rendered at 18.25 s.
- Risks: None.

### Focused edit - Show as an on/off gate

- Entry type: focused
- Change ID: gold-globe-transactions-4
- Request: "instead of transaction show being a fade from 0 to 1 it should be a toggle on/off, when it's turned on the animations start, and when its turned off the current transactions finish and settle."
- Changed owner: `src/app/globe/globe-transactions.ts` (a transaction starts only if the toggle was on at its start time and then always runs to completion), `globe-renderer.ts` (`GlobeFrameContext` carries the timeline time plus the Show track's keyframes; `createShowAt` evaluates them as a step function, falling back to the live value when there are no keyframes; render reports the active beam count), `globe-state.ts` (`readShowSchedule`), `globe-canvas.tsx` (subscribes to keyframe groups, publishes `data-globe-beams`), `globe-export.ts`, `app-schema.ts` (Show is a two-position discrete slider, still keyframeable because keyframe capability is decided by control type; switches cannot be keyframed in this runtime).
- User-visible result: Keyframe Show to 1 and transactions begin starting from that moment; keyframe it to 0 and no new transactions start while the ones in flight finish and fade on their own. Scrubbing and export agree because the gate is evaluated from the keyframes, not from playback history.
- Verification: `tsc --noEmit` clean for product code; headless Chromium scenario (`.toolcraft/scratch/gold-globe/toggle.mjs`) with Show keyframed on at 0 s and off at 6 s: active beams 9 at 4 s, 6 at 7 s (9 without the gate; the three starting after 6 s are held back, the six started before 6 s finish), 0 at 9 s, matching the transaction JSON; `globe-show-gate.test.ts` covers the step evaluation; focused vitest run of schema, slider and marker rules, labels, naming and performance gates.
- Risks: A bezier-eased Show keyframe is still read as a threshold at 0.5; use step easing for a clean cut.

## Decisions

### Renderer

- Decision: Three.js WebGL renderer (`backend: "webgl"`, `provider: "three"`) with a displaced sphere, physically based materials, a camera-space studio rig (positional soft key with shadows, area sheen, fill and rim from the environment map) and post-processing; export reads the WebGL frame back into the runtime Canvas 2D context.
- Reason: The reference look needs metal reflections, real terrain displacement and a cinematic post chain; the vgpu Earth example gave none of those and its Toolcraft provider activation is blocked (see Delivery 1).
- Evidence: `src/app/globe/globe-renderer.ts`, `src/app/globe/globe-bake.ts`, `src/app/app-performance.ts`.

### View Interaction

- Decision: `timeline-camera` with explicit user-request authority.
- Reason: The user asked for a globe that is programmatically controlled into view and whose self-rotation is controllable so it can be animated.
- Evidence: `appProductReadiness.viewInteraction` quotes the request verbatim.

### Interaction Ownership

- Decision: Panel owns spin, camera yaw/pitch, and light position X/Y; runtime owns viewport, timeline, background, and export.
- Reason: Keyframeable exact values were requested; a canvas drag would mirror the same operation.
- Evidence: `appProductReadiness.interactionOwnership` linked to the matching slider acceptance rows.

### Timeline

- Decision: Keyframes mode with a 12 s product-derived loop.
- Reason: Every renderer input is a keyframeable slider so the reference rise-recede-spin sequence can be authored; the 3 s clip is a cut, not a loop.
- Evidence: `appTransferMode.animationIntent`, `timelineModule({ mode: "keyframes", defaultDurationSeconds: 12 })`.

### Layers

- Decision: No layers.
- Reason: One globe, no layer workflow requested.
- Evidence: `layersModule` is not composed.

### Controls

- Decision: Built-in sliders in Globe, Material, Camera, Light, and Grade sections; the mandatory Background section; `imageExportModule()` for format, resolution, and the export action.
- Reason: Every input is a bounded continuous value.
- Evidence: `src/app/app-schema.ts`, `appControlSectionInventory`.

### Export

- Decision: Runtime-default image export plus user-requested video export (MP4/WebM, Current/4K), both through one `scene.rasterFrameRenderer`.
- Reason: The user asked for video export options on 2026-09-16; frames are rendered offline at exact timeline times so playback speed cannot affect the file.
- Evidence: `appProductReadiness.exportIntent`, `videoExportModule()`, `scene.rasterFrameRenderer`.

### Performance

- Decision: One cache-free constant-cost render pass declared for preview and export, with the export resolution as the only workload dimension; no measured performance.
- Reason: Every control is a uniform or a transform; frame cost depends only on canvas backing and export size.
- Evidence: `src/app/app-performance.ts`.

## Evidence

- Source reviewed: the pulled vgpu Earth example, vgpu 0.5.0 docs and type definitions, the motion reference study, and the framework vgpu fixture.
- Contract applied: runtime owns background, timeline time, export encoding, and scene bounds; product supplies transparent foreground pixels, one GPU owner, and explicit frames.

## Verification

- `npx tsc -p tsconfig.json --noEmit`: product modules clean; the only diagnostic is in signed `src/toolcraft/ui/components/composites/command.tsx`.
- `npx vgpu check --require-validation` on `bake-surface.wgsl`, `globe.wgsl`, `composite.wgsl`: all valid.
- `vitest run src/app/app-performance.gates.test.ts src/app/app-performance.lifecycle.test.ts src/app/app-performance.fixture-helper.test.ts src/app/app-acceptance.renderer-provider.test.ts`: 57 passed.
- Manual browser inspection of `npm run dev` in Chrome: recorded in the final report.

## Risks

- Risk: The protected first-delivery gate cannot pass until the generated framework copy is regenerated (see Delivery 1 Risks and the Playwright Babel drift in the focused entry).
- Risk: WebGPU is required; browsers without it show the accessible unsupported state on the canvas.
- Risk: The vgpu path was abandoned for Three.js; the signed vgpu adapter incompatibility remains a framework issue for other products.
