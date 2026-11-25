---
'@localix-ai/flowdown': minor
---

Questions and flash cards in the text: `quiz`, `ask` and `cards` fences, read by the `quiz()` stage
(`@localix-ai/flowdown/quiz`) and drawn by `quizComponents` (`@localix-ai/flowdown/quiz/react`,
styles in `quiz.css`). A form shows one question at a time, checks a choice the moment it is
picked, takes several choices or typed words, and turns cards. Answers go to the page through
`QuizProvider` (`onAnswer`, `onComplete`, `answers` to reopen where the reader stopped) and never
into the text or its HTML; `answerText` writes them for a model, `readForms` and `grade` score them
on a server. A fence still being written is drawn as a form and takes no answer until it closes.
