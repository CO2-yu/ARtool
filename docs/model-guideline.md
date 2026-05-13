# Model Guideline

## Rhino to GLB Flow

Recommended flow:

1. Prepare the Rhino model in real-world units.
2. Remove or simplify unnecessary small details.
3. Convert repeated geometry to efficient instances where possible.
4. Export to a DCC tool or converter that can produce clean GLB/glTF.
5. Bake or assign lightweight PBR materials.
6. Compress textures before packaging.
7. Validate scale, origin, rotation, and file size on a real smartphone.

## Lightweight Rules

Simplify these details unless they are essential to sales explanation:

- Bolts
- Nuts
- Screw threads
- Tiny holes
- Small metal fittings
- Hidden backside details

Prefer silhouette and major functional shapes over manufacturing-level detail.

## Origin Rules

- Put the product's center or intended marker contact point near the model origin.
- The model should sit naturally above the marker plane after the package transform is applied.
- Avoid distant geometry from CAD leftovers.

## Unit Rules

- Treat the source model as real-world scale.
- Use meters as the runtime Three.js scale assumption.
- Package default scale should normally be `0.083333` for 1/12 exhibition display.
- Real-size mode should use `1.0` internally.

## Rotation Rules

- The model should face the expected visitor viewing direction when the marker card is upright.
- Correct fixed orientation in `package.json` `transform.rotation`.
- Use radians in runtime configuration.

## Texture Rules

- Use compressed, power-of-two texture dimensions where practical.
- Avoid unnecessarily large textures for plain industrial surfaces.
- Prefer a small number of shared materials.
- Bake complex visual detail into textures when geometry detail is too costly.

## Material Count Policy

Keep material count low. As a practical MVP target, aim for fewer than 10 materials per package unless there is a clear visual reason.

## Net and Mesh Surface Policy

Represent nets and dense mesh areas with surfaces plus texture/alpha detail where possible. Avoid modeling every wire or intersection unless the close-up sales scenario requires it and smartphone performance has been validated.

## Validation Checklist

- Model opens as GLB.
- Real-world scale is correct.
- 1/12 scale is visually stable on a 100 mm marker.
- Origin and rotation are correct.
- No hidden CAD debris remains.
- Animation clips, if any, play correctly.
- Smartphone FPS remains at or above 24 fps in the target exhibition environment.
