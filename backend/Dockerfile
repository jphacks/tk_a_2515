# ベースイメージを指定（マルチプラットフォーム対応）
ARG BASE_IMAGE=python:3.12-slim
FROM ${BASE_IMAGE}

# 作業ディレクトリを設定
WORKDIR /app

# システム依存パッケージをインストール（PostGIS/GeoDjango用のライブラリを含む）
RUN apt-get update && apt-get install -y \
    postgresql-client \
    gcc \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    binutils \
    && rm -rf /var/lib/apt/lists/* \
    && ldconfig

# GeoDjango環境変数を設定（実際のライブラリパスを検出）
RUN GDAL_LIB=$(find /usr/lib -name "libgdal.so*" | head -1) && \
    GEOS_LIB=$(find /usr/lib -name "libgeos_c.so*" | head -1) && \
    echo "GDAL_LIBRARY_PATH=${GDAL_LIB}" >> /etc/environment && \
    echo "GEOS_LIBRARY_PATH=${GEOS_LIB}" >> /etc/environment

ENV GDAL_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu/libgdal.so
ENV GEOS_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu/libgeos_c.so
ENV GDAL_LIBRARY_PATH=/usr/lib/aarch64-linux-gnu/libgdal.so
ENV GEOS_LIBRARY_PATH=/usr/lib/aarch64-linux-gnu/libgeos_c.so

# uvをインストール
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# プロジェクトファイルをコピー
COPY pyproject.toml ./
COPY uv.lock ./

# 依存関係をインストール
RUN uv sync --frozen

# アプリケーションコードをコピー
COPY . .

# ポートを公開
EXPOSE 8000

# エントリーポイント
CMD ["uv", "run", "python", "manage.py", "runserver", "0.0.0.0:8200"]
