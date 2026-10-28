> 최신 기본 모델의 구조 재구성 및 검수 결과는 [REFERENCE-V4-REVIEW.ko.md](REFERENCE-V4-REVIEW.ko.md)를 참고하세요. 아래는 v4 이전 구현 기록입니다.

# Reference-style pigeon

Based on `feat/pigeon-plump-silhouette-20261028` (`5376796`), preserving the kenchoo model, skeleton, animation, and roundness control. The old master-based render experiment is not included.

1. Proportions: rounder, wider abdomen; reduced length expansion; thicker upper neck, slightly larger/lower head, shorter tail. Zero roundness restores original positions; feet are not moved by sculpting.
2. Texture: bind-space gray/lilac pigment replaces baked photographic body shadows and mottling. Original atlas remains for facial details; feet receive a muted pink. Small analytic scallops provide restrained tonal feather edges.
3. Coverts: thin rounded vanes on both wings, fitted to the source surface with ray intersections and interpolated skin weights. Two dark bands follow the feather columns. This is an added runtime surface, not an edit to the licensed source file.
4. Neck: localized green/violet pigment and reduced, neck-only iridescence; matte body and wings.
5. Light: warm directional key, cool fill and restrained environment illumination.

The supplied reference remains a visual target, not a claim of an exact match. The imported bird retains its original underlying topology and animation. The chicken variant remains the existing v3 model. Review side/front views, eye visibility, feather intersections, and animated wing seams.

Attribution: [Pigeon by kenchoo](https://sketchfab.com/3d-models/pigeon-ddd5ef4a94eb4159937a9de25c45697c), CC BY 4.0. Source files remain unchanged; runtime shape and material modifications are described above.

Validation: six unit-test files pass; production build passes. Chromium/SwiftShader rendered front, side and three-quarter views without console/page errors. Final smoke check also changes roundness 0 → 100 → 82 and switches walk/eat/fly/idle. This verifies rendering and controls, not real-time GPU performance or every animation pose. See `stylized-reference/side.png` for the final side view. Wing vanes remain a first-pass approximation of the reference and need artistic refinement.

## Second detail pass

Lighting is unchanged from the first pass. Rear torso compression and stronger vertical belly volume shorten the triangular silhouette; tail shortening is increased. Coverts are rebuilt as individual rounded, staggered vanes over an oval wing envelope. Per-vertex surface intersections interpolate both rig weights and source morph targets; the overlay shares the original morph influences. Two bind-space curved bands replace per-tile color assignment. The body uses filtered scallop edges and shallow normal relief rather than speckled pigment; facial details and feet are excluded from this relief.

The side preview is updated for this pass. Reference matching still depends on pose: the neutral standing bird is not forced into the supplied feeding pose.
