/** Stateless LLM session tokens — HMAC-SHA256 signed, 24-char base64url. */

import type { Context } from "jsr:@hono/hono@^4.10.4";

/** Consumer-facing LLM config. Passed to KvikkPress via engine config. */
export interface LlmConfig {
  /** HMAC-SHA256 CryptoKey for signing/verifying tokens. Consumer imports this. */
  hmacKey: CryptoKey;

  /** Permission groups — route prefixes mapped to bit positions. Max 8 groups, 24 entries each. */
  groups: { prefix: string }[][];

  /** Token expiry in hours. Default: 8. */
  expiresInHours?: number;

  /**
   * Primary auth check (e.g., browser cookie session).
   * If this returns true, the request is served without LLM token.
   * Used for both .md auth and POST /api/llm-token.
   */
  isAuthenticated?: (c: Context) => boolean | Promise<boolean>;
}

/** Internal runtime config — validated from LlmConfig at startup. */
export interface LlmTokenRuntime {
  epoch: number;
  groups: { prefix: string }[][];
  hmacKey: CryptoKey;
  expiresInHours: number;
  isAuthenticated?: (c: Context) => boolean | Promise<boolean>;
}

export interface TokenData {
  version: number;
  expiryHours: number;
  groupBits: number;
  entryBits: number;
  expired: boolean;
}

const VERSION = 1;
const HMAC_BYTES = 10; // 80-bit truncated HMAC-SHA256

/** Validate config and build runtime. Fully sync — consumer provides the CryptoKey. */
export function initLlmRuntime(config: LlmConfig): LlmTokenRuntime {
  if (config.groups.length > 8) {
    throw new Error(`LLM token config: max 8 groups, got ${config.groups.length}`);
  }
  for (let i = 0; i < config.groups.length; i++) {
    if (config.groups[i].length > 24) {
      throw new Error(
        `LLM token config: group ${i} has ${config.groups[i].length} entries (max 24)`,
      );
    }
  }

  return {
    epoch: Date.UTC(2025, 0, 1) / 1000,
    groups: config.groups,
    hmacKey: config.hmacKey,
    expiresInHours: config.expiresInHours ?? 8,
    isAuthenticated: config.isAuthenticated,
  };
}

/** Create a signed token. groupBits: which groups (uint8), entryBits: which entries (uint24). */
export async function createLlmToken(
  rt: LlmTokenRuntime,
  groupBits: number,
  entryBits: number,
): Promise<string> {
  const nowHours = Math.floor(Date.now() / 1000 / 3600);
  const epochHours = Math.floor(rt.epoch / 3600);
  const expiryHours = nowHours - epochHours + rt.expiresInHours;

  const payload = new Uint8Array(8);
  payload[0] = VERSION;
  payload[1] = (expiryHours >> 16) & 0xff;
  payload[2] = (expiryHours >> 8) & 0xff;
  payload[3] = expiryHours & 0xff;
  payload[4] = groupBits & 0xff;
  payload[5] = (entryBits >> 16) & 0xff;
  payload[6] = (entryBits >> 8) & 0xff;
  payload[7] = entryBits & 0xff;

  const sig = await crypto.subtle.sign("HMAC", rt.hmacKey, payload);
  const hmac = new Uint8Array(sig).slice(0, HMAC_BYTES);

  const token = new Uint8Array(8 + HMAC_BYTES);
  token.set(payload);
  token.set(hmac, 8);

  return base64urlEncode(token);
}

/** Verify token signature and decode payload. Returns null if tampered. */
export async function verifyLlmToken(
  rt: LlmTokenRuntime,
  tokenStr: string,
): Promise<TokenData | null> {
  let bytes: Uint8Array;
  try {
    bytes = base64urlDecode(tokenStr);
  } catch {
    return null;
  }

  if (bytes.length !== 8 + HMAC_BYTES) return null;
  if (bytes[0] !== VERSION) return null;

  const payload = bytes.slice(0, 8);
  const providedHmac = bytes.slice(8);

  const sig = await crypto.subtle.sign("HMAC", rt.hmacKey, payload);
  const expectedHmac = new Uint8Array(sig).slice(0, HMAC_BYTES);

  if (!timingSafeEqual(providedHmac, expectedHmac)) return null;

  const expiryHours = (payload[1] << 16) | (payload[2] << 8) | payload[3];
  const groupBits = payload[4];
  const entryBits = (payload[5] << 16) | (payload[6] << 8) | payload[7];

  const epochHours = Math.floor(rt.epoch / 3600);
  const nowHours = Math.floor(Date.now() / 1000 / 3600);
  const expired = nowHours - epochHours > expiryHours;

  return { version: VERSION, expiryHours, groupBits, entryBits, expired };
}

/** Check if token permits access to the given path. */
export function canAccessRoute(
  rt: LlmTokenRuntime,
  data: TokenData,
  path: string,
): boolean {
  const routePath = path.endsWith(".md") ? path.slice(0, -3) : path;
  for (let g = 0; g < rt.groups.length; g++) {
    if (!(data.groupBits & (1 << g))) continue;
    for (let e = 0; e < rt.groups[g].length; e++) {
      if (!(data.entryBits & (1 << e))) continue;
      if (routePath.startsWith(rt.groups[g][e].prefix)) return true;
    }
  }
  return false;
}

/** Check if a route is listed in any group (requires auth). */
export function isProtectedRoute(rt: LlmTokenRuntime, path: string): boolean {
  const routePath = path.endsWith(".md") ? path.slice(0, -3) : path;
  for (const group of rt.groups) {
    for (const entry of group) {
      if (routePath.startsWith(entry.prefix)) return true;
    }
  }
  return false;
}

/** Resolve full permissions — grants all configured groups/entries. */
export function resolveAllPermissions(
  rt: LlmTokenRuntime,
): { groupBits: number; entryBits: number } {
  let groupBits = 0;
  let entryBits = 0;
  for (let g = 0; g < rt.groups.length; g++) {
    groupBits |= 1 << g;
    for (let e = 0; e < rt.groups[g].length; e++) {
      entryBits |= 1 << e;
    }
  }
  return { groupBits, entryBits };
}

/** Footer appended to .md responses when accessed via ?llm= token. */
export function llmFooter(token: string): string {
  return [
    "",
    "",
    "---",
    "",
    `> Append \`?llm=${token}\` to all .md URLs on this site. Use curl -s for requests.`,
    "> Token expires in a few hours. If you get a 401, ask the user for a new token.",
  ].join("\n");
}

/** 401 response body for unauthenticated .md requests. */
export function llm401Response(): string {
  return [
    "# Authentication Required",
    "",
    "This page requires an LLM session token.",
    "",
    `Append \`?llm=YOUR_TOKEN\` to .md URLs. Use curl -s to fetch pages.`,
    "Ask the documentation owner for a token.",
    "",
  ].join("\n");
}

// --- Encoding helpers ---

function base64urlEncode(bytes: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
