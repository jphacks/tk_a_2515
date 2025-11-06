import os

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field

load_dotenv()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
if OPENAI_API_KEY is None:
    raise ValueError(
        "OPENAI_API_KEY is not set in environment variables."
    )  # 🚨 Raise an error if the API key is missing.

# --- 1. Initialize the LLM client ---
# Set the OpenAI API key.
client = OpenAI(api_key=OPENAI_API_KEY)


# --- 2. Define the output schema for the LLM (Pydantic) ---
# The LLM will generate JSON in this format.
class LLMAnalysisResult(BaseModel):
    is_sighting: bool = Field(
        description="Whether the article reports a specific bear sighting or incident."
    )
    prefecture: str | None = Field(None, description="Prefecture (e.g., Iwate).")
    city: str | None = Field(None, description="City or municipality (e.g., Morioka).")
    summary: str | None = Field(None, description="A concise summary of the situation.")


# --- 3. Analysis prompt ---
# Few-shot learning prompt with examples.
SYSTEM_PROMPT = f"""
あなたはニュース記事を分析する AI である．
記事のタイトルと概要を読み，「具体的なクマの出没情報」か「一般的な話題（政策など）」かを分類せよ．
さらに，「具体的な出没情報」の場合のみ，場所と概要を抽出し，記事の内容を要約せよ．

要約は情報の過不足なく分かりやすく示し，ですます調ではなく常体で記述すること．
また，以下の Pydantic スキーマに従った JSON 形式で出力すること:
{LLMAnalysisResult.model_json_schema()}

---
(例1)
入力:
- title: 岩手銀行本店の地下駐車場 クマ1頭が侵入 捕獲
- description: 28日午前，盛岡市の中心部にある岩手銀行本店の地下駐車場にクマ1頭が...
出力:
{{
  "is_sighting": true,
  "prefecture": "岩手県",
  "city": "盛岡市",
  "summary": "盛岡市の岩手銀行本店の地下駐車場にクマ1頭が侵入し，捕獲された．"
}}

---
(例2)
入力:
- title: 【ライブ予定】クマ駆除支援 秋田県知事が防衛相に緊急要望
- description: クマによる人身被害が秋田県内で相次いでいることを受け，秋田県の鈴木知事は...
出力:
{{
  "is_sighting": false,
  "prefecture": null,
  "city": null,
  "summary": null
}}
"""


# --- 4. Function to execute the LLM ---
def analyze_article_with_llm(title: str, description: str) -> LLMAnalysisResult | None:
    """
    Analyze an article using the LLM (GPT) and return structured data (Pydantic model).
    """
    if not description:
        description = title  # Use title if description is empty.

    user_prompt = f"""
    入力:
    - title: {title}
    - description: {description}
    出力:
    """

    try:
        response = client.chat.completions.create(
            model="gpt-5-nano",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )

        response_json = response.choices[0].message.content
        print(f"📝 LLM analysis result (JSON): {response_json}")

        # Validate and parse the JSON using the Pydantic model.
        if response_json is not None:
            analysis_result = LLMAnalysisResult.model_validate_json(response_json)
        else:
            raise ValueError("Response JSON is None.")
        return analysis_result

    except Exception as e:
        print(f"❌ Error during LLM analysis: {e}")
        print(f"⚠️ Article that caused the error: {title}")
        return None
