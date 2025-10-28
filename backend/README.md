# Django Backend for Collect Map API

このプロジェクトは、FastAPIで作成されたバックエンドをDjangoとDjango REST frameworkを使用して再実装したものです。

## 機能

- Mountains API: 山の情報を管理するREST API
- Paths API: 登山道のパス情報を管理するREST API
- **PostGIS地理検索**: 高速な地理空間検索機能
  - 周辺検索（半径指定）
  - バウンディングボックス検索
  - 距離計算
  - 交差判定
- PostgreSQL + PostGISデータベースを使用
- CORS対応
- Django REST frameworkを使用したAPIエンドポイント
- GeoDjango（Django GIS）による地理空間データ処理

## セットアップ

### 必要な環境

- Python 3.12+
- PostgreSQL with PostGIS 3.4+
- GDAL, GEOS, PROJ (地理空間ライブラリ)
- uv (パッケージマネージャー)
- Docker & Docker Compose (推奨)

### ローカル開発

```bash
mise run start-backend #dockerの起動
mise run import-mountain-data #山データのインポート()
mise run import-path-data #登山道データのインポート(docker内で実行される)
mise run update-path-data #登山道データの更新(docker内で実行される)

```
backendのファイルをいじれば、ホットリロードされるので、Docker内に入っていじる必要はない。

## API エンドポイント

### ルート

- `GET /` - ルートエンドポイント
- `GET /health` - ヘルスチェック

### Mountains API

- `GET /mountains/` - Mountain一覧を取得
  - クエリパラメータ:
    - `name`: 山名で部分一致検索
    - `prefecture_id`: 都道府県IDでフィルタ
    - `minlat`, `minlon`, `maxlat`, `maxlon`: バウンディングボックスで地理検索（PostGIS）
    - `skip`: オフセット（デフォルト: 0）
    - `limit`: 最大取得数（デフォルト: 100）
  - 例: `/mountains/?minlat=35.0&minlon=138.0&maxlat=36.0&maxlon=139.0&limit=50`
- `POST /mountains/` - 新規Mountainを作成
- `GET /mountains/{id}/` - 指定されたIDのMountainを取得
- `PATCH /mountains/{id}/` - Mountain情報を更新
- `DELETE /mountains/{id}/` - Mountainを削除
- `GET /mountains/types/` - Type一覧を取得
- `GET /mountains/prefectures/` - Prefecture一覧を取得

### Paths API

- `GET /paths/` - Path一覧を取得
  - クエリパラメータ:
    - `highway`: highwayタグでフィルタ
    - `minlat`, `minlon`, `maxlat`, `maxlon`: バウンディングボックスで地理検索（PostGIS）
    - `skip`: オフセット（デフォルト: 0）
    - `limit`: 最大取得数（デフォルト: 100）
  - 例: `/paths/?minlat=35.0&minlon=138.0&maxlat=36.0&maxlon=139.0&limit=50`
- `GET /paths/{id}/` - 指定されたIDのPathを取得

## データベース設定

データベース接続は、backend/.envファイルの設定を使用します。

```
DATABASE_URL=postgresql://app:app@localhost:5432/app
POSTGRES_DB=app
POSTGRES_USER=app
POSTGRES_PASSWORD=app
```

## プロジェクト構成

```
backend/
├── collectmap/          # Djangoプロジェクト設定
│   ├── settings.py     # 設定ファイル
│   ├── urls.py         # URLルーティング
│   └── wsgi.py
├── mountains/          # Mountainsアプリ
│   ├── models.py       # Mountainモデル
│   ├── serializers.py  # DRF serializers
│   ├── views.py        # APIビュー
│   └── urls.py         # URLルーティング
├── paths/              # Pathsアプリ
│   ├── models.py       # Pathモデル
│   ├── serializers.py  # DRF serializers
│   ├── views.py        # APIビュー
│   └── urls.py         # URLルーティング
├── manage.py
└── pyproject.toml      # 依存関係
```

## 備考

- FastAPI版との互換性を保つように設計されています
- Pathsは既存のJSONファイルから直接読み込む実装になっています
