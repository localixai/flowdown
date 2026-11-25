/**
 * What a reader answered, checked and written down: the one shape every host gets, whatever it
 * does next (keeps it, schedules it, tells a model). Nothing here draws.
 */
import type { QuizForm, QuizKind, QuizQuestion } from './model'

export interface QuizAnswer {
  /** The form's id and the question's: where a host keeps the answer. */
  form: string
  question: string
  /** The question's place in its form. */
  index: number
  /** The choices picked, by their place in the text, in that order. */
  choice: number[]
  /** The words typed: a typed answer, or a choice's own field (`Other: ___`). */
  text: string
  /** `quiz`: whether the answer is right. `ask`, or a question with nothing to check: null. */
  correct: boolean | null
}

/** A form answered to its end: every answer, and for a `quiz` how many were right. */
export interface QuizResult {
  form: string
  kind: QuizKind
  answers: QuizAnswer[]
  /** Right answers; null for an `ask`. */
  right: number | null
  /** Questions that are checked: the count `right` is out of. */
  total: number
}

/**
 * How typed words are compared: case and the spaces around and between words do not count, nor
 * a full stop at the end. A host that wants accents not to count either passes its own.
 */
export const normalizeAnswer = (text: string): string =>
  text
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!;·]+$/u, '')
    .trimEnd()

/** Whether an answer to a question is right; null when the question checks nothing. */
export function grade(
  question: QuizQuestion,
  answer: Pick<QuizAnswer, 'choice' | 'text'>,
  normalize: (text: string) => string = normalizeAnswer,
): boolean | null {
  if (!question.graded) return null
  // A card is rated by the reader, not checked: `rate` gives its answer, not this.
  if (question.answer === 'recall') return null
  if (question.answer === 'text') {
    const typed = normalize(answer.text)
    return typed !== '' && question.accept.some((accepted) => normalize(accepted) === typed)
  }
  const right = question.options.filter((option) => option.correct).map((option) => option.index)
  const picked = new Set(answer.choice)
  return picked.size === right.length && right.every((index) => picked.has(index))
}

/** An answer as `answerText` says it: the choices' words, a field's typed words in their place. */
function said(question: QuizQuestion, answer: QuizAnswer): string {
  if (question.answer === 'recall') return answer.correct ? 'knew it' : 'did not know it'
  if (question.answer === 'text') return answer.text.trim()
  return answer.choice
    .map((index) => {
      const option = question.options[index]
      if (option === undefined) return ''
      if (!option.other) return option.text
      const label = option.text
        .replace(/_{3,}\s*$/, '')
        .trim()
        .replace(/:$/, '')
      const own = answer.text.trim()
      return label ? `${label}: ${own}` : own
    })
    .filter(Boolean)
    .join('; ')
}

/**
 * A form's answers as Markdown, one line a question: what a host sends a model as the reader's
 * next message. A `quiz` says too whether each was right. Questions not answered are left out.
 */
export function answerText(form: QuizForm, answers: readonly QuizAnswer[]): string {
  const lines: string[] = []
  // A form of one question with no heading is asked by its title: said once, in its line.
  const titled =
    form.title !== '' && form.questions.some((question) => question.text !== form.title)
  if (titled) lines.push(`**${form.title}**`, '')
  for (const question of form.questions) {
    const answer = answers.find((each) => each.question === question.id)
    if (answer === undefined) continue
    const mark =
      answer.correct === null || question.answer === 'recall'
        ? ''
        : answer.correct
          ? ' (right)'
          : ' (wrong)'
    lines.push(
      `- ${question.text || `Question ${question.index + 1}`}: ${said(question, answer)}${mark}`,
    )
  }
  return lines.join('\n')
}

/** The result of a form from its answers, as `onComplete` reports it. */
export function resultOf(form: QuizForm, answers: readonly QuizAnswer[]): QuizResult {
  const graded = form.questions.filter((question) => question.graded)
  return {
    form: form.id,
    kind: form.kind,
    answers: [...answers],
    right: form.kind === 'ask' ? null : answers.filter((answer) => answer.correct === true).length,
    total: graded.length,
  }
}
