# パッケージ形式

## 概要

各製品は「モデルパッケージ」として管理する。パッケージには、マーカー、GLB/glTFモデル、表示変換、アニメーション方針、UI用メタデータを含める。

```text
public/packages/
└── fence_a/
    ├── model.glb
    ├── marker.patt
    ├── thumbnail.jpg
    ├── package.json
    └── description.md
```

## パッケージインデックス

`public/packages/index.json` はアプリが扱うパッケージ一覧を持つ。

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

パスは `public/packages/index.json` からの相対パスとする。インデックスにはAR初期化に必要な最小限のマーカー情報だけを持たせる。これにより、起動時に全パッケージの `package.json` やモデルを読み込まずに済む。

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
    "showScaleControls": false,
    "thumbnail": "thumbnail.jpg"
  }
}
```

## バージョン管理

`schemaVersion` は必須とする。破壊的な形式変更を行う場合はバージョンを上げ、Package System側で明示的に扱う。

## スケール方針

MVPの初期表示スケールは `0.083333`、つまり1/12とする。将来的なリニア変更UIに対応するため、scaleは以下の構造を持つ。

- `default`: 初期表示スケール
- `min`: 入力またはスライダーの下限
- `max`: 入力またはスライダーの上限
- `step`: 線形調整単位
- `presets`: 名前付きスケールプリセット

MVPではスケールUIを非表示にするが、Rendererは `scale.default` を読み取って表示に反映する。

## アニメーション方針

アニメーションデータ自体はGLB/glTF側に持たせる。パッケージメタデータはアプリ側の振る舞いだけを表す。

- 自動再生の有無
- 初期Clip名
- 将来的なClip切替用メタデータ

GLB/glTFに `AnimationClip` が存在しない場合、アニメーションUIは表示しない。
