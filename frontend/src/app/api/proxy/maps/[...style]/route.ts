import { type NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/libs/redis";

// MapTilerのスタイルJSONをプロキシ経由で取得するAPI
export async function GET(
  _: NextRequest,
  context: { params: Promise<{ style: string[] }> },
) {
  const params = await context.params;
  if (!params || !params.style) {
    return new NextResponse("Invalid request: Missing path parameters", {
      status: 400,
    });
  }

  const stylePath = params.style.join("/");
  const cacheKey = `style:${stylePath}`;

  // Redisキャッシュから取得を試行
  try {
    const redis = await getRedisClient();
    const cachedStyle = await redis.get(cacheKey);

    if (cachedStyle) {
      if (validateJsonFormat(cachedStyle)) {
        return new NextResponse(cachedStyle, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, immutable",
            "X-Cache-Status": "HIT",
          },
        });
      } else {
        console.warn(`Validation failed for cached data with key ${cacheKey}`);
      }
    }
  } catch (error) {
    console.error(`Redis GET error for style ${cacheKey}:`, error);
  }

  // MapTiler APIから取得
  const targetUrl = `https://api.maptiler.com/maps/${stylePath}?key=${process.env.MAPTILER_KEY}`;
  const response = await fetch(targetUrl);

  if (!response.ok) {
    return new NextResponse("Style not found", { status: 404 });
  }

  const styleString = await response.text();

  // JSON形式を検証
  if (!validateJsonFormat(styleString)) {
    console.error(`Validation failed for fetched data from ${targetUrl}`);
    return new NextResponse("Invalid content format", { status: 400 });
  }

  // Redisにキャッシュを保存
  try {
    const redis = await getRedisClient();
    await redis.set(cacheKey, styleString);
  } catch (error) {
    console.error(`Redis SET error for style ${cacheKey}:`, error);
  }

  return new NextResponse(styleString, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, immutable",
      "X-Cache-Status": "MISS",
    },
  });
}

// JSON形式の妥当性を検証
function validateJsonFormat(data: string): boolean {
  try {
    JSON.parse(data);
    return true;
  } catch {
    return false;
  }
}
