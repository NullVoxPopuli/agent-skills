/**
 * agents-md: Generate Ember.js best practices index for AI coding agents.
 *
 * Copies bundled best practices to .ember-best-practices/, builds a compact
 * index of all doc files, and injects it into AGENTS.md or CLAUDE.md.
 *
 * Adapted from Vercel's next.js agents-md (https://github.com/vercel/next.js).
 * Key differences: no version detection, uses bundled content from this repo.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Directory name for best practices in user's project */
export const DOCS_DIR_NAME = ".ember-best-practices";

/** Gitignore entry to add */
const GITIGNORE_ENTRY = ".ember-best-practices/";

/** Markers for injected content - allows safe re-runs */
const START_MARKER = "<!-- EMBER-BEST-PRACTICES-AGENTS-MD-START -->";
const END_MARKER = "<!-- EMBER-BEST-PRACTICES-AGENTS-MD-END -->";

/**
 * Get the path to bundled best-practices content.
 * When running from monorepo, prefers ../../skills/ember-best-practices.
 * When published, uses ./best-practices relative to package.
 */
export function getBundledBestPracticesPath() {
  const pkgRoot = path.join(__dirname, "..");
  const monorepoPath = path.join(pkgRoot, "../../skills/ember-best-practices");
  const bundledPath = path.join(pkgRoot, "best-practices");

  if (fs.existsSync(monorepoPath)) {
    return monorepoPath;
  }
  return bundledPath;
}

/**
 * Copy best practices from bundled source to destination in user's project.
 */
export function copyBestPractices(destDir) {
  const sourceDir = getBundledBestPracticesPath();
  const rulesSource = path.join(sourceDir, "rules");
  const rulesDest = path.join(destDir, "rules");

  if (!fs.existsSync(rulesSource)) {
    throw new Error(
      `Best practices source not found at ${rulesSource}. Run "pnpm prepare" in the package.`,
    );
  }

  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true });
  }
  fs.mkdirSync(path.dirname(rulesDest), { recursive: true });
  fs.mkdirSync(rulesDest, { recursive: true });

  const entries = fs.readdirSync(rulesSource, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith("_") && entry.name !== "_sections.md") continue;
    if (entry.name === "README.md") continue;
    const srcPath = path.join(rulesSource, entry.name);
    const destPath = path.join(rulesDest, entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(srcPath, destPath, { recursive: true });
    } else if (entry.name.endsWith(".md")) {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  if (fs.existsSync(path.join(sourceDir, "metadata.json"))) {
    fs.copyFileSync(
      path.join(sourceDir, "metadata.json"),
      path.join(destDir, "metadata.json"),
    );
  }
}

/**
 * Collect all .md doc files (excluding index files) from a directory.
 */
export function collectDocFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true })
    .filter(
      (f) =>
        typeof f === "string" &&
        f.endsWith(".md") &&
        !/[/\\]index\.md$/i.test(f) &&
        !f.startsWith("index."),
    )
    .sort()
    .map((f) => ({ relativePath: f.replace(/\\/g, "/") }));
}

/**
 * Group files by directory for compact index format.
 */
function groupByDirectory(files) {
  const grouped = new Map();
  for (const filePath of files) {
    const lastSlash = Math.max(
      filePath.lastIndexOf("/"),
      filePath.lastIndexOf("\\"),
    );
    const dir = lastSlash === -1 ? "." : filePath.slice(0, lastSlash);
    const fileName =
      lastSlash === -1 ? filePath : filePath.slice(lastSlash + 1);
    const existing = grouped.get(dir);
    if (existing) {
      existing.push(fileName);
    } else {
      grouped.set(dir, [fileName]);
    }
  }
  return grouped;
}

/**
 * Generate the compressed index string for injection into AGENTS.md.
 * Format matches Next.js agents-md for tool compatibility.
 */
export function generateIndex(data) {
  const { docsPath, files, outputFile = "AGENTS.md" } = data;
  const parts = [];

  parts.push("[Ember Best Practices Index]");
  parts.push(`root: ${docsPath}`);
  parts.push(
    "STOP. What you remember about Ember.js may be outdated. Always search docs and read before any Ember task.",
  );
  parts.push(
    `If docs missing, run: npx ember-best-practices-agents-md --output ${outputFile}`,
  );

  const grouped = groupByDirectory(files);
  for (const [dir, fileNames] of grouped) {
    parts.push(`${dir}:{${fileNames.join(",")}}`);
  }

  return parts.join("|");
}

function hasExistingIndex(content) {
  return content.includes(START_MARKER);
}

function wrapWithMarkers(content) {
  return `${START_MARKER}\n${content}\n${END_MARKER}`;
}

/**
 * Inject index content into AGENTS.md (or CLAUDE.md).
 * Replaces existing injected block if present.
 */
export function injectIntoAgentsMd(agentsMdContent, indexContent) {
  const wrappedContent = wrapWithMarkers(indexContent);

  if (hasExistingIndex(agentsMdContent)) {
    const startIdx = agentsMdContent.indexOf(START_MARKER);
    const endIdx = agentsMdContent.indexOf(END_MARKER) + END_MARKER.length;
    return (
      agentsMdContent.slice(0, startIdx) +
      wrappedContent +
      agentsMdContent.slice(endIdx)
    );
  }

  const separator = agentsMdContent.endsWith("\n") ? "\n" : "\n\n";
  return agentsMdContent + separator + wrappedContent + "\n";
}

/**
 * Add .ember-best-practices/ to .gitignore if not already present.
 */
export function ensureGitignoreEntry(cwd) {
  const gitignorePath = path.join(cwd, ".gitignore");
  const entryRegex = /^\s*\.ember-best-practices(?:\/.*)?$/;

  let content = "";
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, "utf-8");
  }

  const hasEntry = content.split(/\r?\n/).some((line) => entryRegex.test(line));

  if (hasEntry) {
    return { path: gitignorePath, updated: false, alreadyPresent: true };
  }

  const needsNewline = content.length > 0 && !content.endsWith("\n");
  const header = content.includes("# ember-best-practices-agents-md")
    ? ""
    : "# ember-best-practices-agents-md\n";
  const newContent =
    content + (needsNewline ? "\n" : "") + header + GITIGNORE_ENTRY + "\n";

  fs.writeFileSync(gitignorePath, newContent, "utf-8");
  return { path: gitignorePath, updated: true, alreadyPresent: false };
}
