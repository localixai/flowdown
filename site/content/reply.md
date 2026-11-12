## Streaming a reply

> [!TIP]
> This is not a recording. The text arrives a few characters at a time, and **flowdown** draws it as it grows.

> [!STEPS]
1. **Install**
   One package, no dependencies.

   ```sh
   npm install flowdown
   ```
2. **Render**
   Pass `streaming` while the text is still arriving.

   ```tsx title="reply.tsx"
   import { Markdown } from 'flowdown'
   import 'flowdown/styles.css'

   export function Reply({ text, done }) {
     return <Markdown streaming={!done}>{text}</Markdown>
   }
   ```
3. **Teach the model**
   Add `answerFormatPrompt()` to the system prompt, and it writes these forms.

> [!STATS]
- **0.13 s** to stream 100k characters
- **31.7 KB** gzipped
- **0** dependencies

The same reply, outside React:

> [!TABS]
#### HTML text
```ts
import { renderToHtml } from 'flowdown/static'

const html = renderToHtml(reply)
```
#### A page
```ts
import { mount } from 'flowdown/dom'

const view = mount(document.querySelector('#reply'))
view.update(text, { streaming: true })
```
#### A terminal
```ts
import { renderToAnsi } from 'flowdown/tui'

process.stdout.write(renderToAnsi(reply))
```

---

| Streaming 100k characters | Time    |
| :------------------------ | ------: |
| **flowdown**              | **0.13 s** |
| markdown-to-jsx           | 2.3 s   |
| Streamdown                | 6.3 s   |

> [!PROS] It does
- repair unfinished `**bold`, links and code fences
- pass every CommonMark and GitHub example

> [!CONS] It does not
- run remark or rehype plugins

> [!SOURCES] Read more
- [Getting started](/docs/getting-started) — a first reply on a page
- [The dialect](/docs/syntax) — every form a model can write
