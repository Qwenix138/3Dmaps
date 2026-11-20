# Blender

1. Import `*.glb`: **File → Import → glTF 2.0**.
2. A grey object means Solid mode. Press `Z` and choose **Material Preview**.
3. Labels and map linework are baked into the texture; buildings, roads and railways are separate geometry.
4. If objects are missing, check `counts.buildings` and `counts.roads` in `meta.json` and import the new GLB.
5. If the model is not visible: `Numpad .` (Frame Selected), then increase **Clip End** in view settings.

OBJ: `X` east, `Y` north, `Z` up. GLB: `X` east, `Y` up, `Z` south.
