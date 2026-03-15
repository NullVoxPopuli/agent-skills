#!/usr/bin/env node
/**
 * CLI entry point for skills-lint.
 *
 * Scans skills files for disallowed shell commands:
 *   - Shell scripts (.sh) inside skills/
 *   - Bash/sh/shell code blocks in Markdown files (.md) inside skills/
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scanLines, extractBashBlocks, type Violation } from './lint.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '../../..', 'skills');

/**
 * Recursively collect all files with the given extension under `dir`.
 */
async function findFiles(dir: string, ext: string): Promise<string[]> {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      const info = await stat(full);
      if (info.isDirectory()) {
        results.push(...(await findFiles(full, ext)));
      } else if (entry.endsWith(ext)) {
        results.push(full);
      }
    } catch {
      // skip inaccessible entries
    }
  }
  return results;
}

/**
 * Main entry point.
 */
async function main() {
  const violations: Violation[] = [];

  // 1. Scan all .sh files in full
  const shFiles = await findFiles(SKILLS_DIR, '.sh');
  for (const file of shFiles) {
    const code = await readFile(file, 'utf-8');
    violations.push(...scanLines(code, file, 0));
  }

  // 2. Scan only bash/sh/shell code blocks inside .md files
  const mdFiles = await findFiles(SKILLS_DIR, '.md');
  for (const file of mdFiles) {
    const content = await readFile(file, 'utf-8');
    for (const { code, startLine } of extractBashBlocks(content)) {
      violations.push(...scanLines(code, file, startLine));
    }
  }

  const total = shFiles.length + mdFiles.length;
  if (violations.length === 0) {
    console.log(`✓ Checked ${total} file(s) — no disallowed commands found.`);
    return;
  }

  console.error(
    `\n✗ Found ${violations.length} disallowed command(s) in ${total} file(s) checked:\n`,
  );
  for (const v of violations) {
    const rel = relative(join(SKILLS_DIR, '..'), v.file);
    console.error(`  ${rel}:${v.line}  [${v.command}]`);
    console.error(`    ${v.content}`);
  }
  console.error(
    '\nThe commands above are not permitted in skill files because they can\n' +
      "cause irreversible harm to a user's system.\n" +
      'See the BLOCKED_COMMANDS list in packages/skills-lint/src/lint.ts.',
  );
  process.exit(1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
