import { dev } from "@halebase/kvikkpress/dev";

// -- LLM gated content (optional) --
// Protect .md routes with stateless HMAC tokens so LLM agents can access
// your docs via `?llm=<token>` while browsers use normal session auth.
//
// 1. Generate a 256-bit HMAC key:
//      deno eval "const k=new Uint8Array(32);crypto.getRandomValues(k);console.log(btoa(String.fromCharCode(...k)))"
//
// 2. Store it in .env as HMAC_SIGNING_KEY=<base64>
//
// const hmacKey = await crypto.subtle.importKey(
//   "raw",
//   Uint8Array.from(atob(Deno.env.get("HMAC_SIGNING_KEY")!), (c) => c.charCodeAt(0)),
//   { name: "HMAC", hash: "SHA-256" },
//   false,
//   ["sign", "verify"],
// );

const engine = await dev({
  content: "./content",
  site: { title: "Full Example" },
  templates: "./templates",
  static: "./static",
  css: {
    input: "./templates/main.css",
    output: "./_build/output.css",
    tailwindConfig: "./tailwind.config.js",
  },
  templateGlobals: {
    gitRemote: {
      remoteUrl: "https://github.com/your-org/your-docs",
      branch: "main",
    },
  },
  version: "1.0.0",
  // llm: {
  //   hmacKey,
  //   groups: [
  //     [{ prefix: "/" }],  // protect all routes
  //   ],
  //   isAuthenticated: (c) => !!c.req.header("cookie")?.includes("session="),
  // },
});

engine.mount();
Deno.serve({ port: 3002 }, engine.app.fetch);
