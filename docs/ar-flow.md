# ARフロー

## 役割

AR.jsは以下を担当する。

- markerId認識
- packageId特定
- AR空間への配置
- ARデモ表示

アプリ起動時はARビューを表示する。`/viewer` の `model-viewer` はマーカー認識後に選択できる補助ビューである。

## 初期化

1. `app.config.json` を読み込む。
2. `packages/index.json` を読み込む。
3. AR.js source/contextを初期化する。
4. index内のmarker情報を登録する。
5. カメラ映像を表示する。

## マーカー認識

1. AR.jsがmarker rootを更新する。
2. markerIdからpackageIdを特定する。
3. `selectedPackageId` を更新する。
4. package metadataを読み込む。
5. GLBをAR空間へ表示する。
6. 情報パネルを表示する。

## AR表示

マーカー認識後:

1. 対象packageのGLBをオンデマンドで読み込む。
2. GLBをpackageId単位でキャッシュする。
3. markerId単位の表示インスタンスを作る。
4. `displayRoot` へアタッチする。

## marker root と display root

AR.jsが直接更新するrootと、アプリが表示維持するrootを分ける。

- `marker.root`: AR.js管理
- `marker.displayRoot`: アプリ管理

マーカー検出中は `marker.root.matrixWorld` を `displayRoot` へコピーする。マーカーを一時的に見失った場合は、`lostTimeoutMs` の範囲内で最後の姿勢を維持する。

## 複数マーカー

- AR空間上の最大表示数は3。
- 上限超過時、新規表示は無視する。
- 情報パネルは1つのみ。
- 最後に認識したマーカーのpackageIdを `selectedPackageId` とする。
- 「3Dビューで見る」ボタンは `selectedPackageId` を対象にする。

## マーカー喪失

- 1フレーム見失っただけでは非表示にしない。
- `lastSeenAt` をmarkerId単位で保持する。
- `performance.now() - lastSeenAt > lostTimeoutMs` の場合のみ喪失扱いにする。
- 喪失後は該当モデルを非表示にし、マーカー案内を表示する。
