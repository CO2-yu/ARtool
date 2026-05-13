# Architecture

## Goals

The architecture separates UI, AR tracking, package loading, and model rendering. The MVP must be small enough for stable exhibition use while keeping the extension path clear for future sales tooling.

## Directory Structure

```text
project-root/
├── public/
│   ├── app.config.json
│   ├── assets/
│   └── packages/
│       ├── index.json
│       └── fence_a/
│           ├── model.glb
│           ├── marker.patt
│           ├── thumbnail.jpg
│           ├── package.json
│           └── description.md
├── src/
│   ├── ar/
│   ├── packages/
│   ├── renderer/
│   ├── state/
│   ├── ui/
│   ├── main.ts
│   ├── styles.css
│   └── types.ts
├── docs/
├── package.json
├── vite.config.ts
└── README.md
```

## Responsibility Split

### UI Layer

- Displays app state.
- Shows user-facing guidance and errors.
- Provides capture and animation controls.
- Does not know AR.js details.
- Does not parse package files directly.

### Package System

- Loads `app.config.json`.
- Loads `packages/index.json`.
- Loads package metadata on demand.
- Resolves all package asset paths relative to the package directory.
- Caches package metadata.
- Keeps package schema validation in one place.

### AR Layer

- Initializes camera, AR.js source, context, and marker controls.
- Owns marker registration.
- Emits marker-found and marker-lost events.
- Enforces marker tracking behavior through a small controller, not through UI code.

### Renderer Layer

- Owns Three.js scene, camera, renderer, lights, and animation loop.
- Loads GLB on demand.
- Caches loaded GLB source assets by package id.
- Creates per-marker model instances from cached source scenes.
- Owns AnimationMixer instances per marker.
- Hides marker models when tracking is lost.

### State Layer

- Defines app states and transitions.
- Keeps user-facing state text consistent.
- Allows debug UI to read state without owning state changes.

## Marker and Package Flow

1. App loads config and package index.
2. AR layer registers one marker root per package entry.
3. AR.js updates marker root visibility.
4. The app detects marker visibility transitions.
5. On marker found, the app checks the active marker limit.
6. The package metadata is loaded if needed.
7. The model is loaded if needed.
8. A cloned model instance is attached to that marker root.
9. On marker lost, the model instance is hidden.

## Multiple Marker Rules

- Active marker limit is three.
- `markerId` owns tracking state.
- `packageId` owns loading and GLB cache state.
- If three markers are already active, newly found markers are ignored.
- Existing visible models are not removed to make space for new markers.

## Path Policy

All config and asset paths are relative:

- `app.config.json`
- `packages/index.json`
- Package paths from `packages/index.json`
- Model, marker, thumbnail, and description paths from package metadata

No absolute deployment URL is embedded. GitHub Pages base path is controlled by Vite's relative `base: "./"` setting.

## Deployment Portability

GitHub Pages is the MVP deployment target. Vercel migration remains possible because:

- The app is a static Vite build.
- Runtime data lives under `public/`.
- No server-side persistence is required.
- No absolute public URL is required.
