import type { Context, Next } from "jsr:@hono/hono@^4";

/** Logs each request with method, path, status, and duration. */
export async function logger(c: Context, next: Next): Promise<void> {
  const start = performance.now();
  await next();
  const ms = (performance.now() - start).toFixed(0);
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
}
