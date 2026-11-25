/**
 * A ```quiz or ```ask fence read into questions: the model a host keeps answers by, and the tree
 * the renderer draws. The body is ordinary Markdown: a heading opens each question, the first list
 * after it holds the choices, what stands between is the question's text and what follows the list
 * explains the answer.
 *
 * The answer key rides on the tree's root as data, never as an attribute: a page drawn without
 * the quiz's components shows the questions and their choices, and no mark of which is right.
 */
import { parse, toText } from '../engine/index'
import type { Node } from '../engine/types'

/**
 * `quiz`: the choices marked `[x]` are right and an answer is checked. `ask`: the reader's choice.
 * `cards`: flash cards, a front and a back; the reader turns one over and says whether they knew it.
 */
export type QuizKind = 'quiz' | 'ask' | 'cards'

/** One choice, by its place in the text. */
export interface QuizOption {
  index: number
  /** Its words, as plain text: what an answer reports and what a model is told. */
  text: string
  /** `quiz`: whether it is right. `ask`: null. */
  correct: boolean | null
  /** `ask`: picked before the reader picks (`- [x]`). */
  preset: boolean
  /** `ask`: a field for the reader's own words (`___`, or `Other: ___`). */
  other: boolean
}

/** How a question is answered: one choice, several, words typed, or a card recalled. */
export type QuizAnswerMode = 'one' | 'many' | 'text' | 'recall'

export interface QuizQuestion {
  /** A hash of the question's words and choices: it stays while the question does. */
  id: string
  index: number
  /** The question's heading, or the form's title for a form of one question without one. */
  text: string
  answer: QuizAnswerMode
  /** Whether an answer is checked: a `quiz` question with a right choice or answer. */
  graded: boolean
  /** The choices shown; none for a typed answer. */
  options: QuizOption[]
  /** A typed `quiz` answer: every form accepted. Not drawn anywhere. */
  accept: string[]
  /** A card's back, as plain text: what `answerText` and a host's own deck read. */
  back?: string
}

export interface QuizForm {
  kind: QuizKind
  /** `{#id}` on the fence's line, or a hash of the whole fence: the same text, the same form. */
  id: string
  title: string
  questions: QuizQuestion[]
}

/** The words of a choice that stand for a field: three or more underscores at its end. */
const BLANK = /_{3,}\s*$/
/**
 * Whether a choice is a field: its words end in a blank. A choice of underscores alone is read by
 * CommonMark as a rule (`- ___`), so an item that holds only a rule is a blank too.
 */
const isBlank = (item: Node): boolean => {
  const only = item.children?.length === 1 ? item.children[0] : undefined
  return only?.type === 'thematicBreak' || BLANK.test(toText(item))
}

/** An id given on the fence's line: `{#name}`, letters, digits, `-`, `_`, `.`, `:`. */
const GIVEN_ID = /\s*\{#([\w.:-]+)\}\s*$/

/** A fence line's title and the id it gives (`{#name}`), if it gives one. */
export function infoOf(info: string): { title: string; given: string | undefined } {
  const match = GIVEN_ID.exec(info)
  return { title: (match ? info.slice(0, match.index) : info).trim(), given: match?.[1] }
}

/** FNV-1a, 32 bits, in base 36: short, stable across runs and platforms, no randomness. */
export function hash(text: string): string {
  let value = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 0x01000193) >>> 0
  }
  return value.toString(36)
}

export const element = (type: string, tag: string, children: Node[], data: object = {}): Node => ({
  type,
  children,
  data: { hName: tag, hProperties: { className: [tag] }, ...data },
})

export interface Section {
  heading: Node | null
  blocks: Node[]
}

/** The body cut at its headings; what comes before the first heading is a section of its own. */
export function sections(blocks: Node[]): Section[] {
  const out: Section[] = [{ heading: null, blocks: [] }]
  for (const block of blocks) {
    if (block.type === 'heading') out.push({ heading: block, blocks: [] })
    else out.at(-1)!.blocks.push(block)
  }
  return out.filter((section) => section.heading !== null || section.blocks.length > 0)
}

/** A list item's own words, drawn without the paragraph a loose list wraps them in. */
const choiceContent = (item: Node): Node[] => {
  const children = item.children ?? []
  const only = children.length === 1 ? children[0] : undefined
  return only?.type === 'paragraph' ? (only.children ?? []) : children
}

/** How a question answers, from its list: see the module's comment and `docs/quiz.md`. */
function modeOf(kind: QuizKind, items: Node[], task: boolean) {
  const marked = items.filter((item) => item.checked === true).length
  const blanks = items.filter(isBlank).length
  if (kind === 'quiz' && task && marked > 0) {
    if (marked === items.length) return { answer: 'text' as const, graded: true }
    return { answer: marked === 1 ? ('one' as const) : ('many' as const), graded: true }
  }
  if (items.length === 1 && blanks === 1) return { answer: 'text' as const, graded: false }
  return { answer: task ? ('many' as const) : ('one' as const), graded: false }
}

/** One question: its model and its tree. `title` names a question that has no heading. */
function question(kind: QuizKind, section: Section, index: number, title: string) {
  const at = section.blocks.findIndex((block) => block.type === 'list')
  const list = section.blocks[at]!
  const items = list.children ?? []
  const task = items.length > 0 && items.every((item) => item.checked !== undefined)
  const { answer, graded } = modeOf(kind, items, task)
  const text = section.heading ? toText(section.heading).trim() : title
  const options: QuizOption[] =
    answer === 'text' && graded
      ? []
      : items.map((item, place) => ({
          index: place,
          text: toText(item).trim(),
          correct: kind === 'quiz' && graded ? item.checked === true : null,
          preset: kind === 'ask' && item.checked === true,
          other: isBlank(item),
        }))
  const accept = answer === 'text' && graded ? items.map((item) => toText(item).trim()) : []
  const model: QuizQuestion = {
    id: hash(`${text}\n${items.map((item) => toText(item).trim()).join('\n')}`),
    index,
    text,
    answer,
    graded,
    options,
    accept,
  }
  const parts: Node[] = []
  if (section.heading)
    parts.push(element('quizText', 'fd-question-text', section.heading.children ?? []))
  const prompt = section.blocks.slice(0, at)
  if (prompt.length > 0) parts.push(element('quizPrompt', 'fd-prompt', prompt))
  if (answer === 'text') parts.push(element('quizField', 'fd-field', [], { quizQuestion: index }))
  else
    parts.push(
      element(
        'quizOptions',
        'fd-options',
        items.map((item, place) =>
          element('quizOption', 'fd-option', choiceContent(item), {
            quizQuestion: index,
            quizOption: place,
          }),
        ),
      ),
    )
  const explain = section.blocks.slice(at + 1)
  if (explain.length > 0)
    parts.push(element('quizExplain', 'fd-explain', explain, { quizQuestion: index }))
  return { model, node: element('quizQuestion', 'fd-question', parts, { quizQuestion: index }) }
}

/**
 * The form a fence holds, or null when it holds no question (no list anywhere): then the fence
 * stays the code it is. `info` is what follows the language on the fence's line.
 */
export function readForm(
  kind: QuizKind,
  body: string,
  info = '',
): { form: QuizForm; node: Node } | null {
  const { title, given } = infoOf(info)
  const all = sections(parse(body).children ?? [])
  const questions: QuizQuestion[] = []
  const children: Node[] = []
  if (title) children.push(element('quizTitle', 'fd-quiz-title', [{ type: 'text', value: title }]))
  // Text before a question (an intro, a section without a list) stays where it is, drawn always.
  let loose: Node[] = []
  for (const section of all) {
    if (!section.blocks.some((block) => block.type === 'list')) {
      loose.push(...(section.heading ? [section.heading] : []), ...section.blocks)
      continue
    }
    if (loose.length > 0) children.push(element('quizIntro', 'fd-quiz-intro', loose))
    loose = []
    const read = question(kind, section, questions.length, title)
    questions.push(read.model)
    children.push(read.node)
  }
  if (questions.length === 0) return null
  if (loose.length > 0) children.push(element('quizIntro', 'fd-quiz-intro', loose))
  const form: QuizForm = {
    kind,
    id: given ?? hash(`${kind} ${info}\n${body}`),
    title,
    questions,
  }
  const root = element('quiz', 'fd-quiz', children, { quiz: form })
  ;(root.data!.hProperties as Record<string, unknown>).dataQuiz = kind
  return { form, node: root }
}
