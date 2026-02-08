---
title: "LLM Tokens"
order: 7
---

# LLM Tokens

Gate `.md` endpoints with compact stateless HMAC-signed tokens. Authenticated browser users generate compact URL tokens (`?llm=...`) that LLM agents append to every request.

## Setup

```ts title="server.ts"
// 1. Create an HMAC key from a base64 secret (store in .env as HMAC_SIGNING_KEY)
const hmacKey = await crypto.subtle.importKey(
  "raw",
  Uint8Array.from(atob(Deno.env.get("HMAC_SIGNING_KEY")!), (c) => c.charCodeAt(0)),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

// 2. Pass it in the llm field of dev() or createKvikkPress()
const engine = await dev({
  ...config,
  llm: {
    hmacKey,
    groups: [[{ prefix: "/" }]],              // protect all routes
    isAuthenticated: (c) => checkSession(c),  // browser session check
    expiresInHours: 8,                        // token lifetime (default: 8)
  },
});
```

Generate a 256-bit HMAC key:

```sh title="terminal"
deno eval "const k=new Uint8Array(32);crypto.getRandomValues(k);console.log(btoa(String.fromCharCode(...k)))"
```

## Request flow

For protected `.md` routes:

1. `isAuthenticated(c)` — if true, serve immediately (browser session)
2. `?llm=` query param or `llm_s` cookie — verify HMAC signature and expiry
3. Neither — return 401 markdown with usage instructions

The "Copy for LLM" button in the UI calls `POST /api/llm-token` to generate a token for the current user's session. The `.md` responses themselves include navigation links and token instructions, so an LLM agent can traverse the site without additional guidance.

## LlmConfig

| Field | Type | Description |
|---|---|---|
| `hmacKey` | `CryptoKey` | HMAC-SHA256 key for signing and verifying tokens |
| `groups` | `{ prefix: string }[][]` | Permission groups. Max 8 groups, max 24 entries per group. Position-sensitive — don't reorder after issuing tokens |
| `expiresInHours` | `number` | Optional. Token lifetime in hours. Default: `8` |
| `isAuthenticated` | `(c: Context) => boolean \| Promise<boolean>` | Optional. Primary auth check (e.g. browser session). If true, serves without requiring LLM token |

## Token format

Tokens encode permissions as positional bit flags — each group and entry maps to its array index. Don't reorder or remove entries from `groups` while unexpired tokens exist, or those tokens will grant access to the wrong routes. Append new entries instead.

Token: 8-byte payload + 10-byte HMAC-80 = 18 bytes → 24 chars base64url.
