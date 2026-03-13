# Agent Skills

A collection of skills for AI coding agents. Skills are packaged instructions and scripts that extend agent capabilities.

Skills follow the [Agent Skills](https://agentskills.io/) format.

See [the RFC](https://github.com/emberjs/rfcs/pull/1165) for todos for things that should/could go in this repo

## Ember Best Practices (Progressive Disclosure)

For Ember.js projects, use the **agents-md codemod** to inject a minimal AGENTS.md that references best practices loaded on demand:

```bash
pnpm dlx skills add ember-tooling/agent-skills
```

See [the skills repo](https://github.com/vercel-labs/skills) for documentation on the skills tool

## Available Skills

### ember-best-practices

Ember.js performance optimization and accessibility guidelines from the Ember.js community. Contains 42+ rules across 7 categories, prioritized by impact.

**Use when:**

- Writing new Ember components or routes
- Implementing data fetching with WarpDrive
- Reviewing code for performance issues
- Optimizing bundle size or load times
- Implementing accessibility features

**Categories covered:**

- Route Loading and Data Fetching (Critical)
- Build and Bundle Optimization (Critical)
- Component and Reactivity (High)
- Accessibility Best Practices (High)
- Service and State Management (Medium-High)
- Template Optimization (Medium)
- Advanced Patterns (Low-Medium)

## Installation

```bash
npx add-skill ember-tooling/agent-skills
```

## Usage

Skills are automatically available once installed. The agent will use them when relevant tasks are detected.

**Examples:**

```
Deploy my app
```

```
Review this Ember component for performance issues
```

```
Help me optimize this Ember.js route
```

## Skill Structure

Each skill contains:

- `SKILL.md` - Instructions for the agent
- `scripts/` - Helper scripts for automation (optional)
- `references/` - Supporting documentation (optional)

## License

MIT
