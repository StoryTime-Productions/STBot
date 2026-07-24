// Prisma's client generator (provider = "prisma-client") has been observed
// to emit relative imports with a literal ".ts" extension instead of ".js"
// in some environments (root cause not conclusively identified — possibly
// tied to native-TypeScript-support detection at generate time, but the
// same Node/Prisma/arch versions have produced both outcomes across
// different machines, so environment alone doesn't fully explain it).
// Compiled ".js" output that imports a ".ts" path fails at runtime
// (ERR_MODULE_NOT_FOUND). Rather than depending on a specific Node patch
// or hoping the generator behaves consistently, this rewrites any stray
// ".ts" extensions to ".js" in the generated source right after
// `prisma generate`, before `tsc` ever sees it.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "src", "generated", "prisma");

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (full.endsWith(".ts")) {
      const content = readFileSync(full, "utf8");
      const fixed = content.replace(/from (["'])(\.[^"']+)\.ts\1/g, "from $1$2.js$1");
      if (fixed !== content) {
        writeFileSync(full, fixed);
        console.log(`Fixed .ts import extensions in ${path.relative(process.cwd(), full)}`);
      }
    }
  }
}

try {
  walk(root);
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
  // Generated client doesn't exist yet — nothing to fix, not an error.
}
