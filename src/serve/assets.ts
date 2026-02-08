export async function hashFile(path: string): Promise<string> {
  const content = await Deno.readFile(path);
  const hashBuffer = await crypto.subtle.digest("SHA-256", content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex.slice(0, 10);
}

export async function buildFileHashes(
  staticDir: string,
  files: string[]
): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const file of files) {
    const fullPath = `${staticDir}/${file}`;
    try {
      hashes[`/static/${file}`] = await hashFile(fullPath);
    } catch {
      // File may not exist yet (e.g. CSS not built), skip
    }
  }
  return hashes;
}
