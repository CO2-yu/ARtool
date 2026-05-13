# Deployment

## GitHub Pages

The MVP is deployed as a static Vite app.

Build command:

```bash
npm run build
```

Preview command:

```bash
npm run preview
```

The Vite base path is set to `./` so the app can run from a GitHub Pages project subpath without hardcoded absolute URLs.

## HTTPS Requirement

Camera access requires HTTPS on deployed environments. GitHub Pages satisfies this requirement when HTTPS is enabled for the repository page.

Local development can use Vite's dev server. Browser behavior for camera access may vary by device and browser.

## Static Asset Policy

Runtime files live under `public/`:

- `public/app.config.json`
- `public/packages/index.json`
- `public/packages/<package-id>/package.json`
- `public/packages/<package-id>/model.glb`
- `public/packages/<package-id>/marker.patt`

The app must not depend on a server API for the MVP.

## Vercel Migration

The app can move to Vercel as a static deployment because:

- Build output is static.
- Asset paths are relative.
- Capture is local to the browser.
- Package metadata is loaded as static JSON.

No code change should be required if the static output directory is served correctly.
