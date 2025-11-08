# PeakSight - 登山に特化した 3D 地図アプリ

[![PeakSight](https://raw.githubusercontent.com/jphacks/tk_a_2515/refs/heads/main/assets/thumbnail.png)](https://ktak.dev/peak-sight)
**[Demo Video](https://drive.google.com/file/d/1rqYMN_nXDkxJ--uy6Uiw-0kJ724K9rbl/view?usp=sharing)**

こちらからお試しいただけます：[https://ktak.dev/peak-sight](https://ktak.dev/peak-sight)

## 製品概要
### 背景 (製品開発のきっかけ、課題等)
国土地理院が公開している地図は 2D で構成されており、等高線だけを見ても立体的なイメージが初心者には難しいです。
現在の山に関する地図アプリは 2D がメインであり、中には Google Earth のような 3D 対応のものもありますが、登山情報が詳しく記載されているとは言い難い状況です。
そのため、登山に特化した 3D 地図アプリの開発を行いました。

### 製品説明 (具体的な製品の説明)
今回開発したマップは 3D / 2D、地形図 / 航空写真の 4 種類に対応しています。
また、画面に映っている山の情報や登山道が地図上に表示されており、選択すると整理された情報を閲覧することができます。
さらに、クマの出没情報や、登山道の標高グラフも表示され、登山に必要な情報を一つのアプリで取得可能です。

### 特長
#### 1. 特長1
地形を分かりやすく可視化し、詳細な山・登山道の情報を簡単に取得可能

#### 2. 特長2
クマの出没情報や登山道の標高グラフなど、登山に役立つ情報を一つのアプリで提供

#### 3. 特長3
山を選択した時に自動で最適な位置にジャンプするなど、マップとコンテキストパネルが連動

### 解決出来ること
### 今後の展望
- ユーザが自由に登山道を選択したり結んだりできる機能を追加する
- 2 点間の登山道のルート検索機能を追加する
- マップ描画に必要なデータの配信体制を再検討する

### 注力したこと（こだわり等）
- 登山道や山のデータが大量にありながらも、操作性がよくなるように DB の検索を工夫した
- 独自のアルゴリズムを用いることで、登山道のデータを簡潔かつ分かりやすく整備した
- 山を選択するとその山まで移動する UI や、登山道を選択すると標高データが表示されるなど、マップとコンテキストパネルの連動性を高めた

## 開発技術
### 活用した技術
#### API・データ
- [国土地理院標高データ](https://maps.gsi.go.jp/development/demtile.html)
- [yamareco 山データ](https://www.yamareco.com/)
- [MapTiler](https://www.maptiler.com/)
- [OpenStreetMap](https://www.openstreetmap.org)
- [overpass turbo](https://overpass-turbo.eu/)
- [OpenAI API](https://openai.com/api/)

#### フレームワーク・ライブラリ・モジュール
- Next.js
- FastAPI
- PostgreSQL
- PostGIS
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
- 登山道をマージする独自のアルゴリズム
  - 登山道のデータを分かりやすく表示するために、登山道をマージする独自のアルゴリズムを開発しました
  - Ball Tree や Union Find を活用し、登山道のデータを簡潔に整理しました
- マップのタイル画像をキャッシュする仕組み
  - Cloudflare と Redis を活用し、マップのタイル画像をキャッシュする仕組みを開発しました
  - これにより、マップの表示速度が向上しました
