---
'@localix-ai/flowdown': patch
---

A badge, an image in a link (`[![build](…)](…)`), is drawn as its image while its link is still
being written, and as the linked image once the address closes. Its brackets and the half-written
address used to show as text for most of its frames. An image whose address has not started,
`![alt]` at the very end of a streaming reply, is held back like one whose address is half-written.
Only frames of a stream change; a finished reply is drawn as before.
