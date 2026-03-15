/**
 * Type definitions for Ember Best Practices rules (performance and accessibility)
 */

export type ImpactLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM-HIGH' | 'MEDIUM' | 'LOW-MEDIUM' | 'LOW';

export interface CodeExample {
  label: string; // e.g., "Incorrect", "Correct", "Example"
  description?: string; // Optional description before code
  code: string;
  language?: string; // Default: 'typescript' or 'tsx'
  additionalText?: string; // Optional text after code block (explanations, reasons)
}

/**
 * Source-level metadata extracted from markdown files before normalization.
 */
export interface RuleSourceMetadata {
  hasFrontmatter: boolean;
  frontmatter: Record<string, string>;
  body: string;
  errors: string[];
}

export interface Rule {
  id: string; // e.g., "1.1", "2.3"
  title: string;
  section: number; // Main section number (1-10)
  subsection?: number; // Subsection number within section
  impact: ImpactLevel;
  impactDescription?: string; // e.g., "2-10× improvement"
  explanation: string;
  examples: CodeExample[];
  references?: string[]; // URLs or citations
  tags?: string[]; // For categorization/search
}

export interface Section {
  number: number;
  title: string;
  impact: ImpactLevel;
  impactDescription?: string;
  introduction?: string;
  rules: Rule[];
}

export interface GuidelinesDocument {
  version: string;
  organization: string;
  date: string;
  abstract: string;
  sections: Section[];
  references?: string[];
}

export interface TestCase {
  ruleId: string;
  ruleTitle: string;
  type: 'bad' | 'good';
  code: string;
  language: string;
  description?: string;
}
