# Pigeon chest and belly silhouette — 2026-10-28

**Target:** the user's supplied plump rock-pigeon photo. Make the original licensed kenchoo model more round-bodied WITHOUT scaling the head, feet, tail tips or replacing textures.

## Implementation
- `src/features/pigeon/pigeon-body-shape.js` makes independent skinned geometry copies for each bird and sculpts vertices in bind space. It uses the existing bone skin weights to identify chest and torso versus head, legs, neck and tail.
- At 82% (default) the belly and breast widen and round out. In the UI use "몸통 통통함" 0–100%, where 0% is the original shape. Geometry and adjusted normals update only on slider changes.
- The original GLTF, UV atlas, rig, animation, CC BY creator credit and texture are unmodified.
- This modifies the NORMAL kenchoo pigeon; chicken v3 remains unchanged.

## Review
```sh
git fetch origin
git switch --track origin/feat/pigeon-plump-silhouette-20261028
npm ci
npm test
npm run build
npm run dev
```
Open `http://localhost:5173/pigeon`. Compare 0, 60, 82 and 100 using front, side, three-quarter and rotating views.

**Acceptance criteria:** deeper and wider chest and rounded abdomen; eye, beak, toes and slender legs stay visibly intact; no detached wings, UV stretching or neck seams; animated postures remain stable; acceptable 60 FPS on target PC. If the preserved original vertex and bone topology causes deformation artifacts, dial back to 60% rather than attempting to hide them.

**Validation status:** Files were committed on GitHub, but a full Vite build and browser WebGL render have not been run in this session. The model's final silhouette needs screenshot review; this is not a claim that the reference target has been achieved.
