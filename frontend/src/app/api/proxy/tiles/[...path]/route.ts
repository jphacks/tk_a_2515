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
  const contentType = getContentType(requestPath);

  try {
    const redis = await getRedisClient();
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      // ✨ キャッシュデータのフォーマットを検証
      if (validateContentType(Buffer.from(cachedData), contentType)) {
        return new NextResponse(cachedData, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400",
            "X-Cache-Status": "HIT",
          },
        });
      } else {
        console.warn(`Validation failed for cached data with key ${cacheKey}`);
      }
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

  // ✨ フォーマットの検証
  if (!response.headers.get("Content-Type")?.startsWith(contentType)) {
    console.error(
      `Validation failed: Expected Content-Type ${contentType}, but received ${response.headers.get(
        "Content-Type",
      )}`,
    );
    return new NextResponse("Invalid content format", { status: 400 });
  }

  try {
    const redis = await getRedisClient();
    await redis.set(cacheKey, dataBuffer, { EX: 86400 });
  } catch (error) {
    console.error(`Redis SET error for key ${cacheKey}:`, error);
  }

  return new NextResponse(dataBuffer, {
    headers: {
      "Content-Type": contentType,
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

// ✨ キャッシュデータのフォーマットを検証する関数
function validateContentType(
  data: Buffer,
  expectedContentType: string,
): boolean {
  // 簡易的な検証として、データの先頭バイトをチェック
  if (
    expectedContentType === "image/png" &&
    data.slice(0, 8).toString("hex") === "89504e470d0a1a0a"
  ) {
    return true;
  }
  if (
    expectedContentType === "image/jpeg" &&
    data.slice(0, 2).toString("hex") === "ffd8"
  ) {
    return true;
  }
  if (
    expectedContentType === "image/webp" &&
    data.slice(0, 4).toString("hex") === "52494646" && // "RIFF"
    data.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return true;
  }
  if (
    expectedContentType === "application/x-protobuf" &&
    data.slice(0, 4).toString("hex") === "504b0304"
  ) {
    return true;
  }
  if (
    expectedContentType === "application/json" &&
    data.slice(0, 1).toString("ascii") === "{" // JSON starts with '{'
  ) {
    return true;
  }
  return false;
}
