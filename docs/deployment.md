# デプロイ

## GitHub Pages

MVPは静的なViteアプリとしてデプロイする。

ビルドコマンド:

```bash
npm run build
```

プレビューコマンド:

```bash
npm run preview
```

Viteの `base` は `./` に設定する。これにより、GitHub Pagesのプロジェクトサブパス配下でも絶対URLをハードコードせずに動作させる。

## HTTPS要件

カメラアクセスにはHTTPSが必要である。GitHub PagesではリポジトリページのHTTPSを有効化することでこの要件を満たせる。

ローカル開発ではViteのdev serverを使用する。ただし、スマートフォンやブラウザによってカメラ許可の挙動が異なる可能性があるため、実機検証を必須とする。

## 静的アセット方針

実行時に読み込むファイルは `public/` 配下に置く。

- `public/app.config.json`
- `public/packages/index.json`
- `public/packages/<package-id>/package.json`
- `public/packages/<package-id>/model.glb`
- `public/packages/<package-id>/marker.patt`

MVPではサーバーAPIに依存しない。

## Vercel移行

以下の理由により、将来的にVercelへ静的デプロイとして移行できる。

- ビルド成果物が静的ファイルのみで構成される。
- アセットパスが相対パスである。
- 撮影データはブラウザ内で扱い、サーバー保存しない。
- パッケージメタデータは静的JSONとして読み込む。

静的配信先のルートが正しく設定されていれば、原則としてアプリコードの変更は不要とする。
