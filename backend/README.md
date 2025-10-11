## Setup
```bash
docker compose up -d
```
Dockerを使用してPostgreSQLとサーバーを起動します。

```bash
uv sync
```
uvの準備

```bash
uv run python fastapi/scripts/create_tables.py
```
DBの初期化

```bash
uv run python fastapi/scripts/import_mountains.py
uv run python fastapi/scripts/import_paths.py
```