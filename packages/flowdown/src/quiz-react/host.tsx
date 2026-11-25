'use client'
/**
 * What a page tells every form inside it: where answers go, which it already has, how forms
 * behave. One provider around any number of `<Markdown>`; a form outside one still works, and
 * its answers go nowhere.
 */
import { createContext, useContext, type ReactNode } from 'react'
import type { QuizAnswer, QuizResult } from '../quiz/answer'
import type { QuizForm } from '../quiz/model'

/** The words a form adds around the text, for a page in another language. */
export interface QuizLabels {
  check: string
  next: string
  back: string
  send: string
  right: string
  wrong: string
  /** Under a question that takes several choices. */
  several: string
  /** A field's placeholder. */
  placeholder: string
  /** A card's sides and the reader's rating. */
  show: string
  knew: string
  forgot: string
  /** The step a form is at: `2 / 5`. */
  progress: (step: number, steps: number) => string
}

export const DEFAULT_QUIZ_LABELS: QuizLabels = {
  check: 'Check',
  next: 'Next',
  back: 'Back',
  send: 'Send',
  right: 'Right',
  wrong: 'Not quite',
  several: 'Pick every one that fits',
  placeholder: 'Your answer',
  show: 'Show',
  knew: 'I knew it',
  forgot: 'Not yet',
  progress: (step, steps) => `${step} / ${steps}`,
}

export interface QuizHostProps {
  /** Every answer as it is given: checked, before the reader moves on. */
  onAnswer?: (answer: QuizAnswer, form: QuizForm) => void
  /** A form answered to its end: the last question of a `quiz`, the last choice of an `ask`. */
  onComplete?: (result: QuizResult, form: QuizForm) => void
  /**
   * Answers a page kept, by form id: a form shows them as given and opens at its first question
   * not answered. Read when a form first draws; a form keeps its own answers after that.
   */
  answers?: Readonly<Record<string, readonly QuizAnswer[]>>
  /** The forms show their answers and take no new ones: a reply whose answer was sent. */
  readOnly?: boolean
  /**
   * `immediate` (the default): a `quiz` marks each answer right or wrong and shows its
   * explanation. `none`: nothing is shown, the answers only go to the page (an exam).
   */
  feedback?: 'immediate' | 'none'
  /** `steps` (the default): one question at a time. `list`: every question at once. */
  layout?: 'steps' | 'list'
  /** The choices of each question in an order of their own, the same for the same question. */
  shuffle?: boolean
  /** How typed answers are compared (`normalizeAnswer` by default). */
  normalize?: (text: string) => string
  labels?: Partial<QuizLabels>
  /** What a form shows once it is answered to its end; nothing by default. */
  renderDone?: (result: QuizResult, form: QuizForm, again: () => void) => ReactNode
}

export interface QuizHost extends Omit<QuizHostProps, 'labels'> {
  labels: QuizLabels
}

const QuizHostValue = createContext<QuizHost>({ labels: DEFAULT_QUIZ_LABELS })

export const useQuizHost = () => useContext(QuizHostValue)

/** The forms inside, told where their answers go. */
export function QuizProvider({
  children,
  labels,
  ...host
}: QuizHostProps & { children?: ReactNode }) {
  const value: QuizHost = { ...host, labels: { ...DEFAULT_QUIZ_LABELS, ...labels } }
  return <QuizHostValue.Provider value={value}>{children}</QuizHostValue.Provider>
}
