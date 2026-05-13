# Requirements

## Purpose

This WebAR viewer provides a smartphone-first AR experience for exhibitions. A visitor opens the app from a shared QR code, points the camera at a black-frame AR marker card, and sees the corresponding existing 3D product model.

The MVP prioritizes stable exhibition operation over rich sales features. The structure must still allow future sales-tool expansion without changing the model package format.

## Core Requirements

- Run on GitHub Pages over HTTPS.
- Use relative paths only for config, packages, and assets.
- Use TypeScript, Vite, Three.js, AR.js, HTML, and CSS.
- Use black-frame AR markers, with a standard physical marker card size of 100 mm x 100 mm.
- Keep the QR code and AR marker separate.
- Use one marker card per product.
- Identify models from the AR marker, not from the QR code.
- Load package metadata and GLB models on demand.
- Cache loaded GLB scenes by package id.
- Support up to three simultaneously tracked markers.
- Ignore newly detected markers when the active marker limit is reached.
- Do not remove existing models automatically when the limit is exceeded.
- Hide a model when its marker is lost.
- Do not use spatially fixed AR after marker loss.
- Detect AnimationClips from GLB and show animation controls only when clips exist.
- Auto-play animation when a model appears.
- Support play and pause in the MVP.
- Provide still-image capture only.
- Hide UI while capturing.
- Show a capture preview and delegate saving to the device/browser.
- Do not store captured images in the app or on a server.
- Separate normal mode from debug mode.

## Initial State Model

The start screen is an overlay state display, not a separate static page.

Required states:

- `BOOTING`
- `LOADING_CONFIG`
- `WAIT_CAMERA_PERMISSION`
- `READY`
- `TRACKING`
- `LOADING_MODEL`
- `ERROR`

## Loading Flow

At startup:

- Load `app.config.json`.
- Load `packages/index.json`.
- Render only lightweight UI.
- Initialize AR after camera permission becomes available.

On marker recognition:

- Load the matching package `package.json`.

On model display:

- Load `model.glb` on demand.
- Reuse cached model assets for repeated package use.

## UI Requirements

The UI must stay minimal for exhibition use:

- Logo
- Title
- Camera permission guidance
- Marker guidance
- Loading display
- Model name
- Capture button
- Animation play/pause button

Scale controls are hidden in the initial MVP. The internal package format still supports miniature and real-size presets.

## Error Policy

User-facing errors must be short and non-technical.

Do not show:

- Stack traces
- WebGL internals
- Internal exception details

Developer details go to `console.error`.

## Acceptance Criteria

- GitHub Pages build works.
- App runs in HTTPS environments.
- Smartphone camera can start.
- 100 mm square marker can be recognized.
- GLB model is displayed.
- Initial display scale is 1/12.
- Up to three markers can be active.
- Marker loss hides the model.
- Loading overlay appears.
- Still-image capture works.
- Packages are controlled by `package.json`.
- Models load on demand.
- Loaded models are cached.
- AnimationClip presence is detected.
- Animation can be played and paused.
- Debug mode is separated from normal user flow.
