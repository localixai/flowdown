## Between your message and the reply

The page draws while the model writes:

```mermaid
sequenceDiagram
  participant You
  participant App
  participant Model
  You->>App: Send a message
  App->>Model: The conversation
  loop Every token
    Model-->>App: The text so far
    App-->>You: Draw the last block again
  end
  Model-->>App: Done
```

Hover the diagram for its toolbar: **Enlarge** opens a viewer that zooms and pans.

With $n$ characters arriving at $r$ a second, the reply takes

$$
t = \frac{n}{r}
$$

and each update costs the last block, not the whole text.
