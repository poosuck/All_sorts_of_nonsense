# Free-license pigeon model integration

Branch: feat/pigeon-open-asset-20261028

Status: Code connected, binary NOT downloaded, browser rendering NOT validated.

To use a legitimately obtained CC0 Urban Pigeon GLB:

```bash
npm ci
npm run pigeon:install -- "C:/Users/username/Downloads/urban-pigeon.glb" urban
npm run dev
```

Open http://localhost:5173/pigeon . The normal pigeon should load the installed external model; the chicken pigeon continues using v3.

For the Creative Commons Attribution kenchoo model, pass 'kenchoo' instead of 'urban' and display artist credits and any required adaptation notice in a deployed site.

The installer validates binary GLB 2.0 header and writes public/models/pigeon-open.glb and public/models/pigeon-open.json. It cannot itself verify provenance or license; confirm the asset came from the cited creator and model page.

Sources:
- Urban Pigeon CC0: https://www.innerscene.com/tools/library/3d-parts/urban-pigeon-3977bbba
- kenchoo Pigeon CC BY 4.0: https://sketchfab.com/3d-models/pigeon-ddd5ef4a94eb4159937a9de25c45697c

Source modules: src/features/pigeon/open-pigeon.js, src/features/pigeon/pigeon-model.js, scripts/install-pigeon-open.mjs.

Limitations: external GLB could not be fetched in this session due to restricted DNS; no actual replacement binary was committed. New visuals cannot be claimed yet. Animation skeletons and model quality are model-dependent. Run npm test, npm run build and Playwright tests before merging. No deployment has been performed.