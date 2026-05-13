# アーキテクチャ

## 目的

本アーキテクチャでは、UI、ARトラッキング、パッケージ読み込み、3D描画の責務を分離する。MVPでは展示会で安定動作する軽量構成を優先しつつ、将来的な営業ツール化に向けて拡張しやすい境界を残す。

## ディレクトリ構成

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

## 責務分離

### UI層

- アプリ状態を表示する。
- ユーザー向け案内とエラーを表示する。
- 撮影ボタンとアニメーション操作を提供する。
- AR.jsの詳細を知らない。
- パッケージJSONを直接解釈しない。

### Package System層

- `app.config.json` を読み込む。
- `packages/index.json` を読み込む。
- マーカー認識時にパッケージメタデータを読み込む。
- パッケージ内アセットの相対パスを解決する。
- パッケージメタデータをキャッシュする。
- パッケージスキーマの検証を一箇所に集約する。

### AR層

- カメラ、AR.js source、context、marker controlsを初期化する。
- マーカー登録を担当する。
- marker found / marker lost 相当の状態変化を扱う。
- UIではなくAR制御側でトラッキング状態を管理する。

### Renderer層

- Three.jsのscene、camera、renderer、light、animation loopを管理する。
- GLB/glTFをオンデマンドで読み込む。
- 読み込み済みモデルをpackageId単位でキャッシュする。
- キャッシュ済みモデルからmarkerId単位の表示インスタンスを生成する。
- markerId単位のAnimationMixerを管理する。
- マーカー喪失時に該当モデルを非表示にする。

### State層

- アプリ状態と状態遷移を定義する。
- ユーザー向け状態表示を一貫させる。
- デバッグUIが状態を参照できるようにする。

## マーカーとパッケージの流れ

1. アプリが設定とパッケージインデックスを読み込む。
2. AR層がパッケージインデックス内のマーカー情報を登録する。
3. AR.jsがマーカーrootの表示状態を更新する。
4. アプリがマーカー表示状態の変化を検出する。
5. マーカー認識時、同時表示上限を確認する。
6. 必要に応じて `package.json` を読み込む。
7. 必要に応じてモデルを読み込む。
8. 読み込んだモデルインスタンスをマーカーrootへ追加する。
9. マーカー喪失時、モデルインスタンスを非表示にする。

## 複数マーカー方針

- 同時アクティブマーカー数は最大3とする。
- `markerId` 単位でトラッキング状態を管理する。
- `packageId` 単位で読み込み状態とモデルキャッシュを管理する。
- 3件アクティブな状態で新規マーカーを認識した場合、その新規認識を無視する。
- 既存表示モデルを削除して新規モデルを優先することはしない。

## パス方針

すべての設定とアセットパスは相対パスで扱う。

- `app.config.json`
- `packages/index.json`
- `packages/index.json` 内のパッケージパス
- `package.json` 内のmodel、marker、thumbnail、descriptionパス

デプロイ先の絶対URLは埋め込まない。GitHub Pagesのサブパス対応はViteの `base: "./"` で行う。

## デプロイ移植性

MVPのデプロイ先はGitHub Pagesとする。将来的にVercelへ移行しやすい理由は以下。

- Viteの静的ビルドで完結する。
- 実行時データは `public/` 配下にある。
- サーバー保存やAPIを必要としない。
- 公開URLのハードコードがない。
