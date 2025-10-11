FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip && pip install uv

COPY pyproject.toml .

# 仮想環境を /opt/venv に作る（/app はマウントで上書きされても安全）
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
RUN uv sync --no-dev

# ランタイムの PATH
ENV PATH="/opt/venv/bin:$PATH"

# 開発時は compose のボリュームで /app を上書きする
COPY ./fastapi /app
