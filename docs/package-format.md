# Package Format

## Overview

Each product is managed as a model package. A package contains marker data, GLB model data, display transform settings, animation settings, and UI metadata.

```text
public/packages/
└── fence_a/
    ├── model.glb
    ├── marker.patt
    ├── thumbnail.jpg
    ├── package.json
    └── description.md
```

## Package Index

`public/packages/index.json` lists packages available to the app.

```json
{
  "schemaVersion": 1,
  "packages": [
    {
      "id": "fence_a",
      "name": "Fence A",
      "path": "fence_a/package.json",
      "marker": {
        "id": "fence_a_marker",
        "path": "fence_a/marker.patt",
        "type": "pattern",
        "physicalSizeMm": 100
      }
    }
  ]
}
```

Paths are relative to `public/packages/index.json`. The index intentionally includes only marker registration metadata so the app can initialize AR without loading every package file or GLB.

## package.json

```json
{
  "schemaVersion": 1,
  "id": "fence_a",
  "name": "Fence A",
  "description": "Exhibition sample model.",
  "model": {
    "path": "model.glb",
    "format": "glb"
  },
  "marker": {
    "id": "fence_a_marker",
    "path": "marker.patt",
    "type": "pattern",
    "physicalSizeMm": 100
  },
  "transform": {
    "position": [0, 0, 0],
    "rotation": [0, 0, 0],
    "scale": [1, 1, 1]
  },
  "scale": {
    "default": 0.083333,
    "min": 0.02,
    "max": 1.0,
    "step": 0.01,
    "presets": {
      "miniature": {
        "label": "1/12",
        "value": 0.083333
      },
      "real": {
        "label": "Real",
        "value": 1.0
      }
    }
  },
  "animation": {
    "autoPlay": true,
    "defaultClip": null
  },
  "ui": {
    "showScaleControls": false,
    "thumbnail": "thumbnail.jpg"
  }
}
```

## Versioning

`schemaVersion` is required. Breaking schema changes must increment the version and be handled in the package loader.

## Scale Policy

The default MVP scale is `0.083333` for 1/12 display. The scale object is structured for future linear controls:

- `default`: initial display scale
- `min`: lower slider/input bound
- `max`: upper slider/input bound
- `step`: linear adjustment unit
- `presets`: named scale presets

The MVP hides scale controls, but the renderer reads the package scale value.

## Animation Policy

Animation data lives in the GLB. Package metadata only describes app behavior:

- auto-play enabled or disabled
- optional default clip name
- future clip switching metadata

If a GLB has no `AnimationClip`, animation UI is hidden.
