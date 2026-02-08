import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert";
import {
  initLlmRuntime,
  createLlmToken,
  verifyLlmToken,
  canAccessRoute,
  isProtectedRoute,
  resolveAllPermissions,
  llmFooter,
  llm401Response,
  type LlmConfig,
  type LlmTokenRuntime,
  type TokenData,
} from "./llm-tokens.ts";

async function testKey(): Promise<CryptoKey> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function testRuntime(
  groups: { prefix: string }[][],
  key: CryptoKey,
): LlmTokenRuntime {
  return initLlmRuntime({ hmacKey: key, groups });
}

// --- initLlmRuntime ---

Deno.test("initLlmRuntime: accepts valid config", async () => {
  const key = await testKey();
  const rt = initLlmRuntime({
    hmacKey: key,
    groups: [[{ prefix: "/" }]],
  });
  assertEquals(rt.expiresInHours, 8);
  assertEquals(rt.groups.length, 1);
});

Deno.test("initLlmRuntime: respects custom expiresInHours", async () => {
  const key = await testKey();
  const rt = initLlmRuntime({
    hmacKey: key,
    groups: [[{ prefix: "/" }]],
    expiresInHours: 48,
  });
  assertEquals(rt.expiresInHours, 48);
});

Deno.test("initLlmRuntime: rejects > 8 groups", async () => {
  const key = await testKey();
  const groups = Array.from({ length: 9 }, () => [{ prefix: "/" }]);
  assertThrows(
    () => initLlmRuntime({ hmacKey: key, groups }),
    Error,
    "max 8 groups",
  );
});

Deno.test("initLlmRuntime: rejects > 24 entries in a group", async () => {
  const key = await testKey();
  const entries = Array.from({ length: 25 }, (_, i) => ({
    prefix: `/p${i}`,
  }));
  assertThrows(
    () => initLlmRuntime({ hmacKey: key, groups: [entries] }),
    Error,
    "max 24",
  );
});

Deno.test("initLlmRuntime: accepts 8 groups with 24 entries each", async () => {
  const key = await testKey();
  const groups = Array.from({ length: 8 }, (_, g) =>
    Array.from({ length: 24 }, (_, e) => ({ prefix: `/g${g}/e${e}` }))
  );
  const rt = initLlmRuntime({ hmacKey: key, groups });
  assertEquals(rt.groups.length, 8);
  assertEquals(rt.groups[0].length, 24);
});

// --- Token round-trip ---

Deno.test("createLlmToken + verifyLlmToken: round-trip succeeds", async () => {
  const key = await testKey();
  const rt = testRuntime([[{ prefix: "/" }]], key);
  const token = await createLlmToken(rt, 0b1, 0b1);
  const data = await verifyLlmToken(rt, token);

  assertEquals(data !== null, true);
  assertEquals(data!.version, 1);
  assertEquals(data!.groupBits, 1);
  assertEquals(data!.entryBits, 1);
  assertEquals(data!.expired, false);
});

Deno.test("token is 24 chars base64url", async () => {
  const key = await testKey();
  const rt = testRuntime([[{ prefix: "/" }]], key);
  const token = await createLlmToken(rt, 0b1, 0b1);
  assertEquals(token.length, 24);
  assertEquals(/^[A-Za-z0-9_-]+$/.test(token), true);
});

Deno.test("token preserves group and entry bits", async () => {
  const key = await testKey();
  const rt = testRuntime(
    [
      [{ prefix: "/a" }, { prefix: "/b" }],
      [{ prefix: "/c" }],
    ],
    key,
  );

  const groupBits = 0b11;
  const entryBits = 0b101;
  const token = await createLlmToken(rt, groupBits, entryBits);
  const data = await verifyLlmToken(rt, token);

  assertEquals(data!.groupBits, groupBits);
  assertEquals(data!.entryBits, entryBits);
});

Deno.test("wrong key rejects token", async () => {
  const key1 = await testKey();
  const key2 = await testKey();
  const rt1 = testRuntime([[{ prefix: "/" }]], key1);
  const rt2 = testRuntime([[{ prefix: "/" }]], key2);

  const token = await createLlmToken(rt1, 0b1, 0b1);
  const data = await verifyLlmToken(rt2, token);
  assertEquals(data, null);
});

Deno.test("tampered token rejects", async () => {
  const key = await testKey();
  const rt = testRuntime([[{ prefix: "/" }]], key);
  const token = await createLlmToken(rt, 0b1, 0b1);

  // Flip a character
  const chars = token.split("");
  chars[5] = chars[5] === "A" ? "B" : "A";
  const tampered = chars.join("");

  const data = await verifyLlmToken(rt, tampered);
  assertEquals(data, null);
});

Deno.test("garbage token rejects", async () => {
  const key = await testKey();
  const rt = testRuntime([[{ prefix: "/" }]], key);

  assertEquals(await verifyLlmToken(rt, ""), null);
  assertEquals(await verifyLlmToken(rt, "not-a-token"), null);
  assertEquals(await verifyLlmToken(rt, "!!!"), null);
});

// --- canAccessRoute ---

Deno.test("canAccessRoute: matching prefix grants access", async () => {
  const key = await testKey();
  const rt = testRuntime(
    [[{ prefix: "/docs" }, { prefix: "/api" }]],
    key,
  );
  const data: TokenData = {
    version: 1,
    expiryHours: 999,
    groupBits: 0b1,
    entryBits: 0b11,
    expired: false,
  };

  assertEquals(canAccessRoute(rt, data, "/docs/page"), true);
  assertEquals(canAccessRoute(rt, data, "/docs/page.md"), true);
  assertEquals(canAccessRoute(rt, data, "/api/endpoint"), true);
  assertEquals(canAccessRoute(rt, data, "/other"), false);
});

Deno.test("canAccessRoute: disabled group bit denies access", async () => {
  const key = await testKey();
  const rt = testRuntime(
    [[{ prefix: "/a" }], [{ prefix: "/b" }]],
    key,
  );
  // Only group 0 enabled
  const data: TokenData = {
    version: 1,
    expiryHours: 999,
    groupBits: 0b01,
    entryBits: 0b11,
    expired: false,
  };

  assertEquals(canAccessRoute(rt, data, "/a/page"), true);
  assertEquals(canAccessRoute(rt, data, "/b/page"), false);
});

Deno.test("canAccessRoute: disabled entry bit denies access", async () => {
  const key = await testKey();
  const rt = testRuntime(
    [[{ prefix: "/a" }, { prefix: "/b" }]],
    key,
  );
  // Only entry 0 enabled (prefix /a), entry 1 disabled (prefix /b)
  const data: TokenData = {
    version: 1,
    expiryHours: 999,
    groupBits: 0b1,
    entryBits: 0b01,
    expired: false,
  };

  assertEquals(canAccessRoute(rt, data, "/a/page"), true);
  assertEquals(canAccessRoute(rt, data, "/b/page"), false);
});

Deno.test("canAccessRoute: root prefix grants all paths", async () => {
  const key = await testKey();
  const rt = testRuntime([[{ prefix: "/" }]], key);
  const data: TokenData = {
    version: 1,
    expiryHours: 999,
    groupBits: 0b1,
    entryBits: 0b1,
    expired: false,
  };

  assertEquals(canAccessRoute(rt, data, "/anything"), true);
  assertEquals(canAccessRoute(rt, data, "/deep/nested/path"), true);
  assertEquals(canAccessRoute(rt, data, "/page.md"), true);
});

Deno.test("canAccessRoute: zero bits deny everything", async () => {
  const key = await testKey();
  const rt = testRuntime([[{ prefix: "/" }]], key);
  const data: TokenData = {
    version: 1,
    expiryHours: 999,
    groupBits: 0,
    entryBits: 0,
    expired: false,
  };

  assertEquals(canAccessRoute(rt, data, "/anything"), false);
});

// --- isProtectedRoute ---

Deno.test("isProtectedRoute: matches configured prefixes", async () => {
  const key = await testKey();
  const rt = testRuntime(
    [[{ prefix: "/docs" }], [{ prefix: "/api" }]],
    key,
  );

  assertEquals(isProtectedRoute(rt, "/docs/page"), true);
  assertEquals(isProtectedRoute(rt, "/docs/page.md"), true);
  assertEquals(isProtectedRoute(rt, "/api/foo"), true);
  assertEquals(isProtectedRoute(rt, "/public"), false);
});

Deno.test("isProtectedRoute: root prefix protects all", async () => {
  const key = await testKey();
  const rt = testRuntime([[{ prefix: "/" }]], key);

  assertEquals(isProtectedRoute(rt, "/anything"), true);
  assertEquals(isProtectedRoute(rt, "/deep/path.md"), true);
});

// --- resolveAllPermissions ---

Deno.test("resolveAllPermissions: single group", async () => {
  const key = await testKey();
  const rt = testRuntime([[{ prefix: "/a" }, { prefix: "/b" }]], key);
  const { groupBits, entryBits } = resolveAllPermissions(rt);

  assertEquals(groupBits, 0b1);
  assertEquals(entryBits, 0b11);
});

Deno.test("resolveAllPermissions: multiple groups", async () => {
  const key = await testKey();
  const rt = testRuntime(
    [
      [{ prefix: "/a" }],
      [{ prefix: "/b" }, { prefix: "/c" }],
      [{ prefix: "/d" }],
    ],
    key,
  );
  const { groupBits, entryBits } = resolveAllPermissions(rt);

  assertEquals(groupBits, 0b111);
  // Entries: bit 0 (/a, /b, /d) and bit 1 (/c) across all groups
  assertEquals(entryBits, 0b11);
});

Deno.test("resolveAllPermissions: full permissions round-trip", async () => {
  const key = await testKey();
  const rt = testRuntime(
    [[{ prefix: "/docs" }, { prefix: "/api" }]],
    key,
  );

  const { groupBits, entryBits } = resolveAllPermissions(rt);
  const token = await createLlmToken(rt, groupBits, entryBits);
  const data = await verifyLlmToken(rt, token);

  assertEquals(canAccessRoute(rt, data!, "/docs/page"), true);
  assertEquals(canAccessRoute(rt, data!, "/api/endpoint"), true);
  assertEquals(canAccessRoute(rt, data!, "/other"), false);
});

// --- llmFooter / llm401Response ---

Deno.test("llmFooter includes token", () => {
  const footer = llmFooter("abc123");
  assertEquals(footer.includes("abc123"), true);
  assertEquals(footer.includes("curl -s"), true);
});

Deno.test("llm401Response returns auth instructions", () => {
  const body = llm401Response();
  assertEquals(body.includes("Authentication Required"), true);
  assertEquals(body.includes("YOUR_TOKEN"), true);
});
