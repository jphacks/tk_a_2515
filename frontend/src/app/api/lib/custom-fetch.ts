// Orvalの標準の機能ではBaseURLを動的に変更できないため、fetchのラッパーを作成
// 参考: https://github.com/orval-labs/orval/blob/master/samples/next-app-with-fetch/custom-fetch.ts

import nextConfig from "next.config";

// NOTE: Supports cases where `content-type` is other than `json`
const getBody = <T>(c: Response | Request): Promise<T> => {
  const contentType = c.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    return c.json();
  }

  if (contentType?.includes("application/pdf")) {
    return c.blob() as Promise<T>;
  }

  return c.text() as Promise<T>;
};

// NOTE: Update just base url
const getUrl = (contextUrl: string): string => {
  const baseUrl =
    nextConfig.env?.NEXT_PUBLIC_BASE_URL || "http://localhost:8000";
  const url = new URL(contextUrl, baseUrl);
  const pathname = url.pathname;
  const search = url.search;

  const requestUrl = new URL(`${baseUrl}${pathname}${search}`);

  return requestUrl.toString();
};

// NOTE: Add headers
const getHeaders = (headers?: HeadersInit): HeadersInit => {
  const authToken =
    typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  const defaultHeaders: HeadersInit = authToken
    ? { Authorization: `Bearer ${authToken}` }
    : {};

  return {
    ...defaultHeaders,
    ...headers,
  };
};

export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  const requestUrl = getUrl(url);
  const requestHeaders = getHeaders(options.headers);

  const requestInit: RequestInit = {
    ...options,
    headers: requestHeaders,
  };

  const response = await fetch(requestUrl, requestInit);
  const data = await getBody<T>(response);

  return { status: response.status, data, headers: response.headers } as T;
};
