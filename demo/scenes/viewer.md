What happens between my message and the reply?
---
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
  App-->>You: The finished reply
```

The page draws while the model writes. Hover the diagram for its toolbar: **Enlarge** opens a viewer
that zooms and pans, and the other buttons show, copy and download the source.
