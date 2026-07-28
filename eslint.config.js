import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * Whiskeyjack app lint rules.
 *
 * The conventions in AGENTS.md that a machine can check live here rather than
 * only in prose, because a failing lint run is a feedback loop and prose is a
 * suggestion. Every rule below is chosen for a near-zero false-positive rate --
 * a noisy rule trains everyone, human and agent alike, to reach for
 * eslint-disable, which is worse than having no rule.
 *
 * Deliberately NOT enforced here: the copywriting rule against contrastive
 * negation ("It's not X, it's Y"). Its legitimate exceptions ("no email
 * needed", "instead of a modal dialog", error text) are indistinguishable from
 * the banned form by regex. That one stays a review concern.
 */

/** Tailwind palette hues the design system does NOT map to tokens. */
const RAW_HUES = [
  'red', 'blue', 'green', 'purple', 'pink', 'gray', 'grey', 'slate', 'zinc',
  'stone', 'amber', 'lime', 'emerald', 'teal', 'cyan', 'sky', 'indigo',
  'violet', 'fuchsia', 'rose',
].join('|')

// bg-red-500, text-slate-700, border-sky-200, … but NOT the token-backed
// scales (neutral, warm, accent, success, warning, error, info, orange, yellow).
const RAW_PALETTE = String.raw`\b(bg|text|border|ring|divide|from|via|to|outline|decoration|shadow|fill|stroke|accent|caret)-(${RAW_HUES})-\d{2,3}\b`
// bg-[#ff0000], text-[#123], …
const ARBITRARY_HEX = String.raw`-\[#[0-9a-fA-F]{3,8}\]`

export default tseslint.config(
  { ignores: ['dist', 'src-tauri', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Icons: Phosphor only. The design system ships no icon library and takes
      // icon nodes as props, so a second one is always an accident.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react',
              message: 'Icons are Phosphor only. Import from @phosphor-icons/react.',
            },
            {
              name: 'react-icons',
              message: 'Icons are Phosphor only. Import from @phosphor-icons/react.',
            },
            {
              name: '@radix-ui/react-icons',
              message: 'Icons are Phosphor only. Import from @phosphor-icons/react.',
            },
            {
              name: '@tabler/icons-react',
              message: 'Icons are Phosphor only. Import from @phosphor-icons/react.',
            },
          ],
          patterns: [
            {
              group: ['@heroicons/*'],
              message: 'Icons are Phosphor only. Import from @phosphor-icons/react.',
            },
          ],
        },
      ],

      'no-restricted-syntax': [
        'error',
        // Em dashes are banned project-wide, in UI copy and comments alike.
        {
          selector: 'Literal[value=/\\u2014/]',
          message: 'Use an en dash (–), never an em dash (—).',
        },
        {
          selector: 'TemplateElement[value.raw=/\\u2014/]',
          message: 'Use an en dash (–), never an em dash (—).',
        },
        {
          selector: 'JSXText[value=/\\u2014/]',
          message: 'Use an en dash (–), never an em dash (—).',
        },
        // Colour must come from tokens, so raw Tailwind palette hues and
        // arbitrary hex values in a className are both wrong. The token-backed
        // scales (neutral, warm, accent, success, warning, error, info, orange,
        // yellow) stay allowed.
        {
          selector: `JSXAttribute[name.name='className'] Literal[value=/${RAW_PALETTE}/]`,
          message:
            'Use a design-system token scale (accent, neutral, warm, success, warning, error, info) instead of a raw Tailwind palette colour.',
        },
        {
          selector: `JSXAttribute[name.name='className'] TemplateElement[value.raw=/${RAW_PALETTE}/]`,
          message:
            'Use a design-system token scale (accent, neutral, warm, success, warning, error, info) instead of a raw Tailwind palette colour.',
        },
        {
          selector: `JSXAttribute[name.name='className'] Literal[value=/${ARBITRARY_HEX}/]`,
          message:
            'Use a token CSS variable, e.g. bg-[var(--color-accent-500)], instead of a hardcoded hex.',
        },
        {
          selector: `JSXAttribute[name.name='className'] TemplateElement[value.raw=/${ARBITRARY_HEX}/]`,
          message:
            'Use a token CSS variable, e.g. bg-[var(--color-accent-500)], instead of a hardcoded hex.',
        },
      ],
    },
  },
)
