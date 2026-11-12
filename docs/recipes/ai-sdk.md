---
title: Vercel AI SDK
description:
  Stream a chat reply from the Vercel AI SDK 7 into flowdown, with the dialect taught to the
  model and the text paced by words.
---

# Vercel AI SDK

A chat that streams the model's reply into `<Markdown>`, written for AI SDK 7 (`ai` and
`@ai-sdk/react`) and the Next.js App Router. Any other transport works the same way: give
`<Markdown>` the whole text so far, and `streaming` while it grows.

## The route

The server teaches the model the dialect and paces the text by words, so it arrives evenly rather
than in bursts:

```ts
// app/api/chat/route.ts
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  smoothStream,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai'
import { answerFormatPrompt } from 'flowdown/prompt'

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json()
  const result = streamText({
    model: 'anthropic/claude-sonnet-5.5',
    instructions: ['You are a helpful assistant.', answerFormatPrompt()].join('\n\n'),
    messages: await convertToModelMessages(messages),
    experimental_transform: smoothStream({ chunking: 'word' }),
  })
  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })
}
```

`answerFormatPrompt()` is static text, the same on every request, so it sits well inside a cached
prompt prefix. See [Prompting](../prompting.md).

## The page

Each text part of a message carries its own `state`, `'streaming'` until the part is complete. That
is exactly what `streaming` wants:

```tsx
// app/page.tsx
'use client'
import { useChat } from '@ai-sdk/react'
import { Markdown } from 'flowdown'
import { highlight } from 'flowdown/highlight'
import 'flowdown/styles.css'
import { useState } from 'react'

export default function Chat() {
  const { messages, sendMessage, status } = useChat()
  const [input, setInput] = useState('')

  return (
    <main>
      {messages.map((message) => (
        <article key={message.id} data-role={message.role}>
          {message.parts.map((part, index) =>
            part.type === 'text' ? (
              <Markdown
                key={index}
                streaming={part.state === 'streaming'}
                highlight={highlight}
                mermaid={() => import('mermaid')}
              >
                {part.text}
              </Markdown>
            ) : null,
          )}
        </article>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!input.trim()) return
          sendMessage({ text: input })
          setInput('')
        }}
      >
        <input value={input} onChange={(event) => setInput(event.target.value)} />
        <button type="submit" disabled={status !== 'ready'}>
          Send
        </button>
      </form>
    </main>
  )
}
```

The page is a client component, so it can pass loaders (`mermaid`) and a highlighter.

## User messages

A person's own message is usually shown as typed, not as Markdown. If you do render it, leave
`streaming` off: it arrives whole.

## Notes

- **Long chats.** A finished message keeps the same text, so its blocks are never parsed again when
  a later message streams. You can wrap `<Markdown>` in `memo` too; it is cheap either way.
- **Stopping.** When the person stops a reply, its last part may never reach `'done'`. Treat a part
  as finished when the chat's `status` is no longer `'streaming'`:
  `streaming={part.state === 'streaming' && status === 'streaming'}`.
- **Math.** Turn it on in both places: `answerFormatPrompt({ math: true })` on the server,
  `math={() => import('flowdown/math')}` and the KaTeX stylesheet on the page.
