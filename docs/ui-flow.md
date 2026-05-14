# UIフロー

## 基本方針

起動後はARモードから開始する。`model-viewer` の通常3Dビューは補助ビューであり、起動画面にはしない。

開発中の標準表示は Development UI とする。本番向けの表示は Production UI として残し、`app.config.json` の `uiMode` で切り替える。

## UIモード切替

```json
{
  "uiMode": "development"
}
```

指定可能値:

- `development`: 状態、ログ、開発用操作を表示する。
- `production`: 来場者向けに簡潔な案内だけを表示する。

UIモード判定は `src/ui/ui-mode.ts` に集約する。AR、Renderer、PackageSystemはUIモードを直接判断しない。

## AR起動フロー

1. アプリ起動
2. `app.config.json` 読み込み
3. `uiMode` 解決
4. Development UI または Production UI を生成
5. カメラ許可案内を表示
6. AR.jsのカメラ画面を表示
7. マーカー認識待ち

マーカー未認識時は「3Dビューで見る」導線を無効または非表示にする。

## マーカー認識後

1. markerIdを認識する。
2. markerIdからpackageIdを特定する。
3. 対応する `package.json` を読み込む。
4. GLBをオンデマンドロードする。
5. マーカー上にGLBモデルをAR表示する。
6. `selectedPackageId` を最後に認識したpackageIdで更新する。
7. 「3Dビューで見る」ボタンを有効化する。

「3Dビューで見る」を押した場合のみ、次のURLへ遷移する。

```text
/viewer?package=<selectedPackageId>
```

## Development UI

Development UI は不具合追跡用の標準UIである。

表示する状態:

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

表示する操作:

- 3Dビューで見る
- AR再初期化
- キャッシュクリア
- 選択中モデルを非表示
- 撮影
- アニメーション再生停止

「3Dビューで見る」は `selectedPackageId` が存在する場合のみ有効にする。

## Production UI

Production UI は展示会来場者向けのUIである。

表示する内容:

- ロゴ
- タイトル
- カメラ許可案内
- マーカー案内
- ロード中表示
- モデル名
- 撮影ボタン
- アニメーション再生停止
- マーカー認識後の「3Dビューで見る」

以下は表示しない。

- FPS
- markerId
- packageId
- キャッシュ状態
- 内部エラー詳細
- WebGL詳細

## 複数マーカー時のUI

AR空間では最大3モデルまで表示する。

操作パネルは1つだけ表示し、最後に認識したmarkerIdのpackageIdで上書きする。このpackageIdを `selectedPackageId` とし、「3Dビューで見る」は常に `selectedPackageId` を対象にする。

## 撮影時

撮影時はUIを一時的に隠し、カメラ映像とThree.jsレンダリング結果を合成して静止画プレビューを表示する。

保存は端末標準機能へ委譲し、アプリ内部保存とサーバー保存は行わない。
