/**
 * `flowdown/prompt`: the instructions that teach a model to write the dialect.
 *
 * A model writes the forms it was told about and no others: without these lines, a renderer's
 * steps, tabs and callouts go unused, and a reply's shape is whatever the model defaults to
 * (headings on a two-line answer, bullet lists where a comparison belonged, a warning buried
 * mid-paragraph). Every marker and example here is read from `dialect.ts`, the file the renderer
 * reads too, and the tests render each example: the prompt cannot teach a form that would print as
 * raw text.
 *
 * Plain text, no dependencies, safe on a server. Every character rides every request's prompt, so
 * a rule is one line, and only the forms a model cannot know are shown in full.
 */
import {
  ANSWER_FORM_EXAMPLES,
  CALLOUT_KINDS,
  DIAGRAM_FENCE_LANGUAGE,
  DIAGRAM_KINDS,
  TREE_FENCE_LANGUAGE,
} from '../dialect'

// The names a prompt of your own builds its lines from, the same ones the renderer reads.
export {
  ANSWER_FORM_EXAMPLES,
  CALLOUT_KINDS,
  DIAGRAM_FENCE_LANGUAGE,
  DIAGRAM_KINDS,
  TREE_FENCE_LANGUAGE,
  type CalloutKind,
} from '../dialect'

export interface AnswerFormatOptions {
  /** The section's heading line. */
  header?: string
  /** Mention `$…$` math. Off by default, like `<Markdown math>`: turn both on together. */
  math?: boolean
  /** Teach ```mermaid diagrams. Off by default, like `<Markdown mermaid>`: turn both on together. */
  diagrams?: boolean
}

export const ANSWER_FORMAT_HEADER = '# Answer formatting'

/** An example under its rule line, two spaces in, blank lines kept blank. */
const shown = (lines: readonly string[]) =>
  lines.map((line) => (line ? `  ${line}` : '')).join('\n')

/**
 * One line for the rules at the top of a system prompt. Described only in a section further down,
 * the forms read as an optional reference: a model still answered "plan by day" with a numbered
 * list and "worth it?" with prose. Stated among the leading rules, they are part of answering.
 */
export function answerFormsPrinciple(header = ANSWER_FORMAT_HEADER): string {
  return `- Shape every reply with the forms in "${header.replace(/^#+\s*/, '')}": the page renders them, and a plain list or table where a form fits is a formatting defect.`
}

/** The section that teaches the dialect, ready to place in a system prompt. */
export function answerFormatPrompt({
  header = ANSWER_FORMAT_HEADER,
  math = false,
  diagrams = false,
}: AnswerFormatOptions = {}): string {
  const markers = CALLOUT_KINDS.map((kind) => `[!${kind.toUpperCase()}]`).join(' ')
  const { comparison, verdict, steps, stats, details, sources } = ANSWER_FORM_EXAMPLES
  const lines = [
    header,
    answerFormsPrinciple(header),
    `Replies render as GitHub Markdown${math ? ' with $…$ math' : ''} plus the forms below; the user's style preferences override them.`,
    // A decision list, read top-down, first match wins. A catalogue of forms made "compare options
    // in a table" the only rule a "compare X and Y" request matched, and every comparison a table.
    'Match the content to the first form that fits; a table or list is the fallback. Write a marker as its own quote line, the content unquoted after it.',
    '- Lead with the answer. Short replies use prose; long ones use `##` per thread, short paragraphs and selective bold.',
    `- Options compared (X vs Y, which to use) or variants (per OS, language): a tab per option, \`#### Label\`; a compared option holds its sides. After them a \`---\`, then one line on when to pick which:\n${shown(comparison)}`,
    `- One option weighed (should I, is it worth it): its sides, then the verdict:\n${shown(verdict)}`,
    `- Stages in order (a plan, recovery, schedule, by day, a procedure): steps, never a numbered list:\n${shown(steps)}`,
    `- Headline figures (speedups, sizes, key numbers): stats:\n${shown(stats)}`,
    '- Exact values across options (specs, prices, limits): a table.',
    `- A risk or key aside: one or two callouts, quotes starting \`> [!KIND]\` (${markers}); text after the marker titles it.`,
    `- Long secondary material (a full log, raw output, a derivation): folded, its content quoted:\n${shown(details)}`,
    `- Pages the reply draws on: sources, last:\n${shown(sources)}`,
    `- A directory layout: a \`\`\`${TREE_FENCE_LANGUAGE} fence of \`├──\`/\`└──\` lines. Things to do: \`- [ ] item\`.`,
    '- Code for a file names it: ```ts title="src/app.ts". A change to code: a ```diff fence.',
  ]
  if (diagrams) {
    lines.push(
      `- Draw what a picture explains better in a \`\`\`${DIAGRAM_FENCE_LANGUAGE} fence (${DIAGRAM_KINDS.join(', ')}); quote labels with punctuation.`,
      '- Draw proactively for branching flows, structure and data; prefer one useful picture over ASCII art. Use supplied data; label illustrative data. Never claim an unsupported chart type.',
    )
  }
  lines.push('- Quote attribution: `> — Author`. Image caption: `![alt](url "Caption")`.')
  return lines.join('\n')
}
