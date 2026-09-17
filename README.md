# WebAR Exhibition Viewer

Smartphone-first WebAR viewer for exhibition marker cards.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Runtime Data

- App config: `public/app.config.json`
- Package index: `public/packages/index.json`
- Product package: `public/packages/<package-id>/package.json`

Replace the demo package marker and model with production AR.js marker patterns and optimized GLB/glTF assets.

## Marker Tracking Tuning

Marker tracking behavior is configured under `app.ar` in `public/app.config.json`.

- `minConfidence`: AR.js pattern-match confidence threshold. Lower values tolerate more oblique or imperfect views, but values that are too low can increase false recognition.
- `thresholdMode`: image binarization mode. `auto_adaptive` is the current default for better tolerance of uneven exhibition lighting and reflections.
- `smooth`: enables AR.js pose smoothing.
- `smoothCount`, `smoothTolerance`, `smoothThreshold`: tune the trade-off between pose stability and responsiveness.
- `lostTimeoutMs`: application-side grace period before a briefly lost marker is hidden. This masks short dropouts but does not improve recognition itself.

The current baseline favors handheld exhibition use: `minConfidence` is intentionally lower than the AR.js default, smoothing is light, and marker loss has a short grace period. Validate changes on the actual printed marker and target smartphones before deployment.

## Debug Mode

Open with `?debug=1`, or enable persistent debug mode:

```js
localStorage.setItem("webar.debug", "1")
```
