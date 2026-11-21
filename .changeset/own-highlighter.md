---
'@localix-ai/flowdown': minor
---

`@localix-ai/flowdown/highlight` is its own highlighter now, built in: nothing to install, and
`highlight.js` is no longer a peer dependency. It reads each line from the state the line above
ended in, so a fence an agent is still writing is coloured a line once and exactly as the finished
block is (a comment opened in one piece of 40 lines is still one in the next), on a page, in the
other targets and in a terminal. 26 languages, the shell session (`console`), SCSS, `.env` files
and Vue and Svelte among the new ones; a shell command is drawn as a call is. A page loads 48.3 KB
with highlighting where it loaded 74.4 KB. A highlighter of your own can offer the same with
`lines`.
