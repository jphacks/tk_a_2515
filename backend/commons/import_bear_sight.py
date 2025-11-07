import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
import json
import hashlib

import httpx
from dotenv import load_dotenv

# Djangoのセットアップ
sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "collectmap.settings")

import django

django.setup()

from bear.call_openai import analyze_article_with_llm
from bear.models import BearSighting

from commons.utils import get_coordinates_for_location

load_dotenv()

# LLMとDB結果のキャッシュディレクトリを設定
LLM_CACHE_DIR = Path(__file__).parent.parent / "datas" / "bears_cache" / "llm"
DB_CACHE_DIR = Path(__file__).parent.parent / "datas" / "bears_cache" / "db"
LLM_CACHE_DIR.mkdir(parents=True, exist_ok=True)
DB_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# NewsAPI設定
# クマ関連のNHK記事を過去30日分取得
BASE_NEWS_API_URL = "https://newsapi.org/v2/everything"

NEWS_API_KEY = os.environ.get("NEWS_API_KEY")
if NEWS_API_KEY is None:
    raise ValueError("NEWS_API_KEY is not set in environment variables.")


def fetch_news_from_api() -> list[dict]:
    """NewsAPIを使用してNHKのクマ関連記事を取得"""
    params = {
        "q": "クマ",
        "domains": "web.nhk",
        "from": (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d"),
        "sortBy": "publishedAt",
    }
    headers = {"Authorization": f"Bearer {NEWS_API_KEY}"}

    try:
        with httpx.Client() as client:
            response = client.get(BASE_NEWS_API_URL, params=params, headers=headers)
            response.raise_for_status()

            data = response.json()
            return data.get("articles", [])

    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP error while requesting NewsAPI: {e}")
        return []
    except Exception as e:
        print(f"⚠️ Unexpected error while requesting NewsAPI: {e}")
        return []


def get_cache_filename(url: str) -> str:
    """URLのMD5ハッシュからキャッシュファイル名を生成"""
    url_hash = hashlib.md5(url.encode()).hexdigest()
    return f"{url_hash}.json"


def load_llm_cache(url: str) -> dict | None:
    """LLM分析結果のキャッシュを読み込む"""
    cache_file = LLM_CACHE_DIR / get_cache_filename(url)
    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Error loading LLM cache: {e}")
    return None


def save_llm_cache(url: str, llm_result) -> None:
    """LLM分析結果をキャッシュに保存"""
    cache_file = LLM_CACHE_DIR / get_cache_filename(url)
    try:
        cache_data = {
            "url": url,
            "is_sighting": llm_result.is_sighting,
            "prefecture": llm_result.prefecture,
            "city": llm_result.city,
            "summary": llm_result.summary,
            "cached_at": datetime.now().isoformat(),
        }
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ Error saving LLM cache: {e}")


def load_db_cache(url: str) -> dict | None:
    """DB保存用データのキャッシュを読み込む"""
    cache_file = DB_CACHE_DIR / get_cache_filename(url)
    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Error loading DB cache: {e}")
    return None


def save_db_cache(url: str, sighting_data: dict) -> None:
    """DB保存用データをキャッシュに保存"""
    cache_file = DB_CACHE_DIR / get_cache_filename(url)
    try:
        cache_data = {
            "url": url,
            **sighting_data,
            "cached_at": datetime.now().isoformat(),
        }
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ Error saving DB cache: {e}")


def main():
    print(f"--- {datetime.now()} | Scheduled job started ---")

    # NewsAPIから記事を取得
    articles = fetch_news_from_api()
    if not articles:
        print("No articles retrieved.")
        return

    print(f"Retrieved {len(articles)} articles. Starting analysis...")

    saved_count = 0
    for article in articles:
        url = article.get("url", "")
        if not url:
            continue
        
        # DBに既存の記事がないか確認
        existing = BearSighting.objects.filter(source_url=url).first()
        if existing:
            continue

        # DBキャッシュの確認
        # キャッシュがあればLLM分析とジオコーディングをスキップ
        db_cache = load_db_cache(url)
        if db_cache:
            print(f"📦 Using cached DB result for: {url}")
            try:
                sighting = BearSighting(
                    prefecture=db_cache.get("prefecture", ""),
                    city=db_cache.get("city", ""),
                    latitude=db_cache.get("latitude", 0.0),
                    longitude=db_cache.get("longitude", 0.0),
                    summary=db_cache.get("summary", ""),
                    source_url=url,
                    image_url=db_cache.get("image_url", ""),
                    reported_at=datetime.fromisoformat(db_cache.get("reported_at", datetime.now().isoformat())),
                )
                sighting.save()
                saved_count += 1
                print(f"✅ Saved bear sighting from cached data: {url}")
            except Exception as e:
                print(f"❌ Error saving cached sighting: {e}")
            continue

        title = article.get("title", "")
        description = article.get("description", "")
        print(f"Analyzing article: {title}")

        # LLMキャッシュの確認
        # キャッシュがあればLLM APIの呼び出しをスキップ
        llm_cache = load_llm_cache(url)
        if llm_cache:
            print(f"📦 Using cached LLM result for: {title}")
            # キャッシュデータから疑似的なLLM結果オブジェクトを作成
            class CachedResult:
                def __init__(self, data):
                    self.is_sighting = data.get("is_sighting", False)
                    self.prefecture = data.get("prefecture")
                    self.city = data.get("city")
                    self.summary = data.get("summary")
            llm_result = CachedResult(llm_cache)
        else:
            # LLMで記事を分析
            llm_result = analyze_article_with_llm(title, description)
            if llm_result:
                save_llm_cache(url, llm_result)

        # クマの目撃情報でない場合はスキップ
        if not llm_result or not llm_result.is_sighting:
            continue

        # 都道府県と市区町村から緯度経度を取得
        coordinates = get_coordinates_for_location(
            llm_result.prefecture, llm_result.city
        )
        try:
            # 記事の公開日時を取得
            reported_at = datetime.fromisoformat(
                article.get("publishedAt", datetime.now().isoformat()).replace(
                    "Z", "+00:00"
                )
            )
            
            # DB保存用のデータを準備
            sighting_data = {
                "prefecture": llm_result.prefecture or "",
                "city": llm_result.city or "",
                "latitude": coordinates[0] if coordinates else 0.0,
                "longitude": coordinates[1] if coordinates else 0.0,
                "summary": llm_result.summary or "",
                "image_url": article.get("urlToImage", ""),
                "reported_at": reported_at.isoformat(),
            }
            
            # DBに保存
            sighting = BearSighting(
                **{k: v for k, v in sighting_data.items() if k != "reported_at"},
                source_url=url,
                reported_at=reported_at,
            )
            sighting.save()
            
            # DB保存データをキャッシュ
            save_db_cache(url, sighting_data)
            
            saved_count += 1
            print(f"✅ Saved bear sighting from article: {title}")
        except Exception as e:
            print(f"❌ Error saving sighting from article '{title}': {e}")


if __name__ == "__main__":
    main()
