# アーキテクチャ

## 概要

本システムは、AR.js + Three.js のマーカーARをメイン入口とし、`model-viewer` による通常3Dビューを補助ビューとして提供する。

起動直後はARモードを表示する。マーカーを認識した場合のみ、マーカー上にGLBモデルをAR表示し、同時に「3Dビューで見る」導線を有効化する。

## 責務分離

主要責務は次の単位に分ける。

- AR: カメラ初期化、マーカー認識、markerId管理
- Renderer: Three.jsシーン、GLBロード、モデルキャッシュ、AR空間表示
- PackageSystem: `app.config.json`、`packages/index.json`、各`package.json`の読み込み
- State: アプリ状態、エラー状態
- UI: Production UI / Development UI の表示切替
- Viewer: `model-viewer` による通常3D閲覧

AR処理本体にUI固有の描画ロジックを混ぜない。UIは共通の状態とコールバックを参照し、見た目だけを差し替える。

## UIモード

UIモードは `app.config.json` の `uiMode` で切り替える。

```json
{
  "uiMode": "development"
}
```

指定可能値:

- `development`: 開発中の標準UI。状態、ログ、操作ボタンを表示する。
- `production`: 来場者向けUI。技術情報を隠し、最小限の案内だけを表示する。

開発中は `development` を標準とする。本番展示時は `production` に切り替える。

実装上は `src/ui/ui-mode.ts` で判定を集約し、以下のUI実装を切り替える。

- `src/ui/development-ui.ts`
- `src/ui/production-ui.ts`

両UIは同じ `AppUiController` インターフェースを実装する。

## Development UI

Development UI は不具合追跡を優先する。

表示内容:

- 現在のモード
- camera permission 状態
- AR初期化状態
- tracking状態
- 認識中 markerId
- selectedPackageId
- active marker 数
- active model 数
- model loading 状態
- lastSeenAt
- lostTimeoutMs
- FPS
- エラーログ
- 簡易ログ
- 「3Dビューで見る」
- 「AR再初期化」
- 「キャッシュクリア」
- 「選択中モデルを非表示」

このUIは開発中の既定表示であり、見た目の完成度より状態観測と操作性を優先する。

## Production UI

Production UI は来場者向けの簡潔表示とする。

表示内容:

- ロゴ
- タイトル
- カメラ許可案内
- マーカー案内
- ロード中表示
- モデル名
- 撮影ボタン
- アニメーション再生停止
- マーカー認識後の「3Dビューで見る」

詳細な内部状態、エラー詳細、キャッシュ状態、FPSなどは表示しない。

## ディレクトリ構成

```text
project-root/
├── public/
│   ├── app.config.json
│   ├── draco/
│   └── packages/
│       ├── index.json
│       └── <package-id>/
│           ├── model.glb
│           ├── marker.patt
│           ├── marker.png
│           ├── marker-print.png
│           ├── package.json
│           └── description.md
├── src/
│   ├── ar/
│   ├── debug/
│   ├── packages/
│   ├── renderer/
│   ├── state/
│   ├── ui/
│   │   ├── development-ui.ts
│   │   ├── production-ui.ts
│   │   └── ui-mode.ts
│   ├── viewer/
│   ├── main.ts
│   ├── styles.css
│   └── types.ts
├── docs/
├── package.json
├── vite.config.ts
└── README.md
```

## ARフロー

ARは `/` または `/ar` で起動する。

1. `app.config.json` を読み込む。
2. `uiMode` を解決し、UIを生成する。
3. `packages/index.json` を読み込む。
4. カメラ許可を要求する。
5. AR.jsを初期化する。
6. マーカーを登録する。
7. markerIdを認識したら対応packageを読み込む。
8. GLBをオンデマンドロードし、キャッシュする。
9. マーカー上にモデルを表示する。
10. 最後に認識したpackageを `selectedPackageId` としてUIへ反映する。

## Viewerフロー

Viewerは `/viewer?package=<packageId>` で起動する。

`model-viewer` はnpm importせず、HTML側でCDNからWeb Componentとして読み込む。通常3Dビューは製品閲覧の補助ビューであり、AR起動時の初期画面にはしない。

## 複数マーカー

AR空間では最大3モデルまで表示する。上限を超えた新規マーカーは、いったん無視し、既存モデルを勝手に消さない。

操作UIは1つだけ表示し、最後に認識したmarkerIdのpackageIdを `selectedPackageId` として扱う。

## パス方針

絶対URLはハードコードしない。ViteはGitHub Pages対応のため `base: "./"` を使用する。パッケージ内アセットは `package.json` から相対パスで解決する。
