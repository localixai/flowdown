/**
 * `@localix-ai/flowdown/quiz`: questions in the text that the reader answers. A ```quiz fence
 * checks the answers (`- [x]` marks the right choices), an ```ask fence asks and takes what the
 * reader picks, a ```cards fence holds flash cards the reader turns over and rates. The answers go to the host, never into the text: to keep, to schedule, to send
 * to a model (`answerText`).
 *
 * This entry knows no framework: the extension a page passes `<Markdown>` (or any target), and
 * what a server needs to read forms and check answers itself. Drawing them is
 * `@localix-ai/flowdown/quiz/react`.
 */
import { parse, visit } from '../engine/index'
import type { Extension, Node } from '../engine/types'
import { readCards } from './cards'
import { readForm, type QuizForm, type QuizKind } from './model'

export {
  answerText,
  grade,
  normalizeAnswer,
  resultOf,
  type QuizAnswer,
  type QuizResult,
} from './answer'
export { readCards } from './cards'
export {
  readForm,
  type QuizAnswerMode,
  type QuizForm,
  type QuizKind,
  type QuizOption,
  type QuizQuestion,
} from './model'

export interface QuizOptions {
  /** The fence languages read as each kind: `{ quiz: 'quiz', ask: 'ask', cards: 'cards' }` by default. */
  languages?: Partial<Record<QuizKind, string>>
}

const languagesOf = (options: QuizOptions): Record<string, QuizKind> => {
  const named = options.languages ?? {}
  return {
    [named.quiz ?? 'quiz']: 'quiz',
    [named.ask ?? 'ask']: 'ask',
    [named.cards ?? 'cards']: 'cards',
  }
}

/** The fence's language and the rest of its line, as the parser keeps them. */
const formOf = (node: Node, kind: QuizKind) =>
  kind === 'cards'
    ? readCards(node.value ?? '', node.meta ?? '')
    : readForm(kind, node.value ?? '', node.meta ?? '')

/**
 * The extension: a ```quiz or ```ask fence becomes a form, one that holds no list stays code.
 * Pass the same array on every render (a module constant): a new one reads every block again.
 */
export function quiz(options: QuizOptions = {}): Extension {
  const fences: Record<string, (node: Node) => Node | null> = {}
  for (const [language, kind] of Object.entries(languagesOf(options)))
    fences[language] = (node) => formOf(node, kind)?.node ?? null
  return { name: 'quiz', fences }
}

/**
 * Every form in a text, in order: what a server reads to check answers itself, or to send the
 * reader the text with no key in it.
 */
export function readForms(markdown: string, options: QuizOptions = {}): QuizForm[] {
  const languages = languagesOf(options)
  const out: QuizForm[] = []
  visit(parse(markdown), (node: Node) => {
    const kind = node.type === 'code' && node.lang !== undefined ? languages[node.lang] : undefined
    const form = kind === undefined ? null : formOf(node, kind)
    if (form) out.push(form.form)
  })
  return out
}
