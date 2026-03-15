/**
 * Parser for rule markdown files
 */

import { readFile } from 'fs/promises';
import { Rule, ImpactLevel, RuleSourceMetadata } from './types.js';

export interface RuleFile {
  section: number;
  subsection?: number;
  rule: Rule;
  source: RuleSourceMetadata;
}

/**
 * Parse raw markdown into frontmatter + body.
 * This is intentionally tolerant: missing frontmatter is allowed for legacy files.
 */
export function parseRuleSource(content: string): RuleSourceMetadata {
  const frontmatter: Record<string, string> = {};
  const errors: string[] = [];
  const lines = content.split(/\r?\n/);

  if (lines[0]?.trim() !== '---') {
    return {
      hasFrontmatter: false,
      frontmatter,
      body: content,
      errors,
    };
  }

  let frontmatterEnd = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      frontmatterEnd = i;
      break;
    }
  }

  if (frontmatterEnd === -1) {
    errors.push('Unclosed YAML frontmatter block (missing closing ---)');
    return {
      hasFrontmatter: true,
      frontmatter,
      body: '',
      errors,
    };
  }

  for (let i = 1; i < frontmatterEnd; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      errors.push(`Invalid frontmatter line ${i + 1}: "${lines[i]}" (expected key: value)`);
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, '');

    if (!key) {
      errors.push(`Invalid frontmatter line ${i + 1}: empty key`);
      continue;
    }

    if (!value) {
      errors.push(`Invalid frontmatter field "${key}": value cannot be empty`);
      continue;
    }

    frontmatter[key] = value;
  }

  return {
    hasFrontmatter: true,
    frontmatter,
    body: lines.slice(frontmatterEnd + 1).join('\n'),
    errors,
  };
}

/**
 * Parse a rule markdown file into a Rule object
 */
export async function parseRuleFile(filePath: string): Promise<RuleFile> {
  const content = await readFile(filePath, 'utf-8');
  const source = parseRuleSource(content);
  const frontmatter = source.frontmatter;

  // Parse the rule content
  const ruleContent = source.body.trim();
  const ruleLines = ruleContent.split('\n');

  // Extract title (first # or ## heading)
  let title = '';
  let titleLine = 0;
  for (let i = 0; i < ruleLines.length; i++) {
    if (ruleLines[i].startsWith('##')) {
      title = ruleLines[i].replace(/^##+\s*/, '').trim();
      titleLine = i;
      break;
    }
  }

  // Extract impact
  let impact: Rule['impact'] = 'MEDIUM';
  let impactDescription = '';
  let explanation = '';
  let examples: Rule['examples'] = [];
  let references: string[] = [];

  // Parse content after title
  let currentExample: {
    label: string;
    description?: string;
    code: string;
    language?: string;
    additionalText?: string;
  } | null = null;
  let inCodeBlock = false;
  let codeBlockLanguage = 'typescript';
  let codeBlockContent: string[] = [];
  let afterCodeBlock = false;
  let additionalText: string[] = [];
  let hasCodeBlockForCurrentExample = false;

  for (let i = titleLine + 1; i < ruleLines.length; i++) {
    const line = ruleLines[i];

    // Impact line
    if (line.includes('**Impact:')) {
      const match = line.match(/\*\*Impact:\s*(\w+(?:-\w+)?)\s*(?:\(([^)]+)\))?/i);
      if (match) {
        impact = match[1].toUpperCase().replace(/-/g, '-') as ImpactLevel;
        impactDescription = match[2] || '';
      }
      continue;
    }

    // Code block start
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        if (currentExample) {
          currentExample.code = codeBlockContent.join('\n');
          currentExample.language = codeBlockLanguage;
        }
        codeBlockContent = [];
        inCodeBlock = false;
        afterCodeBlock = true;
      } else {
        // Start of code block
        inCodeBlock = true;
        hasCodeBlockForCurrentExample = true;
        codeBlockLanguage = line.slice(3).trim() || 'typescript';
        codeBlockContent = [];
        afterCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Example label (Incorrect, Correct, Example, Usage, Implementation, etc.)
    // Match pattern: **Label:** or **Label (description):** at end of line
    // This distinguishes example labels from inline bold text like "**Trade-off:** some text"
    const labelMatch = line.match(/^\*\*([^:]+?):\*?\*?$/);
    if (labelMatch) {
      // Save previous example if it exists
      if (currentExample) {
        if (additionalText.length > 0) {
          currentExample.additionalText = additionalText.join('\n\n');
          additionalText = [];
        }
        examples.push(currentExample);
      }
      afterCodeBlock = false;
      hasCodeBlockForCurrentExample = false;

      const fullLabel = labelMatch[1].trim();
      // Try to extract description from parentheses if present (handles simple cases)
      // For nested parentheses like "Incorrect (O(n) per lookup)", we keep the full label
      const descMatch = fullLabel.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)*)\s*\(([^()]+)\)$/);
      currentExample = {
        label: descMatch ? descMatch[1].trim() : fullLabel,
        description: descMatch ? descMatch[2].trim() : undefined,
        code: '',
        language: codeBlockLanguage,
      };
      continue;
    }

    // Reference links
    if (line.startsWith('Reference:') || line.startsWith('References:')) {
      // Save current example before processing references
      if (currentExample) {
        if (additionalText.length > 0) {
          currentExample.additionalText = additionalText.join('\n\n');
          additionalText = [];
        }
        examples.push(currentExample);
        currentExample = null;
      }

      const refMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/g);
      if (refMatch) {
        references.push(
          ...refMatch.map((ref) => {
            const m = ref.match(/\[([^\]]+)\]\(([^)]+)\)/);
            return m ? m[2] : ref;
          }),
        );
      }
      continue;
    }

    // Regular text (explanation or additional context after examples)
    if (line.trim() && !line.startsWith('#')) {
      if (!currentExample && !inCodeBlock) {
        // Main explanation before any examples
        explanation += (explanation ? '\n\n' : '') + line;
      } else if (currentExample && (afterCodeBlock || !hasCodeBlockForCurrentExample)) {
        // Text after a code block, or text in a section without a code block
        // (e.g., "When NOT to use this pattern:" with bullet points instead of code)
        additionalText.push(line);
      }
    }
  }

  // Handle last example if still open
  if (currentExample) {
    if (additionalText.length > 0) {
      currentExample.additionalText = additionalText.join('\n\n');
    }
    examples.push(currentExample);
  }

  // Infer section from filename patterns
  // Pattern: area-description.md where area determines section
  const filename = filePath.split('/').pop() || '';
  const sectionMap: Record<string, number> = {
    route: 1,
    bundle: 2,
    component: 3,
    exports: 3,
    a11y: 4,
    service: 5,
    template: 6,
    helper: 6,
    performance: 7,
    testing: 8,
    vscode: 9,
    advanced: 10,
  };

  // Extract area from filename (first part before first dash)
  const area = filename.split('-')[0];
  const frontmatterSection = frontmatter.section ? Number(frontmatter.section) : undefined;
  const section =
    frontmatterSection !== undefined && Number.isInteger(frontmatterSection)
      ? frontmatterSection
      : sectionMap[area] || 0;

  const frontmatterImpact = frontmatter.impact
    ? (frontmatter.impact.toUpperCase().replace(/-/g, '-') as ImpactLevel)
    : undefined;

  const rule: Rule = {
    id: '', // Will be assigned by build script based on sorted order
    title: frontmatter.title || title,
    section: section,
    subsection: undefined,
    impact: frontmatterImpact || impact,
    impactDescription: frontmatter.impactDescription || impactDescription,
    explanation: frontmatter.explanation || explanation.trim(),
    examples,
    references: frontmatter.references
      ? frontmatter.references.split(',').map((r: string) => r.trim())
      : references,
    tags: frontmatter.tags ? frontmatter.tags.split(',').map((t: string) => t.trim()) : undefined,
  };

  return {
    section,
    subsection: 0,
    rule,
    source,
  };
}
