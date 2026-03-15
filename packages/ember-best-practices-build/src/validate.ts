#!/usr/bin/env node
/**
 * Validate rule files follow the correct structure
 */

import { readdir } from 'fs/promises';
import { join } from 'path';
import { RULES_DIR } from './config.js';
import { parseRuleFile } from './parser.js';
import { Rule, RuleSourceMetadata } from './types.js';

interface ValidationError {
  file: string;
  ruleId?: string;
  message: string;
}

const VALID_IMPACTS: Rule['impact'][] = [
  'CRITICAL',
  'HIGH',
  'MEDIUM-HIGH',
  'MEDIUM',
  'LOW-MEDIUM',
  'LOW',
];

const REQUIRED_FRONTMATTER_FIELDS = ['title', 'impact', 'impactDescription', 'tags'] as const;

/**
 * Validate markdown source-level format against the rule template contract.
 */
function validateRuleSource(source: RuleSourceMetadata, file: string): ValidationError[] {
  const errors: ValidationError[] = [];
  errors.push(
    ...source.errors.map((message) => ({
      file,
      message,
    })),
  );

  if (!source.hasFrontmatter) {
    errors.push({
      file,
      message: 'Missing YAML frontmatter block (must start with ---)',
    });
  }

  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    const value = source.frontmatter[field];
    if (!value || value.trim().length === 0) {
      errors.push({
        file,
        message: `Missing required frontmatter field "${field}"`,
      });
    }
  }

  const impact = source.frontmatter.impact as Rule['impact'] | undefined;
  if (impact && !VALID_IMPACTS.includes(impact)) {
    errors.push({
      file,
      message: `Invalid frontmatter impact "${impact}". Must be one of: ${VALID_IMPACTS.join(', ')}`,
    });
  }

  if (source.frontmatter.tags) {
    const tags = source.frontmatter.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (tags.length === 0) {
      errors.push({
        file,
        message: 'Frontmatter "tags" must include at least one comma-separated tag',
      });
    }
  }

  const bodyLines = source.body.split(/\r?\n/);
  const firstContentLine = bodyLines.find((line) => line.trim().length > 0);
  if (!firstContentLine?.startsWith('## ')) {
    errors.push({
      file,
      message: 'Body must start with a level-2 heading (## Rule Title)',
    });
  }

  const headingMatch = source.body.match(/^##\s+(.+)$/m);
  if (!headingMatch) {
    errors.push({
      file,
      message: 'Missing required rule heading (## Rule Title)',
    });
  } else if (source.frontmatter.title) {
    const headingTitle = headingMatch[1].trim();
    if (headingTitle !== source.frontmatter.title.trim()) {
      errors.push({
        file,
        message: `Frontmatter title "${source.frontmatter.title}" must match heading "${headingTitle}"`,
      });
    }
  }

  // Allow variants like "Incorrect (why):", "❌ Incorrect (...):", etc.
  const hasIncorrect = /\*\*[^*\n]*\bincorrect\b[^*\n]*:\*?\*?/i.test(source.body);
  const hasCorrect = /\*\*[^*\n]*\bcorrect\b[^*\n]*:\*?\*?/i.test(source.body);

  if (!hasIncorrect) {
    errors.push({
      file,
      message: 'Missing required "**Incorrect ...:**" section',
    });
  }

  if (!hasCorrect) {
    errors.push({
      file,
      message: 'Missing required "**Correct ...:**" section',
    });
  }

  return errors;
}

/**
 * Validate a rule
 */
function validateRule(rule: Rule, file: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Note: rule.id is auto-generated during build, not required in source files

  if (!rule.title || rule.title.trim().length === 0) {
    errors.push({ file, ruleId: rule.id, message: 'Missing or empty title' });
  }

  if (!rule.explanation || rule.explanation.trim().length === 0) {
    errors.push({ file, ruleId: rule.id, message: 'Missing or empty explanation' });
  }

  if (!rule.examples || rule.examples.length === 0) {
    errors.push({
      file,
      ruleId: rule.id,
      message: 'Missing examples (need at least one bad and one good example)',
    });
  } else {
    // Filter out informational examples (notes, trade-offs, etc.) that don't have code
    const codeExamples = rule.examples.filter((e) => e.code && e.code.trim().length > 0);

    const hasBad = codeExamples.some(
      (e) =>
        e.label.toLowerCase().includes('incorrect') ||
        e.label.toLowerCase().includes('wrong') ||
        e.label.toLowerCase().includes('bad'),
    );
    const hasGood = codeExamples.some(
      (e) =>
        e.label.toLowerCase().includes('correct') ||
        e.label.toLowerCase().includes('good') ||
        e.label.toLowerCase().includes('usage') ||
        e.label.toLowerCase().includes('implementation') ||
        e.label.toLowerCase().includes('example'),
    );

    if (codeExamples.length === 0) {
      errors.push({ file, ruleId: rule.id, message: 'Missing code examples' });
    } else if (!hasBad && !hasGood) {
      errors.push({
        file,
        ruleId: rule.id,
        message: 'Missing bad/incorrect or good/correct examples',
      });
    }
  }

  if (!VALID_IMPACTS.includes(rule.impact)) {
    errors.push({
      file,
      ruleId: rule.id,
      message: `Invalid impact level: ${rule.impact}. Must be one of: ${VALID_IMPACTS.join(', ')}`,
    });
  }

  return errors;
}

/**
 * Main validation function
 */
async function validate() {
  try {
    console.log('Validating rule files...');
    console.log(`Rules directory: ${RULES_DIR}`);

    const files = await readdir(RULES_DIR);
    const ruleFiles = files.filter((f) => f.endsWith('.md') && !f.startsWith('_'));

    const allErrors: ValidationError[] = [];

    for (const file of ruleFiles) {
      const filePath = join(RULES_DIR, file);
      try {
        const parsed = await parseRuleFile(filePath);
        allErrors.push(...validateRuleSource(parsed.source, file));
        const errors = validateRule(parsed.rule, file);
        allErrors.push(...errors);
      } catch (error) {
        allErrors.push({
          file,
          message: `Failed to parse: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    if (allErrors.length > 0) {
      // Dedupe repeated messages from source/object validation overlap.
      const uniqueErrors = allErrors.filter((error, index, all) => {
        const key = `${error.file}|${error.ruleId || ''}|${error.message}`;
        return index === all.findIndex((e) => `${e.file}|${e.ruleId || ''}|${e.message}` === key);
      });

      console.error('\n✗ Validation failed:\n');
      uniqueErrors.forEach((error) => {
        console.error(
          `  ${error.file}${error.ruleId ? ` (${error.ruleId})` : ''}: ${error.message}`,
        );
      });
      process.exit(1);
    } else {
      console.log(`✓ All ${ruleFiles.length} rule files are valid`);
    }
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
}

validate();
