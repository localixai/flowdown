---
'@localix-ai/flowdown': patch
---

`<Markdown>` leaves React no work after a streamed token. Its hooks queued an effect behind every
commit (the loader of each optional stage was stored again, and the pacer started again with
smoothing off), so each token cost a scheduler task once it was drawn. They now run only when the
loader changes or there is text still to show.
