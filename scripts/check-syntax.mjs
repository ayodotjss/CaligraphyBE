import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["src", "scripts"];

async function collectJsFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJsFiles(fullPath);
    return /\.(m?js|cjs)$/.test(entry.name) ? [fullPath] : [];
  }));

  return files.flat();
}

const files = (await Promise.all(roots.map(collectJsFiles))).flat();

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Checked ${files.length} JavaScript files.`);
