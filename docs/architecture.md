# アーキテクチャ

## 概要

本システムは、既存のAR.js + Three.js構成を破棄せず、`model-viewer` による通常3Dビューを追加した二段構え構成とする。

責務は以下に分離する。

- Viewer: 通常3Dビュー
- AR: マーカーARビュー
- PackageSystem: パッケージ読み込みとパス解決
- UI: 画面別UI
- State: 画面状態と選択状態

## 画面責務

### Viewer

`/viewer` が担当する。

- `model-viewer` によるGLB表示
- ピンチ、回転、ズーム、慣性操作
- アニメーション再生
- スケールスライダー
- 製品説明表示
- `/ar?package=xxx` への遷移

Viewerは営業ツール化の中心画面とする。

### AR

`/ar` が担当する。

- AR.js + Three.js初期化
- markerId認識
- packageId特定
- 情報パネル表示
- ユーザー操作後のAR空間表示
- `/viewer?package=xxx` への遷移

ARは「製品認識入口 + ARデモ」として扱う。

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
│   ├── viewer/
│   ├── main.ts
│   ├── styles.css
│   └── types.ts
├── docs/
├── package.json
├── vite.config.ts
└── README.md
```

## PackageSystem

PackageSystemは両画面共通で使う。

担当:

- `app.config.json` 読み込み
- `packages/index.json` 読み込み
- `package.json` 読み込み
- packageIdからpackageへの解決
- パッケージ内相対パスの解決
- メタデータキャッシュ

PackageSystemは `model-viewer` やAR.jsの詳細を知らない。

## Viewer構成

Viewerは `model-viewer` Web Component を使う。

初期化手順:

1. `package` query parameterを読む。
2. PackageSystemで対象パッケージを読む。
3. `model.path` を相対URL解決する。
4. `model-viewer.src` に設定する。
5. `scale` と `ui` 設定からスライダーを初期化する。
6. 製品名、説明、AR遷移ボタンを表示する。

## AR構成

ARは既存のAR.js + Three.js構成を維持する。

ただし、AR.jsが制御するmarker rootと、表示維持用のdisplay rootを分離する。

- `marker.root`: AR.jsが更新する検出用root
- `marker.displayRoot`: アプリが表示維持するroot

マーカー検出時は `marker.root.matrixWorld` を `displayRoot` へコピーする。マーカー喪失猶予中は `displayRoot` を最後の姿勢で表示維持する。

## AR情報パネル

ARビューでは、マーカー認識直後にGLBを即表示しない。まず情報パネルを表示する。

情報パネルの状態:

- `selectedPackageId`
- `selectedMarkerId`
- `selectedPackage`

最後に認識したマーカーが選択対象になる。

「ARで表示する」を押すと、そのpackageIdのGLBをAR空間へロードして表示する。

## State

Stateは画面共通のアプリ状態と、画面固有状態を分ける。

共通状態:

- `BOOTING`
- `LOADING_CONFIG`
- `READY`
- `ERROR`

Viewer固有:

- `LOADING_MODEL`
- `VIEWING`

AR固有:

- `WAIT_CAMERA_PERMISSION`
- `TRACKING`
- `LOADING_MODEL`

## パス方針

絶対URLはハードコードしない。

- Viteは `base: "./"` を使う。
- packageIdはquery parameterで渡す。
- パッケージ内のアセットは `package.json` から相対解決する。

## 既存コードを壊さないための方針

- AR.js + Three.js関連処理はARモードに閉じ込める。
- PackageSystemは既存を拡張して再利用する。
- Viewerは新規モジュールとして追加する。
- `package.json` の互換性を維持し、旧 `model.path` も読めるようにする。
