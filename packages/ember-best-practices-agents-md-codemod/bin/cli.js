#!/usr/bin/env node
/**
 * CLI for ember-best-practices-agents-md
 *
 * Usage:
 *   npx ember-best-practices-agents-md
 *   npx ember-best-practices-agents-md --output AGENTS.md
 */

import fs from "fs";
import path from "path";
import {
  DOCS_DIR_NAME,
  collectDocFiles,
  copyBestPractices,
  ensureGitignoreEntry,
  generateIndex,
  injectIntoAgentsMd,
} from "../lib/agents-md.js";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function cyan(s) {
  return `\x1b[36m${s}\x1b[0m`;
}
function green(s) {
  return `\x1b[32m${s}\x1b[0m`;
}
function bold(s) {
  return `\x1b[1m${s}\x1b[0m`;
}

async function run(options = {}) {
  const cwd = process.cwd();
  const targetFile = options.output || "AGENTS.md";
  const claudeMdPath = path.join(cwd, targetFile);
  const docsPath = path.join(cwd, DOCS_DIR_NAME);
  const docsLinkPath = `./${DOCS_DIR_NAME}`;

  let sizeBefore = 0;
  let isNewFile = true;
  let existingContent = "";

  if (fs.existsSync(claudeMdPath)) {
    existingContent = fs.readFileSync(claudeMdPath, "utf-8");
    sizeBefore = Buffer.byteLength(existingContent, "utf-8");
    isNewFile = false;
  }

  console.log(`\nCopying Ember.js best practices to ${cyan(DOCS_DIR_NAME)}...`);

  try {
    copyBestPractices(docsPath);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }

  const docFiles = collectDocFiles(path.join(docsPath, "rules"));
  const filePaths = docFiles.map((f) => `rules/${f.relativePath}`);

  const indexContent = generateIndex({
    docsPath: docsLinkPath,
    files: filePaths,
    outputFile: targetFile,
  });

  const newContent = injectIntoAgentsMd(existingContent, indexContent);
  fs.writeFileSync(claudeMdPath, newContent, "utf-8");

  const sizeAfter = Buffer.byteLength(newContent, "utf-8");
  const gitignoreResult = ensureGitignoreEntry(cwd);

  const action = isNewFile ? "Created" : "Updated";
  const sizeInfo = isNewFile
    ? formatSize(sizeAfter)
    : `${formatSize(sizeBefore)} → ${formatSize(sizeAfter)}`;

  console.log(`${green("✓")} ${action} ${bold(targetFile)} (${sizeInfo})`);
  if (gitignoreResult.updated) {
    console.log(`${green("✓")} Added ${bold(DOCS_DIR_NAME)} to .gitignore`);
  }
  console.log("");
}

// Parse args (minimal: --output)
const args = process.argv.slice(2);
const outputIdx = args.indexOf("--output");
const output =
  outputIdx >= 0 && args[outputIdx + 1] ? args[outputIdx + 1] : null;

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
ember-best-practices-agents-md - Ember.js best practices for AI coding agents

Usage:
  npx ember-best-practices-agents-md [options]

Options:
  --output <file>   Target file (default: AGENTS.md). Use CLAUDE.md for Claude projects.
  --help, -h        Show this help

This command:
  1. Copies Ember best practices to .ember-best-practices/
  2. Injects a compact index into your AGENTS.md or CLAUDE.md
  3. Adds .ember-best-practices/ to .gitignore

Agents (Cursor, Claude, etc.) load the small index and read specific rule files on demand.
`);
  process.exit(0);
}

run({ output }).catch((err) => {
  console.error(err);
  process.exit(1);
});
