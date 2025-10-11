import { type NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/libs/redis";

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const params = await context.params;
  if (!params || !params.path) {
    return new NextResponse("Invalid request: Missing path parameters", {
      status: 400,
    });
  }

  const requestPath = params.path.join("/");
  const cacheKey = `tile:${requestPath}`;

  try {
    const redis = await getRedisClient();
    const cachedData = await redis.get(Buffer.from(cacheKey));
    if (cachedData) {
      return new NextResponse(cachedData, {
        headers: {
          "Content-Type": getContentType(requestPath),
          "Cache-Control": "public, max-age=86400",
          "X-Cache-Status": "HIT",
        },
      });
    }
  } catch (error) {
    console.error(`Redis GET error for key ${cacheKey}:`, error);
  }

  const targetUrl = `https://api.maptiler.com/tiles/${requestPath}?key=${process.env.MAPTILER_KEY}`;
  const response = await fetch(targetUrl);

  if (!response.ok) {
    return new NextResponse(`${requestPath} not found`, { status: 404 });
  }

  const dataBuffer = Buffer.from(await response.arrayBuffer());

  try {
    const redis = await getRedisClient();
    await redis.set(cacheKey, dataBuffer, { EX: 86400 });
  } catch (error) {
    console.error(`Redis SET error for key ${cacheKey}:`, error);
  }

  return new NextResponse(dataBuffer, {
    headers: {
      "Content-Type": getContentType(requestPath),
      "Cache-Control": "public, max-age=86400",
      "X-Cache-Status": "MISS",
    },
  });
}

// 拡張子からContent-Typeを判断するヘルパー関数
function getContentType(path: string): string {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".pbf")) return "application/x-protobuf";
  if (path.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}
