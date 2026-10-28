# Stage 1 — original kenchoo pigeon asset integration (2026-10-28)

## What was actually imported

Source GitHub asset mirror: https://github.com/water-melonie/Dating-Sim/tree/main/assets/models/pigeon

Original creator: kenchoo, ["Pigeon"](https://sketchfab.com/3d-models/pigeon-ddd5ef4a94eb4159937a9de25c45697c), CC BY 4.0.

Preserved, unmodified original:
- public/models/kenchoo/scene.gltf
- public/models/kenchoo/scene.bin
- public/models/kenchoo/textures/Material0-material_baseColor.png
- public/models/kenchoo/textures/Material0-material_metallicRoughness.png
- public/models/kenchoo/license.txt

The glTF contains 1 mesh, 1 material, 1 named Animation clip and a 63-node graph, per source GLTF inspection. Animation identity and visual quality require runtime review.

## Project changes

- `src/features/pigeon/pigeon-model.js` now loads **the original kenchoo .gltf** (with its real .bin and image textures) for normal pigeons.
- `src/features/pigeon/open-pigeon.js` adapts scale and supports whatever native animation clips exist; it does **not** invent additional rigged animation clips.
- The existing chicken pigeon v3 is preserved.
- A user-visible credit links to the original creator from the pigeon page.
- Existing /pudding app and deployment configuration are untouched.

## Run and verify

```bash
git fetch origin
git switch --track origin/feat/pigeon-kenchoo-original-20261028
npm ci
npm run build
npm run dev
```

Visit http://localhost:5173/pigeon . Check original 3D external model and texture rendering, compare to the supplied reference, inspect console/network for glTF, .bin and .png requests, test both normal and chicken. The model is now bundled in the branch; **no user-side manual asset download is needed**.

## Honesty / limitations

The connector verified file availability in the GitHub target branch and original glTF metadata. It did not execute a full Vite build or a browser/WebGL preview in the current runtime; so working 3D rendering, the appearance grade, and clip playback are **not yet verified**. Existing v3 walk/eat/fly clips cannot be assumed to retarget automatically to kenchoo's skeleton. Do not claim that realistic animation is complete.

This branch does not merge to master, deploy, or change production assets.
