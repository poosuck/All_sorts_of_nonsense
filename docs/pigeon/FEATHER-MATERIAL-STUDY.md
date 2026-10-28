# Feather material study — kenchoo original 3D pigeon

This branch changes **lighting/material response only**, not the original CC BY glTF, textures, skeleton or animation.

- Original skinning and animation graph preserved.
- Original atlas is used as albedo. Derived maps are computed in-browser at a maximum of 768px, without external network calls.
- High-frequency brightness differences create low-amplitude bump relief. Original artwork detail remains in the unchanged albedo.
- Green/violet pixel regions receive localized iridescence. The remainder uses matte feather roughness. The heuristic may classify unrelated green/violet pixels; the result requires visual review.
- The imported original glTF's strong emissive illumination is intentionally not passed to the new PBR material; the model now receives real scene lighting.
- Both derived texture maps and enhanced materials are released on scene disposal.

## Review
```bash
git fetch origin
git switch --track origin/feat/pigeon-feather-material-20261028
npm ci
npm run build
npm run dev
```
Visit http://localhost:5173/pigeon and inspect 45-degree, front, side, and turntable views. Compare against the earlier screenshot at the same angle. Review for over-shiny feet, unnatural neck color boundaries, shimmering pixels, black textures, UI errors, or changes to the original animation.

**Validation**: Source code committed, but not yet run with Vite/Playwright/WebGL in this tool environment. No claims of finished visual quality or FPS measurements. The goal reference remains substantially more detailed than this open model; shader work cannot replace missing feather geometry.

Source: `public/models/kenchoo/license.txt`, Pigeon by kenchoo, CC BY 4.0; original licensed files unchanged.
