import { describe, expect, test } from 'bun:test'
import { parse } from '../engine/index'
import { renderToHtml } from '../static/index'
import {
  answerText,
  grade,
  normalizeAnswer,
  quiz,
  readForms,
  resultOf,
  type QuizAnswer,
} from './index'

const fence = (language: string, info: string, body: string) =>
  `\`\`\`${language}${info ? ` ${info}` : ''}\n${body}\n\`\`\`\n`

const LESSON = fence(
  'quiz',
  'The verb {#verb-be}',
  [
    '### We ___ in Limassol.',
    'Pick the form.',
    '',
    '- [x] are',
    '- [ ] is',
    '- [ ] am',
    '',
    '"We" takes "are".',
    '',
    '### Which are plural?',
    '- [x] we',
    '- [x] they',
    '- [ ] I',
    '',
    '### Write "I am" in one word',
    "- [x] I'm",
    '- [x] Im',
  ].join('\n'),
)

describe('a quiz fence', () => {
  const [form] = readForms(LESSON)

  test('is a form of questions, one a heading, with its title and the id it gives', () => {
    expect(form).toBeDefined()
    expect(form!.kind).toBe('quiz')
    expect(form!.id).toBe('verb-be')
    expect(form!.title).toBe('The verb')
    expect(form!.questions.map((question) => question.text)).toEqual([
      'We ___ in Limassol.',
      'Which are plural?',
      'Write "I am" in one word',
    ])
  })

  test('answers by one choice, by several, or by words, as the marks say', () => {
    expect(form!.questions.map((question) => question.answer)).toEqual(['one', 'many', 'text'])
    expect(form!.questions[0]!.options.map((option) => option.correct)).toEqual([
      true,
      false,
      false,
    ])
    // A typed answer shows no choices: they are the answers it takes.
    expect(form!.questions[2]!.options).toEqual([])
    expect(form!.questions[2]!.accept).toEqual(["I'm", 'Im'])
  })

  test('checks answers', () => {
    const [one, many, text] = form!.questions
    expect(grade(one!, { choice: [0], text: '' })).toBe(true)
    expect(grade(one!, { choice: [1], text: '' })).toBe(false)
    expect(grade(many!, { choice: [1, 0], text: '' })).toBe(true)
    expect(grade(many!, { choice: [0], text: '' })).toBe(false)
    expect(grade(many!, { choice: [0, 1, 2], text: '' })).toBe(false)
    expect(grade(text!, { choice: [], text: "  i'M. " })).toBe(true)
    expect(grade(text!, { choice: [], text: '' })).toBe(false)
  })

  test('takes a page’s own comparison of typed words', () => {
    const text = form!.questions[2]!
    const noApostrophe = (value: string) => normalizeAnswer(value).replace(/'/g, '')
    expect(grade(text, { choice: [], text: 'IM' }, noApostrophe)).toBe(true)
  })

  test('keeps its id while its text stays, and gives a new one when the text changes', () => {
    const plain = fence('quiz', '', '- [x] yes\n- [ ] no')
    const again = readForms(plain)[0]!.id
    expect(readForms(plain)[0]!.id).toBe(again)
    expect(readForms(fence('quiz', '', '- [x] yes\n- [ ] maybe'))[0]!.id).not.toBe(again)
  })

  test('without a heading is one question, asked by its title', () => {
    const [single] = readForms(fence('quiz', 'Is the sea salty?', '- [x] Yes\n- [ ] No'))
    expect(single!.questions).toHaveLength(1)
    expect(single!.questions[0]!.text).toBe('Is the sea salty?')
  })

  test('with no list stays the code it was written as', () => {
    const text = fence('quiz', '', 'Just words.')
    expect(readForms(text)).toEqual([])
    expect(renderToHtml(text, { extensions: [quiz()] })).toContain('<pre>')
  })
})

describe('the answer key', () => {
  test('is not in what a page without the quiz’s components draws', () => {
    const html = renderToHtml(LESSON, { extensions: [quiz()] })
    expect(html).toContain('fd-question')
    expect(html).toContain('We ___ in Limassol.')
    // The choices are there, with no mark of the right one; a typed answer's forms are not.
    expect(html).toContain('>is<')
    expect(html).not.toContain('checked')
    expect(html).not.toContain('correct')
    expect(html).not.toContain('Im<')
  })

  test('is checked by its own rules on a link a model wrote in a choice', () => {
    const html = renderToHtml(fence('quiz', '', '- [x] [yes](javascript:alert(1))\n- [ ] no'), {
      extensions: [quiz()],
    })
    expect(html).not.toContain('javascript:')
  })
})

describe('an ask fence', () => {
  test('takes one choice from a list, several from a checklist, words from a blank', () => {
    const forms = readForms(
      [
        fence('ask', 'Which database?', '- PostgreSQL\n- SQLite\n- Other: ___'),
        fence('ask', 'Which parts?', '- [x] Auth\n- [ ] Billing'),
        fence('ask', 'Name the project', '- ___'),
      ].join('\n'),
    )
    expect(forms.map((form) => form.questions[0]!.answer)).toEqual(['one', 'many', 'text'])
    expect(forms[0]!.questions[0]!.options[2]!.other).toBe(true)
    // `[x]` in an ask picks a choice before the reader does; nothing is right or wrong.
    expect(forms[1]!.questions[0]!.options.map((option) => option.preset)).toEqual([true, false])
    expect(forms[1]!.questions[0]!.graded).toBe(false)
    expect(grade(forms[1]!.questions[0]!, { choice: [1], text: '' })).toBeNull()
  })

  test('says what the reader answered, for a model', () => {
    const [form] = readForms(
      fence('ask', 'Which database?', '- PostgreSQL\n- SQLite\n- Other: ___'),
    )
    const answer: QuizAnswer = {
      form: form!.id,
      question: form!.questions[0]!.id,
      index: 0,
      choice: [2],
      text: 'MySQL',
      correct: null,
    }
    expect(answerText(form!, [answer])).toBe('- Which database?: Other: MySQL')
    expect(resultOf(form!, [answer]).right).toBeNull()
  })
})

describe('a cards fence', () => {
  const [deck] = readForms(
    fence(
      'cards',
      'Greetings {#hi}',
      '- καλημέρα — good morning\n- ευχαριστώ = thank you\n- no sides here\n\n### Πώς σε λένε;\nWhat is your **name**?',
    ),
  )

  test('holds a card per item with two sides and per heading', () => {
    expect(deck!.kind).toBe('cards')
    expect(deck!.questions.map((card) => [card.text, card.back])).toEqual([
      ['καλημέρα', 'good morning'],
      ['ευχαριστώ', 'thank you'],
      ['Πώς σε λένε;', 'What is your name?'],
    ])
    expect(deck!.questions.every((card) => card.answer === 'recall')).toBe(true)
  })

  test('is rated by the reader, and says so to a model', () => {
    const card = deck!.questions[0]!
    expect(grade(card, { choice: [], text: '' })).toBeNull()
    const answer: QuizAnswer = {
      form: 'hi',
      question: card.id,
      index: 0,
      choice: [],
      text: '',
      correct: true,
    }
    expect(answerText(deck!, [answer])).toContain('- καλημέρα: knew it')
    expect(resultOf(deck!, [answer])).toMatchObject({ right: 1, total: 3 })
  })
})

describe('the extension', () => {
  test('reads fences under the languages a page names', () => {
    const text = fence('test', '', '- [x] a\n- [ ] b')
    expect(readForms(text)).toEqual([])
    expect(readForms(text, { languages: { quiz: 'test' } })).toHaveLength(1)
    const root = parse(text, { extensions: [quiz({ languages: { quiz: 'test' } })] })
    expect(root.children?.[0]?.data?.hName).toBe('fd-quiz')
  })
})
