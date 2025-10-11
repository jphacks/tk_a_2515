import { type NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/libs/redis";

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

  try {
    const redis = await getRedisClient();
    const cachedStyle = await redis.get(cacheKey);
    if (cachedStyle) {
      return new NextResponse(cachedStyle, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400",
          "X-Cache-Status": "HIT",
        },
      });
    }
  } catch (error) {
    console.error(`Redis GET error for style ${cacheKey}:`, error);
  }

  const targetUrl = `https://api.maptiler.com/maps/${stylePath}?key=${process.env.MAPTILER_KEY}`;
  const response = await fetch(targetUrl);

  if (!response.ok) {
    return new NextResponse("Style not found", { status: 404 });
  }

  // ここでは必ずJSONとして処理する
  const styleString = await response.text();

  try {
    const redis = await getRedisClient();
    await redis.set(cacheKey, styleString, { EX: 86400 });
  } catch (error) {
    console.error(`Redis SET error for style ${cacheKey}:`, error);
  }

  return new NextResponse(styleString, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
      "X-Cache-Status": "MISS",
    },
  });
}
