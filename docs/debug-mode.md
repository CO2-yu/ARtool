# Debug Mode

## Goal

Debug mode exposes developer diagnostics without making them easy for exhibition visitors to open accidentally.

## Entry Methods

The app supports layered debug activation:

- Dedicated query parameter: `?debug=1`
- Persistent local flag: `localStorage.setItem("webar.debug", "1")`

Disable persistent debug mode:

```js
localStorage.removeItem("webar.debug")
```

## Normal User Separation

Normal QR codes should not include `debug=1`. Debug URLs should be shared only with operators and developers.

## Debug Data

Debug mode may show:

- FPS
- app state
- package id
- marker id
- marker tracking state
- package loading state
- model cache state
- latest user-facing error
- developer error detail summary

## Error Handling

Normal UI shows only short user-facing errors. Debug mode may show more detail, but full stack traces should remain in `console.error` unless actively needed during development.
