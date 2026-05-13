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

## Debug Mode

Open with `?debug=1`, or enable persistent debug mode:

```js
localStorage.setItem("webar.debug", "1")
```
