/**
 * `@localix-ai/flowdown/quiz/react`: forms drawn in React. Pass `quizComponents` to `<Markdown>`
 * with the `quiz()` extension, and wrap the page in `<QuizProvider>` to get the answers:
 *
 * ```tsx
 * const extensions = [quiz()]
 * <QuizProvider onAnswer={(answer, form) => save(answer)}>
 *   <Markdown extensions={extensions} components={quizComponents}>{text}</Markdown>
 * </QuizProvider>
 * ```
 */
import type { ComponentType, ReactNode } from 'react'
import { Card, CardBack } from './card'
import { Form } from './form'
import { Explain, Field, Option, Options, Question } from './parts'

export { DEFAULT_QUIZ_LABELS, QuizProvider, type QuizHostProps, type QuizLabels } from './host'
export { useFormState, type FormState } from './form'

/** The elements the extension makes, each drawn by its part. Spread with a page's own. */
export const quizComponents: Record<
  string,
  ComponentType<{ node?: unknown; children?: ReactNode }>
> = {
  'fd-quiz': Form,
  'fd-question': Question,
  'fd-options': Options,
  'fd-option': Option,
  'fd-field': Field,
  'fd-explain': Explain,
  'fd-card': Card,
  'fd-card-back': CardBack,
}
