---
title: Questions and cards
description:
  Questions, choices and flash cards written in the text, answered by the reader a step at a time,
  checked at once, and handed to the page as data to keep, score or send back to a model.
---

# Questions and cards

Three fences turn into something the reader answers. They are off by default: without the stage a
fence stays code. Pass the stage, the components and the stylesheet:

```tsx
import { Markdown } from '@localix-ai/flowdown'
import { quiz } from '@localix-ai/flowdown/quiz'
import { QuizProvider, quizComponents } from '@localix-ai/flowdown/quiz/react'
import '@localix-ai/flowdown/quiz.css'

const extensions = [quiz()]

export function Lesson({ text }: { text: string }) {
  return (
    <QuizProvider onAnswer={(answer) => save(answer)}>
      <Markdown extensions={extensions} components={quizComponents}>
        {text}
      </Markdown>
    </QuizProvider>
  )
}
```

An answer is never written into the text and never drawn into the HTML a page saves. It goes to the
page as an object, and the page decides what it is for: a score, a saved lesson, the next message
to a model.

## The three fences

### `quiz`: questions with a right answer

Each `###` heading is a question; without headings the fence is one question asked by its title.
The task list under it holds the choices, `[x]` the right ones. Text after the list explains the
answer and shows once it is given.

````markdown
```quiz The verb "to be" {#verb-be}
### We ___ in Limassol.
- [x] are
- [ ] is
- [ ] am

"We" takes "are".

### Which are plural?
- [x] we
- [x] they
- [ ] I

### Write "I am" in one word
- [x] I'm
- [x] Im
```
````

How a question is answered follows from its marks:

| The list | The reader |
| --- | --- |
| one `[x]` | picks one choice, checked the moment it is picked |
| several `[x]` | picks several and presses Check |
| every item `[x]` | types the answer; the items are the forms it accepts, and no choice is shown |

### `ask`: a choice with no right answer

A model asks the reader to decide, and the answer goes back to it. A plain list takes one choice, a
task list several (`[x]` picks one before the reader does), and a choice whose words end in a blank
takes the reader's own words:

````markdown
```ask Which database should I set up?
- PostgreSQL
- SQLite
- Other: ___
```
````

`- ___` alone is a question answered in words.

### `cards`: flash cards

An item is a card, its two sides split by ` — `, ` – ` or ` = `; a `###` heading is a card whose
back is the text under it. The reader turns a card and says whether they remembered it.

````markdown
```cards Greetings
- καλημέρα — good morning
- ευχαριστώ — thank you

### Πώς σε λένε;
What is your **name**?
```
````

## Steps

A form with several questions shows one at a time, with its progress, Back and Next. It opens at
the first question the page has no answer for. `layout="list"` on the provider shows every question
at once.

## What the page gets

```ts
interface QuizAnswer {
  form: string // the form's id: `{#id}` on the fence's line, or one made from its text
  question: string // the question's id, stable while its text stays
  index: number // the question's place in the form
  choice: number[] // the choices picked, by their place in the list as written
  text: string // the words typed
  correct: boolean | null // right or wrong for a quiz; for a card, remembered or not; null for an ask
}
```

`QuizProvider` takes:

| Prop | What it does |
| --- | --- |
| `onAnswer(answer, form)` | Every answer as it is given. |
| `onComplete(result, form)` | A form answered to its end, with `right` and `total`. |
| `answers` | Answers kept from before, by form id: forms show them and open where the reader stopped. |
| `feedback` | `immediate` (default) marks each answer and shows its explanation; `none` marks nothing, for an exam. |
| `layout` | `steps` (default) or `list`. |
| `shuffle` | The choices in an order of their own, the same each time for the same question. |
| `normalize` | How typed words are compared (lowercase, spaces and end punctuation by default). |
| `readOnly` | Forms show their answers and take no new ones: a reply whose answer was sent. |
| `labels` | The buttons' words, for a page in another language. |
| `renderDone` | What a form shows when it is done. |

### Sending an answer to a model

`answerText` writes a form's answers as a short Markdown list a model reads as the reader's reply:

```ts
import { answerText } from '@localix-ai/flowdown/quiz'

<QuizProvider
  onComplete={(_, form) => send(answerText(form, answersOf(form.id)))}
/>
// - Which database should I set up?: Other: MySQL
```

### Reading forms without drawing them

`readForms(markdown)` returns every form in a text with its questions and key, for a server that
scores answers itself, or for a test. `grade(question, answer)` checks one answer.

## While a reply streams

A fence still being written is drawn as a form, not as its code, and takes no answer until it
closes: a reader cannot pick a choice that is still arriving.

## Fence names

`quiz({ languages: { quiz: 'test', cards: 'flashcards' } })` reads the forms under names of the
page's own; `readForms` takes the same option.

## Without React

The stage alone, with no components, draws each form as plain HTML: the questions and their choices,
with no mark of which is right and no accepted typed form. A page that saves or sends that HTML does
not leak the key.
