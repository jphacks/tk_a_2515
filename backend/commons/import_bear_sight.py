import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

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

# --- 1. NewsAPI Configuration ---
# User-defined endpoint (API key sent in headers).
# Search query q='クマ'.
# Source domains=web.nhk.
# Start date from=1 day ago.
# Sort order sortBy=publishedAt.
BASE_NEWS_API_URL = "https://newsapi.org/v2/everything"

NEWS_API_KEY = os.environ.get("NEWS_API_KEY")
if NEWS_API_KEY is None:
    raise ValueError(
        "NEWS_API_KEY is not set in environment variables."
    )  # 🚨 Raise an error if the API key is missing.


def fetch_news_from_api() -> list[dict]:
    """
    Fetch bear-related articles from NHK using NewsAPI.
    """
    # Target articles from "yesterday" onwards.
    yesterday = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

    params = {
        "q": "クマ",
        "domains": "web.nhk",
        "from": yesterday,
        "sortBy": "publishedAt",
    }
    headers = {"Authorization": f"Bearer {NEWS_API_KEY}"}

    try:
        with httpx.Client() as client:
            response = client.get(BASE_NEWS_API_URL, params=params, headers=headers)
            response.raise_for_status()  # Raise an exception for HTTP errors (4xx, 5xx).

            data = response.json()
            return data.get("articles", [])

    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP error while requesting NewsAPI: {e}")
        return []
    except Exception as e:
        print(f"⚠️ Unexpected error while requesting NewsAPI: {e}")
        return []


def main():
    print(f"--- {datetime.now()} | Scheduled job started ---")

    # 1. Fetch articles.
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
        existing = BearSighting.objects.filter(source_url=url).first()
        if existing:
            continue

        title = article.get("title", "")
        description = article.get("description", "")
        print(f"Analyzing article: {title}")

        llm_result = analyze_article_with_llm(title, description)
        if not llm_result or not llm_result.is_sighting:
            continue

        coordinates = get_coordinates_for_location(
            llm_result.prefecture, llm_result.city
        )
        try:
            sighting = BearSighting(
                prefecture=llm_result.prefecture or "",
                city=llm_result.city or "",
                latitude=coordinates[0] if coordinates else 0.0,
                longitude=coordinates[1] if coordinates else 0.0,
                summary=llm_result.summary or "",
                source_url=url,
                image_url=article.get("urlToImage", ""),
                reported_at=datetime.fromisoformat(
                    article.get("publishedAt", datetime.now().isoformat()).replace(
                        "Z", "+00:00"
                    )
                ),
            )
            sighting.save()
            saved_count += 1
            print(f"✅ Saved bear sighting from article: {title}")
        except Exception as e:
            print(f"❌ Error saving sighting from article '{title}': {e}")


if __name__ == "__main__":
    main()
