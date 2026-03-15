import type { Config } from 'prettier';
// @ts-expect-error # there are no types
import emberTemplateTag from 'prettier-plugin-ember-template-tag';

export default {
  printWidth: 100,
  singleQuote: true,
  plugins: [emberTemplateTag],
  overrides: [
    {
      files: ['*.gts', '*.gjs', '*.md'],
      options: {
        templateSingleQuote: false,
      },
    },
  ],
} satisfies Config;
