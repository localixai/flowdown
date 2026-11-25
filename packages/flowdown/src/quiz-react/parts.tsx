'use client'
/**
 * The parts of a form, each drawn where the renderer meets its element: a question shows on its
 * step, a choice is a radio or a checkbox, a field takes words, an explanation shows once
 * answered. Each reads the form it is in from `FormState`; outside one it is its content.
 */
import { useId, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import type { QuizAnswer } from '../quiz/answer'
import type { QuizQuestion } from '../quiz/model'
import { ready, useFormState, type FormState } from './form'

type PartProps = { node?: unknown; children?: ReactNode }

const dataOf = (node: unknown) =>
  ((node as { data?: Record<string, unknown> } | undefined)?.data ?? {}) as {
    quizQuestion?: number
    quizOption?: number
  }

/** A question's own controls under its choices: check, send, next, back. */
function Controls({
  state,
  question,
  answer,
}: {
  state: FormState
  question: QuizQuestion
  answer: QuizAnswer | undefined
}) {
  const { labels, layout } = state.host
  const index = question.index
  const last = index === state.form.questions.length - 1
  const steps = layout !== 'list' && state.form.questions.length > 1
  const draft = state.drafts[index] ?? { choice: [], text: '' }
  const needsButton =
    question.answer !== 'one' ||
    question.options.some((option) => option.other && draft.choice.includes(option.index))
  return (
    <div className="fd-quiz-controls">
      {steps && index > 0 && (
        <button
          type="button"
          className="fd-quiz-button"
          data-quiet=""
          onClick={() => state.go(index - 1)}
        >
          {labels.back}
        </button>
      )}
      {answer === undefined && needsButton && (
        <button
          type="button"
          className="fd-quiz-button"
          disabled={!state.live || !ready(question, draft)}
          onClick={() => state.submit(index)}
        >
          {state.form.kind === 'ask' && last ? labels.send : labels.check}
        </button>
      )}
      {answer !== undefined && steps && !last && (
        <button type="button" className="fd-quiz-button" onClick={() => state.go(index + 1)}>
          {labels.next}
        </button>
      )}
    </div>
  )
}

/** `fd-question`: one question, shown on its step, its answer marked when the form marks them. */
export function Question({ node, children }: PartProps) {
  const state = useFormState()
  const index = dataOf(node).quizQuestion
  const question = index === undefined ? undefined : state?.form.questions[index]
  if (!state || !question) return <>{children}</>
  const answer = state.answers[question.index]
  const hidden = state.host.layout !== 'list' && state.step !== question.index
  const verdict = answer === undefined || !state.marks ? null : answer.correct
  return (
    <div
      className="fd-question"
      hidden={hidden}
      data-answer={question.answer}
      data-answered={answer !== undefined || undefined}
      data-verdict={verdict === null ? undefined : verdict ? 'right' : 'wrong'}
    >
      {children}
      {question.answer === 'many' && answer === undefined && (
        <p className="fd-quiz-hint">{state.host.labels.several}</p>
      )}
      <p className="fd-quiz-verdict" aria-live="polite">
        {verdict === null ? '' : verdict ? state.host.labels.right : state.host.labels.wrong}
      </p>
      <Controls state={state} question={question} answer={answer} />
    </div>
  )
}

/** The state a choice is drawn in: picked, and once marked, right, wrong or missed. */
function choiceState(state: FormState, question: QuizQuestion, option: number) {
  const answer = state.answers[question.index]
  const picked = (answer?.choice ?? state.drafts[question.index]?.choice ?? []).includes(option)
  if (answer === undefined || !state.marks) return picked ? 'picked' : undefined
  const correct = question.options[option]?.correct === true
  if (correct) return picked ? 'right' : 'missed'
  return picked ? 'wrong' : undefined
}

/** `fd-option`: a choice. A radio for one, a checkbox for several; a field for `Other: ___`. */
export function Option({ node, children }: PartProps) {
  const state = useFormState()
  const { quizQuestion, quizOption } = dataOf(node)
  const question = quizQuestion === undefined ? undefined : state?.form.questions[quizQuestion]
  const option = quizOption === undefined ? undefined : question?.options[quizOption]
  if (!state || !question || !option) return <>{children}</>
  const answer = state.answers[question.index]
  const look = choiceState(state, question, option.index)
  const checked = look !== undefined && look !== 'missed'
  const style: CSSProperties = { order: state.place(question.index, option.index) }
  const open = state.live && answer === undefined
  return (
    <div className="fd-option" data-state={look} style={style}>
      <button
        type="button"
        role={question.answer === 'many' ? 'checkbox' : 'radio'}
        aria-checked={checked}
        disabled={!open}
        className="fd-option-button"
        onClick={() => state.pick(question.index, option.index)}
      >
        <span className="fd-option-mark" aria-hidden="true" />
        <span className="fd-option-text">
          {option.other ? option.text.replace(/_{3,}\s*$/, '').trim() || children : children}
        </span>
      </button>
      {option.other && checked && <OwnWords state={state} question={question} disabled={!open} />}
    </div>
  )
}

/** The words a reader types: a typed answer, or a choice's own field. */
function OwnWords({
  state,
  question,
  disabled,
}: {
  state: FormState
  question: QuizQuestion
  disabled: boolean
}) {
  const id = useId()
  const answer = state.answers[question.index]
  const value = answer?.text ?? state.drafts[question.index]?.text ?? ''
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    state.submit(question.index)
  }
  return (
    <input
      id={id}
      className="fd-field-input"
      value={value}
      disabled={disabled}
      placeholder={state.host.labels.placeholder}
      aria-label={question.text || state.host.labels.placeholder}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => state.type(question.index, event.target.value)}
      onKeyDown={onKeyDown}
    />
  )
}

/** `fd-field`: a typed answer, marked once checked; a wrong one shows what was accepted. */
export function Field({ node }: PartProps) {
  const state = useFormState()
  const index = dataOf(node).quizQuestion
  const question = index === undefined ? undefined : state?.form.questions[index]
  if (!state || !question) return null
  const answer = state.answers[question.index]
  const marked = answer !== undefined && state.marks && answer.correct !== null
  return (
    <div
      className="fd-field"
      data-state={marked ? (answer.correct ? 'right' : 'wrong') : undefined}
    >
      <OwnWords state={state} question={question} disabled={!state.live || answer !== undefined} />
      {marked && !answer.correct && question.accept[0] !== undefined && (
        <p className="fd-field-accepted">{question.accept[0]}</p>
      )}
    </div>
  )
}

/** `fd-explain`: why the answer is what it is, shown once the question is answered. */
export function Explain({ node, children }: PartProps) {
  const state = useFormState()
  const index = dataOf(node).quizQuestion
  if (!state || index === undefined) return null
  const answer = state.answers[index]
  if (answer === undefined || (state.form.kind === 'quiz' && !state.marks)) return null
  return <div className="fd-explain">{children}</div>
}

/** The options' row: a group named by its question, so a screen reader says what it picks. */
export function Options({ children }: PartProps) {
  return (
    <div className="fd-options" role="group">
      {children}
    </div>
  )
}
