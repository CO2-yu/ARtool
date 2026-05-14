# パッケージ形式

## 概要

`package.json` は通常3DビューとARビュー共通の単一データソースである。モデル、マーカー、表示変換、スケール、アニメーション、UI設定を1つのパッケージで管理する。

## パッケージ構成

```text
public/packages/<package-id>/
├── model.glb
├── marker.patt
├── marker.png
├── marker-print.png
├── thumbnail.jpg
├── package.json
└── description.md
```

## パッケージインデックス

`public/packages/index.json` はAR初期化に必要な最小限のマーカー情報と、パッケージJSONへのパスを持つ。

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
        "image": "fence_a/marker.png",
        "type": "pattern",
        "physicalSizeMm": 100
      }
    }
  ]
}
```

## package.json

```json
{
  "schemaVersion": 1,
  "id": "fence_a",
  "name": "Fence A",
  "description": "展示会向けサンプルモデル",
  "model": {
    "path": "model.glb",
    "format": "glb"
  },
  "marker": {
    "id": "fence_a_marker",
    "path": "marker.patt",
    "image": "marker.png",
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
        "label": "実寸",
        "value": 1.0
      }
    }
  },
  "animation": {
    "autoPlay": true,
    "defaultClip": null
  },
  "ui": {
    "thumbnail": "thumbnail.jpg",
    "enablePinchScale": true,
    "showScaleSlider": true
  }
}
```

## 共有項目

両画面で共有する項目:

- `model.path`
- `model.format`
- `name`
- `description`
- `scale`
- `animation`
- `ui.thumbnail`
- `transform`

## model

`model.path` はパッケージディレクトリからの相対パスとする。MVPではGLBを推奨する。

互換性のため、既存の `model.path` / `model.format` 形式を維持する。将来的に `model.file` へ移行する場合は、PackageSystemで両方を読めるようにしてから移行する。

## scale

`scale` はViewerとARの両方で使う。

- Viewer: スライダー初期値、範囲、刻み幅として使う。
- AR: MVPでは `scale.default` を初期表示倍率として使う。

## ui

`ui` は画面表示方針を持つ。

- `thumbnail`: サムネイル画像
- `enablePinchScale`: ピンチスケール操作の有効/無効
- `showScaleSlider`: スケールスライダー表示の有効/無効

## animation

アニメーション本体はGLB内に持たせる。アプリ側は以下のみ扱う。

- 自動再生
- 停止
- 初期Clip選択

`AnimationClip` が存在しない場合、アニメーションUIは表示しない。
