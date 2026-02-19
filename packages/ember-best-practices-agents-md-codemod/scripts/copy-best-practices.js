#!/usr/bin/env node
/**
 * Copies best practices content from skills/ember-best-practices into this package.
 * Runs at prepare time (before npm publish) and when building.
 */
import { cpSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const skillDir = join(pkgRoot, "../../skills/ember-best-practices");
const destDir = join(pkgRoot, "best-practices");

if (!existsSync(skillDir)) {
  // Consumer install: best-practices comes from tarball, nothing to do
  if (existsSync(destDir)) process.exit(0);
  throw new Error(
    `Source not found: ${skillDir}. Run "pnpm prepare" in the monorepo before publish.`,
  );
}

mkdirSync(destDir, { recursive: true });

// Copy rules directory
cpSync(join(skillDir, "rules"), join(destDir, "rules"), {
  recursive: true,
  filter: (src) => {
    const name = src.split(/[/\\]/).pop();
    // Include _sections.md, exclude _template.md and other underscore-prefixed
    if (name === "_sections.md") return true;
    if (name.startsWith("_")) return false;
    return true;
  },
});

// Copy metadata
if (existsSync(join(skillDir, "metadata.json"))) {
  cpSync(join(skillDir, "metadata.json"), join(destDir, "metadata.json"));
}

console.log("Copied ember-best-practices content to package.");
