/**
 * A ```cards fence read into flash cards. Each is a front and a back, written either way:
 *
 * - a list item, its two sides parted by ` — `, ` – `, ` = ` or ` | ` (`- καλημέρα — good morning`);
 * - a heading, the front, with what follows it up to the next heading as the back (any Markdown).
 *
 * A card is a question answered by recall: the reader turns it over and says whether they knew
 * it, and that is the answer a host gets, ready for its own spaced repetition.
 */
import { parse, toText } from '../engine/index'
import type { Node } from '../engine/types'
import { element, hash, infoOf, sections, type QuizForm, type QuizQuestion } from './model'

/** The sides of a list item: the first parting mark with words on both sides of it. */
const SIDES = /\s+(?:—|–|=|\|)\s+/

const text = (value: string): Node => ({ type: 'text', value })

interface Side {
  front: string
  back: string
  frontNodes: Node[]
  backNodes: Node[]
}

function fromItem(item: Node): Side | null {
  const words = toText(item).trim()
  const at = SIDES.exec(words)
  if (!at || at.index === 0) return null
  const front = words.slice(0, at.index).trim()
  const back = words.slice(at.index + at[0].length).trim()
  if (!back) return null
  return { front, back, frontNodes: [text(front)], backNodes: [text(back)] }
}

/** The cards a fence holds, or null when it holds none: then it stays the code it is. */
export function readCards(body: string, info = ''): { form: QuizForm; node: Node } | null {
  const { title, given } = infoOf(info)
  const sides: Side[] = []
  for (const section of sections(parse(body).children ?? [])) {
    if (section.heading) {
      const back = section.blocks
      sides.push({
        front: toText(section.heading).trim(),
        back: back
          .map((block) => toText(block))
          .join('\n')
          .trim(),
        frontNodes: section.heading.children ?? [],
        backNodes: back,
      })
      continue
    }
    for (const block of section.blocks)
      if (block.type === 'list')
        for (const item of block.children ?? []) {
          const side = fromItem(item)
          if (side) sides.push(side)
        }
  }
  if (sides.length === 0) return null
  const questions: QuizQuestion[] = sides.map((side, index) => ({
    id: hash(`${side.front}\n${side.back}`),
    index,
    text: side.front,
    answer: 'recall',
    graded: true,
    options: [],
    accept: [],
    back: side.back,
  }))
  const children: Node[] = []
  if (title) children.push(element('quizTitle', 'fd-quiz-title', [text(title)]))
  sides.forEach((side, index) =>
    children.push(
      element(
        'quizCard',
        'fd-card',
        [
          element('quizFront', 'fd-card-front', side.frontNodes),
          element('quizBack', 'fd-card-back', side.backNodes),
        ],
        { quizQuestion: index },
      ),
    ),
  )
  const form: QuizForm = {
    kind: 'cards',
    id: given ?? hash(`cards ${info}\n${body}`),
    title,
    questions,
  }
  const root = element('quiz', 'fd-quiz', children, { quiz: form })
  ;(root.data!.hProperties as Record<string, unknown>).dataQuiz = 'cards'
  return { form, node: root }
}
