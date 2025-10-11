import { createClient, type RedisClientType } from "redis";

// グローバルスコープにクライアントインスタンスをキャッシュ
let redisClient: RedisClientType | null = null;

// Redisクライアントを取得・接続するための非同期関数
export const getRedisClient = async (): Promise<RedisClientType> => {
  // 既に接続済みのクライアントがあれば再利用
  if (redisClient?.isOpen) {
    return redisClient;
  }

  // なければ新しいクライアントを作成
  const client = createClient({
    url: process.env.REDIS_URL,
  });

  client.on("error", err => console.error("Redis Client Error", err));

  // 接続が完了するまで待機
  await client.connect();

  // グローバル変数にキャッシュ
  redisClient = client as RedisClientType;
  return redisClient;
};
