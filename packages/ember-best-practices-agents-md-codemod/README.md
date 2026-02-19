# ember-best-practices-agents-md

Generate an Ember.js best practices index for AI coding agents (Cursor, Claude, etc.). Uses progressive disclosure: a minimal root AGENTS.md that references individual rule files loaded on demand.

Inspired by [Vercel's agents-md codemod](https://github.com/vercel/next.js/blob/canary/packages/next-codemod/lib/agents-md.ts) for Next.js.

## Usage

```bash
npx ember-best-practices-agents-md
```

Or specify the output file:

```bash
npx ember-best-practices-agents-md --output AGENTS.md
npx ember-best-practices-agents-md --output CLAUDE.md
```

## What It Does

1. **Copies best practices** to `.ember-best-practices/` in your project
2. **Injects a compact index** into your AGENTS.md (or CLAUDE.md)
3. **Adds `.ember-best-practices/`** to `.gitignore`

The root AGENTS.md stays small (~2KB). Agents load the index and read specific rule files only when needed.

## Differences from Next.js agents-md

| Next.js | Ember |
|---------|-------|
| Detects Next.js version | No version detection |
| Downloads docs from GitHub | Uses bundled content from this package |
| `.next-docs/` | `.ember-best-practices/` |
| Version-specific docs | Single best-practices set |

## For Agent Tool Authors

The injected index format is pipe-delimited:

```
[Ember Best Practices Index]|root: ./.ember-best-practices|...
rules:{file1.md,file2.md,...}
```

Agents should parse this to discover available rule files and load them on demand.
