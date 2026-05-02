import { parse as shellParse } from "shell-quote";

import type { BodyType, KeyValue, Method } from "../api";

export interface ParsedCurl {
  method: Method;
  url: string;
  headers: KeyValue[];
  body: string;
  body_type: BodyType;
}

export class CurlParseError extends Error {}

export function parseCurl(input: string): ParsedCurl {
  const cleaned = input
    .replace(/\\\r?\n/g, " ")
    .replace(/\$'/g, "'")
    .trim();
  if (!cleaned) throw new CurlParseError("empty input");

  const tokens = shellParse(cleaned)
    .filter((token): token is string => typeof token === "string");

  if (!tokens.length) throw new CurlParseError("no tokens");
  if (tokens[0] !== "curl") throw new CurlParseError("expected the command to start with 'curl'");

  let method: Method | null = null;
  let url = "";
  const headers: KeyValue[] = [];
  let body = "";
  let bodyType: BodyType = "none";

  let i = 1;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === "-X" || token === "--request") {
      method = (tokens[++i] ?? "GET").toUpperCase() as Method;
    } else if (token === "-H" || token === "--header") {
      const value = tokens[++i] ?? "";
      const colon = value.indexOf(":");
      if (colon > 0) {
        headers.push({
          key: value.slice(0, colon).trim(),
          value: value.slice(colon + 1).trim(),
          enabled: true,
        });
      }
    } else if (token === "-d" || token === "--data" || token === "--data-raw" || token === "--data-binary" || token === "--data-ascii") {
      body = tokens[++i] ?? "";
      bodyType = guessBodyType(body, headers);
      if (!method) method = "POST";
    } else if (token === "--data-urlencode") {
      body = tokens[++i] ?? "";
      bodyType = "urlencoded";
      if (!method) method = "POST";
    } else if (token === "-u" || token === "--user") {
      const credentials = tokens[++i] ?? "";
      const encoded = btoa(credentials);
      headers.push({ key: "Authorization", value: `Basic ${encoded}`, enabled: true });
    } else if (token === "-b" || token === "--cookie") {
      const value = tokens[++i] ?? "";
      headers.push({ key: "Cookie", value, enabled: true });
    } else if (token === "-A" || token === "--user-agent") {
      headers.push({ key: "User-Agent", value: tokens[++i] ?? "", enabled: true });
    } else if (token === "-e" || token === "--referer") {
      headers.push({ key: "Referer", value: tokens[++i] ?? "", enabled: true });
    } else if (token === "--location" || token === "-L" || token === "--insecure" || token === "-k" || token === "--silent" || token === "-s" || token === "--compressed" || token === "--fail" || token === "-f" || token === "--include" || token === "-i") {
      // boolean flags — accepted, no-op for our model
    } else if (token === "--max-time" || token === "--connect-timeout" || token === "-m" || token === "-o" || token === "--output") {
      i++; // skip value, no-op
    } else if (token.startsWith("http://") || token.startsWith("https://")) {
      if (!url) url = token;
    } else if (!token.startsWith("-")) {
      if (!url) url = token;
    } else {
      // Unknown flag with attached value form (e.g. -Hkey: value) — skip best-effort
    }
    i++;
  }

  if (!url) throw new CurlParseError("could not find a URL in the curl command");

  return {
    method: method ?? "GET",
    url,
    headers,
    body,
    body_type: body ? bodyType : "none",
  };
}

function guessBodyType(body: string, headers: KeyValue[]): BodyType {
  const contentTypeHeader = headers.find((h) => h.key.toLowerCase() === "content-type");
  const contentType = (contentTypeHeader?.value ?? "").toLowerCase();
  if (contentType.includes("json")) return "json";
  if (contentType.includes("urlencoded")) return "urlencoded";
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  if (trimmed.includes("=") && !trimmed.includes("\n")) return "urlencoded";
  return "raw";
}

export interface CurlBuildInput {
  method: Method;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  body_type: BodyType;
}

export function buildCurl(input: CurlBuildInput): string {
  const url = appendParams(input.url, input.params);
  const parts = [`curl ${shellEscape(url)}`];

  if (input.method !== "GET") {
    parts.push(`-X ${input.method}`);
  }

  for (const header of input.headers) {
    if (header.enabled === false || !header.key.trim()) continue;
    parts.push(`-H ${shellEscape(`${header.key}: ${header.value}`)}`);
  }

  if (input.body && input.body_type !== "none") {
    parts.push(`--data-raw ${shellEscape(input.body)}`);
  }

  return parts.join(" \\\n  ");
}

function appendParams(url: string, params: KeyValue[]): string {
  const enabled = params.filter((p) => p.enabled !== false && p.key.trim());
  if (!enabled.length) return url;
  const query = enabled
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join("&");
  return url.includes("?") ? `${url}&${query}` : `${url}?${query}`;
}

function shellEscape(value: string): string {
  if (value === "") return "''";
  if (/^[A-Za-z0-9._:/?=&%@+,;-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}
