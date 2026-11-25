'use client'
/**
 * `fd-card`: a flash card. Its front shows; the reader turns it over, sees the back, and says
 * whether they knew it: that rating is the card's answer. A card rated shows both sides.
 */
import { useState, type ReactNode } from 'react'
import { useFormState } from './form'

type PartProps = { node?: unknown; children?: ReactNode }

const indexOf = (node: unknown) =>
  (node as { data?: { quizQuestion?: number } } | undefined)?.data?.quizQuestion

export function Card({ node, children }: PartProps) {
  const state = useFormState()
  const index = indexOf(node)
  const question = index === undefined ? undefined : state?.form.questions[index]
  const [turned, setTurned] = useState(false)
  if (!state || !question) return <>{children}</>
  const answer = state.answers[question.index]
  const open = turned || answer !== undefined
  const { labels } = state.host
  const hidden = state.host.layout !== 'list' && state.step !== question.index
  return (
    <div
      className="fd-card"
      hidden={hidden}
      data-turned={open || undefined}
      data-verdict={answer === undefined ? undefined : answer.correct ? 'right' : 'wrong'}
    >
      {children}
      <div className="fd-quiz-controls">
        {!open && (
          <button
            type="button"
            className="fd-quiz-button"
            disabled={!state.live}
            onClick={() => setTurned(true)}
          >
            {labels.show}
          </button>
        )}
        {open && answer === undefined && (
          <>
            <button
              type="button"
              className="fd-quiz-button"
              data-quiet=""
              disabled={!state.live}
              onClick={() => state.rate(question.index, false)}
            >
              {labels.forgot}
            </button>
            <button
              type="button"
              className="fd-quiz-button"
              disabled={!state.live}
              onClick={() => state.rate(question.index, true)}
            >
              {labels.knew}
            </button>
          </>
        )}
        {answer !== undefined && state.host.layout !== 'list' && question.index > 0 && (
          <button
            type="button"
            className="fd-quiz-button"
            data-quiet=""
            onClick={() => state.go(question.index - 1)}
          >
            {labels.back}
          </button>
        )}
      </div>
    </div>
  )
}

/** `fd-card-back`: hidden until the card is turned (the stylesheet keys on `data-turned`). */
export function CardBack({ children }: PartProps) {
  return <div className="fd-card-back">{children}</div>
}
