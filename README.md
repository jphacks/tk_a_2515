# PeakSight - 登山に特化した3D地図アプリ

[![PeakSight](https://raw.githubusercontent.com/jphacks/tk_a_2515/refs/heads/main/assets/thumbnail.png)](https://ktak.dev/terview)
**[Demo Video](https://drive.google.com/file/d/1rqYMN_nXDkxJ--uy6Uiw-0kJ724K9rbl/view?usp=sharing)**

こちらからお試しいただけます：[https://ktak.dev/terview](https://ktak.dev/terview)

## 製品概要
### 背景 (製品開発のきっかけ、課題等)
国土地理院が公開している地図は 2D で構成されており、等高線だけを見ても立体的なイメージが初心者には難しいです。
現在の山に関する地図アプリは 2D がメインであり、中には Google Earth のような 3D 対応のものもありますが、登山情報が詳しく記載されているとは言い難い状況です。
そのため、登山に特化した 3D 地図アプリの開発を行いました。

### 製品説明 (具体的な製品の説明)
今回開発したマップは 3D / 2D、地形図 / 航空写真の 4 種類に対応しています。
また、画面に映っている山の情報や登山道が地図上に表示されており、選択すると整理された情報を閲覧することができます。

### 特長
#### 1. 特長1
地形を分かりやすく可視化し、山・登山道の情報を簡単に取得可能

#### 2. 特長2
登山道の標高に関する詳細で分かりやすいグラフ描画

#### 3. 特長3
山を選択した時に自動で最適な位置にジャンプするなど、マップとコンテキストパネルが連動

### 解決出来ること
### 今後の展望
- 登山道のデータが細切れになっている部分があり、綺麗に整理する
- DB 設計を見直し、API の速度改善を行う
- ユーザが自由に登山道を選択したり結んだりできる機能を追加する

### 注力したこと（こだわり等）
- 登山道や山のデータが大量にありながらも、操作性がよくなるように DB の検索を工夫しました
  - 具体的には、階層的に DB を検索するようにして応答性を飛躍的に向上させました
- 3D マップの表示にキャッシュを導入し、表示の応答性を改善しました
  - 具体的には、Cloudflare や Redis を活用して、タイル画像のキャッシュを実装しました
- 山を選択するとその山まで移動する UI や、登山道を選択すると標高データが表示されるようにしました

## 開発技術
### 活用した技術
#### API・データ
- [国土地理院標高データ](https://maps.gsi.go.jp/development/demtile.html)
- [yamareco 山データ](https://www.yamareco.com/)
- [overpass turbo](https://overpass-turbo.eu/)
- [OpenStreetMap](https://www.openstreetmap.org)

#### フレームワーク・ライブラリ・モジュール
- Next.js
- FastAPI
- PostgreSQL
- Redis
- Cloudflare

#### デバイス
- Web ブラウザが動作するパソコンやスマートフォン
- Deploy: Oracle Cloud Infrastructure, Cloudflare, GitHub Actions

### 独自技術
#### ハッカソンで開発した独自機能・技術
- DB の階層的な検索
  - 山や登山道のデータが大量にある中で、応答性を向上させるために、DB の階層的な検索を実装しました
  - これにより、ユーザが山や登山道を選択した際の応答性が向上しました
- マップのタイル画像をキャッシュする仕組み
  - Cloudflare と Redis を活用し、マップのタイル画像をキャッシュする仕組みを開発しました
  - これにより、マップの表示速度が向上しました
