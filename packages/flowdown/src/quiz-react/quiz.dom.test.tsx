/**
 * A form as a reader uses it: answers go to the page, never into the text; questions come a step
 * at a time; a fence still being written takes no answer.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { registerDom } from '../../test/dom'
import { quiz, type QuizAnswer, type QuizResult } from '../quiz/index'
import { Markdown } from '../react/markdown'
import { QuizProvider, quizComponents, type QuizHostProps } from './index'

let teardown: () => Promise<void>
beforeAll(() => {
  teardown = registerDom()
})
afterAll(() => teardown())

const extensions = [quiz()]

async function mount() {
  const { act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const host = document.createElement('div')
  document.body.append(host)
  const handle = createRoot(host)
  const all = (selector: string) => [...host.querySelectorAll<HTMLElement>(selector)]
  const shown = (selector: string) =>
    all(selector).filter((element) => !element.closest('[hidden]'))
  return {
    host,
    all,
    shown,
    render: (node: ReactNode) => act(async () => handle.render(node)),
    act: (work: () => void) => act(async () => work()),
    /** The visible button whose text is this. */
    button: (text: string) =>
      shown('button').find((element) => element.textContent?.trim() === text) as HTMLButtonElement,
    close: async () => {
      await act(async () => handle.unmount())
      host.remove()
    },
  }
}

function page(text: string, props: QuizHostProps = {}, streaming = false) {
  return (
    <QuizProvider {...props}>
      <Markdown extensions={extensions} components={quizComponents} streaming={streaming}>
        {text}
      </Markdown>
    </QuizProvider>
  )
}

const fence = (language: string, info: string, body: string) =>
  `\`\`\`${language}${info ? ` ${info}` : ''}\n${body}\n\`\`\`\n`

const LESSON = fence(
  'quiz',
  'Verbs {#verbs}',
  [
    '### We ___ here.',
    '- [x] are',
    '- [ ] is',
    '',
    '"We" takes "are".',
    '',
    '### Plural ones?',
    '- [x] we',
    '- [x] they',
    '- [ ] I',
    '',
    '### "I am", short',
    "- [x] I'm",
  ].join('\n'),
)

describe('a quiz', () => {
  test('shows one question at a time and checks a choice the moment it is picked', async () => {
    const view = await mount()
    const answers: QuizAnswer[] = []
    await view.render(page(LESSON, { onAnswer: (answer) => answers.push(answer) }))
    expect(view.shown('.fd-question')).toHaveLength(1)
    expect(view.host.textContent).toContain('1 / 3')
    // The explanation waits for the answer.
    expect(view.host.textContent).not.toContain('takes')

    await view.act(() => view.button('is').click())
    expect(answers).toHaveLength(1)
    expect(answers[0]).toMatchObject({ form: 'verbs', index: 0, choice: [1], correct: false })
    expect(view.shown('.fd-option[data-state="wrong"]')).toHaveLength(1)
    expect(view.shown('.fd-option[data-state="right"]')).toHaveLength(0)
    expect(view.host.textContent).toContain('takes')
    // An answered question takes no other answer.
    await view.act(() => view.button('are').click())
    expect(answers).toHaveLength(1)

    await view.act(() => view.button('Next').click())
    expect(view.host.textContent).toContain('2 / 3')
    await view.close()
  })

  test('takes several choices and checks them together', async () => {
    const view = await mount()
    const answers: QuizAnswer[] = []
    await view.render(page(LESSON, { onAnswer: (answer) => answers.push(answer), layout: 'list' }))
    await view.act(() => view.button('we').click())
    await view.act(() => view.button('they').click())
    expect(answers).toHaveLength(0)
    await view.act(() => view.button('Check').click())
    expect(answers[0]).toMatchObject({ index: 1, choice: [0, 1], correct: true })
    await view.close()
  })

  test('takes typed words and reports the form done, with its count, not drawn', async () => {
    const view = await mount()
    const results: QuizResult[] = []
    await view.render(
      page(LESSON, { onComplete: (result) => results.push(result), layout: 'list' }),
    )
    await view.act(() => view.button('are').click())
    await view.act(() => view.button('we').click())
    await view.act(() => view.button('Check').click())
    const input = view.shown('input')[0] as HTMLInputElement
    const { act } = await import('react')
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      set.call(input, "i'm")
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await view.act(() => view.shown('.fd-question')[2]!.querySelector('button')!.click())
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ form: 'verbs', right: 2, total: 3 })
    expect(view.host.textContent).not.toContain('2 / 3')
    await view.close()
  })

  test('opens at the first question a page has no answer for, and shows the ones it has', async () => {
    const view = await mount()
    const first = await (async () => {
      const kept: QuizAnswer[] = []
      await view.render(page(LESSON, { onAnswer: (answer) => kept.push(answer) }))
      await view.act(() => view.button('are').click())
      return kept[0]!
    })()
    await view.close()

    const again = await mount()
    await again.render(page(LESSON, { answers: { verbs: [first] } }))
    expect(again.host.textContent).toContain('2 / 3')
    await again.act(() => again.button('Back').click())
    expect(again.shown('.fd-option[data-state="right"]')).toHaveLength(1)
    await again.close()
  })

  test('with no feedback marks nothing and moves on', async () => {
    const view = await mount()
    const answers: QuizAnswer[] = []
    await view.render(
      page(LESSON, { feedback: 'none', onAnswer: (answer) => answers.push(answer) }),
    )
    await view.act(() => view.button('is').click())
    expect(answers[0]!.correct).toBe(false)
    expect(view.all('[data-state="wrong"]')).toHaveLength(0)
    expect(view.host.textContent).toContain('2 / 3')
    expect(view.host.textContent).not.toContain('takes')
    await view.close()
  })

  test('read-only takes no answer', async () => {
    const view = await mount()
    const answers: QuizAnswer[] = []
    await view.render(page(LESSON, { readOnly: true, onAnswer: (answer) => answers.push(answer) }))
    expect(view.button('are').disabled).toBe(true)
    await view.close()
  })
})

describe('a fence still being written', () => {
  test('shows its questions and takes no answer until it closes', async () => {
    const view = await mount()
    const answers: QuizAnswer[] = []
    const open = `Pick one:\n\n\`\`\`ask Which database?\n- PostgreSQL\n- SQLite`
    await view.render(page(open, { onAnswer: (answer) => answers.push(answer) }, true))
    // Drawn as a form, not as its source.
    expect(view.all('pre')).toHaveLength(0)
    expect(view.button('SQLite').disabled).toBe(true)
    await view.render(page(`${open}\n\`\`\`\n`, { onAnswer: (answer) => answers.push(answer) }))
    await view.act(() => view.button('SQLite').click())
    expect(answers[0]).toMatchObject({ choice: [1], correct: null })
    await view.close()
  })
})

describe('an ask', () => {
  test('waits for the reader’s own words on a field choice', async () => {
    const view = await mount()
    const answers: QuizAnswer[] = []
    await view.render(
      page(fence('ask', 'Which database?', '- PostgreSQL\n- Other: ___'), {
        onAnswer: (answer) => answers.push(answer),
      }),
    )
    await view.act(() => view.button('Other:').click())
    expect(answers).toHaveLength(0)
    expect(view.button('Send').disabled).toBe(true)
    const input = view.shown('input')[0] as HTMLInputElement
    const { act } = await import('react')
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      set.call(input, 'MySQL')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await view.act(() => view.button('Send').click())
    expect(answers[0]).toMatchObject({ choice: [1], text: 'MySQL' })
    await view.close()
  })
})

describe('cards', () => {
  test('turn over and are rated, one after another', async () => {
    const view = await mount()
    const answers: QuizAnswer[] = []
    await view.render(
      page(fence('cards', '', '- καλημέρα — good morning\n- ευχαριστώ — thank you'), {
        onAnswer: (answer) => answers.push(answer),
        labels: { show: 'Turn' },
      }),
    )
    expect(view.shown('.fd-card')).toHaveLength(1)
    expect(view.shown('.fd-card[data-turned]')).toHaveLength(0)
    await view.act(() => view.button('Turn').click())
    expect(view.shown('.fd-card[data-turned]')).toHaveLength(1)
    await view.act(() => view.button('I knew it').click())
    expect(answers[0]).toMatchObject({ index: 0, correct: true })
    // The next card comes at once: a rating has nothing to show.
    expect(view.host.textContent).toContain('2 / 2')
    await view.close()
  })
})
