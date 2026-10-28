import * as THREE from "three";

// The licensed atlas remains loaded only for small facial/foot details.
// Body pigment is evaluated in bind space so baked photographic shadows disappear.
export function enhancePigeonPlumage(root) {
  const replacements = new Map(), assignments = [];
  root.traverse(object => {
    if (!object.isMesh || !object.material) return;
    const originals = object.material;
    assignments.push([object, originals]);
    const materials = [originals].flat().map(original => {
      if (replacements.has(original)) return replacements.get(original);
      const material = new THREE.MeshPhysicalMaterial({
        name: "Reference pigeon · matte plumage",
        map: original.map, side: original.side,
        transparent: original.transparent, alphaTest: original.alphaTest,
        color: '#ffffff', roughness: .86, metalness: 0,
        sheen: .24, sheenColor: new THREE.Color('#d4c4cb'), sheenRoughness: .85,
        iridescence: .34, iridescenceIOR: 1.3,
        iridescenceThicknessRange: [220, 380], envMapIntensity: .35,
      });
      material.onBeforeCompile = shader => {
        shader.vertexShader = 'varying vec3 vPlumagePosition;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlumagePosition = position;');
        shader.fragmentShader = 'varying vec3 vPlumagePosition;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
          #include <color_fragment>
          vec3 p = vPlumagePosition;
          float head = smoothstep(.45, .55, p.y);
          float neck = smoothstep(.32, .43, p.y) * (1.0 - smoothstep(.47, .54, p.y)) * smoothstep(-.03, .10, p.z);
          vec3 pigment = mix(vec3(.33, .31, .34), vec3(.25, .29, .35), head);
          vec3 throat = mix(vec3(.29, .18, .33), vec3(.16, .33, .30), smoothstep(.38, .48, p.y));
          pigment = mix(pigment, throat, neck * .85);
          // Rounded scallops run down the chest; neck feathers are smaller.
          float size = mix(85.0, 180.0, max(neck, head));
          vec2 grid = vec2(atan(p.x, p.z + .04) * .11, p.y) * size;
          float row = floor(grid.y);
          vec2 cell = vec2(fract(grid.x + mod(row, 2.0) * .5), fract(grid.y));
          float edge = abs(cell.y - (.23 + .48 * pow(abs(cell.x - .5) * 2.0, 2.0)));
          float seam = 1.0 - smoothstep(.025, .095, edge);
          pigment *= 1.0 - seam * mix(.13, .20, neck);
          float tail = 1.0 - smoothstep(-.29, -.18, p.z);
          pigment = mix(pigment, vec3(.15, .17, .21), tail * .75);
          // Preserve the original eyes, beak and cere, but remove its mottled body atlas.
          float face = smoothstep(.46, .52, p.y);
          float feet = (1.0 - smoothstep(.09, .125, p.y)) * smoothstep(-.14, -.06, p.z);
          vec3 detail = mix(diffuseColor.rgb, vec3(.52, .19, .15), feet * .80);

          diffuseColor.rgb = mix(pigment, detail, max(face, feet));
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
          #include <roughnessmap_fragment>
          roughnessFactor = mix(.88, .56, neck);
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_fragment>', `
          #include <lights_physical_fragment>
          #ifdef USE_IRIDESCENCE
            material.iridescence *= neck;
          #endif
        `);
      };
      material.customProgramCacheKey = () => 'pigeon-stylized-reference-1';
      replacements.set(original, material);
      return material;
    });
    object.material = Array.isArray(originals) ? materials : materials[0];
  });
  return () => {
    for (const [object, originals] of assignments) object.material = originals;
    for (const material of replacements.values()) material.dispose();
  };
}
