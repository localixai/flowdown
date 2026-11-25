'use client'
/**
 * One form, drawn by the renderer's own elements: this component keeps its answers and the step
 * it is at, and its parts (`parts.tsx`) read them from `FormState`.
 */
import { createContext, useContext, useState, type ReactNode } from 'react'
import { GrowingFence } from '../react/context'
import { grade, resultOf, type QuizAnswer } from '../quiz/answer'
import { hash, type QuizForm, type QuizQuestion } from '../quiz/model'
import { useQuizHost, type QuizHost } from './host'

interface Draft {
  choice: number[]
  text: string
}

export interface FormState {
  form: QuizForm
  host: QuizHost
  step: number
  answers: ReadonlyArray<QuizAnswer | undefined>
  drafts: readonly Draft[]
  /** Whether the reader can answer now: the fence is written to its end and not read-only. */
  live: boolean
  /** Whether a `quiz` shows right and wrong. */
  marks: boolean
  pick: (question: number, option: number) => void
  type: (question: number, text: string) => void
  submit: (question: number) => void
  /** A card: whether the reader knew it. */
  rate: (question: number, knew: boolean) => void
  go: (step: number) => void
  /** Where a choice stands among its question's: its own place, or a shuffled one. */
  place: (question: number, option: number) => number
}

export const FormStateValue = createContext<FormState | null>(null)
export const useFormState = () => useContext(FormStateValue)

const EMPTY: Draft = { choice: [], text: '' }

/** The answers a page kept for this form, in its questions' order. */
function restored(form: QuizForm, kept: readonly QuizAnswer[] | undefined) {
  return form.questions.map((question) => kept?.find((answer) => answer.question === question.id))
}

const firstOpen = (answers: ReadonlyArray<QuizAnswer | undefined>) => {
  const open = answers.findIndex((answer) => answer === undefined)
  return open === -1 ? Math.max(0, answers.length - 1) : open
}

/** Whether a draft can be sent: a choice, or words where words are asked for. */
export function ready(question: QuizQuestion, draft: Draft): boolean {
  if (question.answer === 'text') return draft.text.trim() !== ''
  if (draft.choice.length === 0) return false
  const other = draft.choice.some((index) => question.options[index]?.other)
  return !other || draft.text.trim() !== ''
}

/**
 * `fd-quiz`: the form whose model the extension put on the node. Its state starts again when the
 * form becomes another: a fence still being written grows a question at a time.
 */
export function Form({ node, children }: { node?: unknown; children?: ReactNode }) {
  const form = (node as { data?: { quiz?: QuizForm } } | undefined)?.data?.quiz
  if (!form) return <>{children}</>
  return (
    <FormBody key={`${form.id}:${form.questions.length}`} form={form}>
      {children}
    </FormBody>
  )
}

function FormBody({ form, children }: { form: QuizForm; children?: ReactNode }) {
  const host = useQuizHost()
  const growing = useContext(GrowingFence)
  const [answers, setAnswers] = useState(() => restored(form, host.answers?.[form.id]))
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    form.questions.map((question, index) => {
      const kept = answers[index]
      if (kept) return { choice: kept.choice, text: kept.text }
      return {
        choice: question.options.filter((option) => option.preset).map((o) => o.index),
        text: '',
      }
    }),
  )
  const [step, setStep] = useState(() => firstOpen(answers))
  const [round, setRound] = useState(0)
  const steps = form.questions.length
  const live = !growing && !host.readOnly
  const marks = form.kind === 'quiz' && host.feedback !== 'none'

  const draftOf = (question: number) => drafts[question] ?? EMPTY
  const setDraft = (question: number, draft: Draft) =>
    setDrafts((all) => all.map((each, index) => (index === question ? draft : each)))

  const submit = (index: number, draft = draftOf(index), rated?: boolean) => {
    const question = form.questions[index]
    if (!live || question === undefined || answers[index] !== undefined) return
    if (rated === undefined && !ready(question, draft)) return
    const answer: QuizAnswer = {
      form: form.id,
      question: question.id,
      index,
      choice: draft.choice,
      text: draft.text.trim(),
      correct: rated ?? grade(question, draft, host.normalize),
    }
    const next = answers.map((each, at) => (at === index ? answer : each))
    setAnswers(next)
    host.onAnswer?.(answer, form)
    const done = next.every((each) => each !== undefined)
    if (done) host.onComplete?.(resultOf(form, next as QuizAnswer[]), form)
    // With nothing to show about an answer, the next question comes at once.
    if ((!marks || rated !== undefined) && !done && host.layout !== 'list') setStep(firstOpen(next))
  }

  const pick = (index: number, option: number) => {
    const question = form.questions[index]
    if (!live || question === undefined || answers[index] !== undefined) return
    const current = draftOf(index)
    if (question.answer === 'many') {
      const has = current.choice.includes(option)
      const choice = has
        ? current.choice.filter((each) => each !== option)
        : [...current.choice, option]
      setDraft(index, { ...current, choice })
      return
    }
    const draft = { ...current, choice: [option] }
    setDraft(index, draft)
    // One choice is the answer, unless it is a field that waits for the reader's words.
    if (!question.options[option]?.other) submit(index, draft)
  }

  const again = () => {
    setAnswers(form.questions.map(() => undefined))
    setDrafts(form.questions.map(() => EMPTY))
    setStep(0)
    setRound((value) => value + 1)
  }

  const state: FormState = {
    form,
    host,
    step,
    answers,
    drafts,
    live,
    marks,
    pick,
    type: (index, text) => setDraft(index, { ...draftOf(index), text }),
    submit: (index) => submit(index),
    rate: (index, knew) => submit(index, EMPTY, knew),
    go: (next) => setStep(Math.min(Math.max(0, next), steps - 1)),
    place: (index, option) => {
      if (!host.shuffle) return option
      const question = form.questions[index]
      const order = (question?.options ?? []).map((each) => each.index)
      order.sort((a, b) => hash(`${question?.id}:${a}`).localeCompare(hash(`${question?.id}:${b}`)))
      return order.indexOf(option)
    },
  }
  const done = answers.every((answer) => answer !== undefined)
  const result = done ? resultOf(form, answers as QuizAnswer[]) : null
  return (
    <FormStateValue.Provider value={state}>
      <div
        key={round}
        className="fd-quiz"
        data-quiz={form.kind}
        data-layout={host.layout ?? 'steps'}
        aria-busy={growing || undefined}
      >
        {steps > 1 && host.layout !== 'list' && (
          <div className="fd-quiz-progress" aria-hidden="true">
            {form.questions.map((question, index) => (
              <span
                key={question.id}
                className="fd-quiz-dot"
                data-state={
                  index === step
                    ? 'current'
                    : answers[index] === undefined
                      ? 'open'
                      : marks
                        ? answers[index]!.correct
                          ? 'right'
                          : 'wrong'
                        : 'done'
                }
              />
            ))}
            <span className="fd-quiz-step">{host.labels.progress(step + 1, steps)}</span>
          </div>
        )}
        {children}
        {result && host.renderDone?.(result, form, again)}
      </div>
    </FormStateValue.Provider>
  )
}
