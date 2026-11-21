/**
 * One diagram of every kind Mermaid has, as agents write them: what the shots draw, the bench
 * times against Mermaid, and the tests read through at every prefix.
 */
export const CORPUS: ReadonlyArray<readonly [name: string, source: string]> = [
  [
    'flowchart',
    `flowchart TD
  A[User sends a message] --> B{Is it a command?}
  B -- yes --> C[Run the command]
  B -- no --> D[Ask the model]
  D --> E[(Vector store)]
  E --> F[Stream the reply]
  C --> F
  F --> G([Done])`,
  ],
  [
    'flowchart LR',
    `flowchart LR
  subgraph Client
    UI[React UI] --> SDK
  end
  subgraph Server
    API[API] --> Queue[[Queue]]
    Queue --> Worker
  end
  SDK -->|HTTPS| API
  Worker -.->|retry| Queue
  Worker ==> DB[(Postgres)]`,
  ],
  [
    'sequence',
    `sequenceDiagram
  participant U as User
  participant A as Agent
  participant T as Tool
  U->>A: Fix the failing test
  activate A
  A->>T: run tests
  T-->>A: 1 failed
  Note over A,T: reads the stack trace
  A->>T: edit file
  T-->>A: ok
  A-->>U: Fixed, all tests pass
  deactivate A`,
  ],
  [
    'class',
    `classDiagram
  class Animal {
    +String name
    +int age
    +makeSound() void
  }
  class Dog {
    +fetch() void
  }
  class Cat
  Animal <|-- Dog
  Animal <|-- Cat
  Dog "1" --> "*" Bone : chews`,
  ],
  [
    'state',
    `stateDiagram-v2
  [*] --> Idle
  Idle --> Streaming: token
  Streaming --> Streaming: token
  Streaming --> Done: end
  Streaming --> Failed: error
  Failed --> Idle: retry
  Done --> [*]`,
  ],
  [
    'er',
    `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : "is in"
  CUSTOMER {
    string id PK
    string name
    string email
  }`,
  ],
  [
    'gantt',
    `gantt
  title Release plan
  dateFormat YYYY-MM-DD
  section Build
  Parser        :done, p1, 2026-01-05, 10d
  Renderer      :active, r1, after p1, 12d
  section Ship
  Docs          :d1, after r1, 5d
  Release       :milestone, after d1, 0d`,
  ],
  [
    'pie',
    `pie showData title Where the time goes
  "Parsing" : 12
  "Layout" : 46
  "Drawing" : 30
  "Other" : 12`,
  ],
  [
    'mindmap',
    `mindmap
  root((Agent))
    Tools
      Shell
      Browser
    Memory
      Short term
      Long term
    Models`,
  ],
  [
    'timeline',
    `timeline
  title Streaming Markdown
  2024 : First parser
  2025 : React renderer : Terminal renderer
  2026 : Math : Diagrams`,
  ],
  [
    'journey',
    `journey
  title Onboarding
  section Sign up
    Open the app: 5: User
    Fill the form: 2: User
  section First task
    Ask a question: 4: User, Agent
    Get an answer: 5: Agent`,
  ],
  [
    'gitGraph',
    `gitGraph
  commit
  branch feature
  checkout feature
  commit
  commit
  checkout main
  merge feature
  commit`,
  ],
  [
    'quadrant',
    `quadrantChart
  title Effort and impact
  x-axis Low effort --> High effort
  y-axis Low impact --> High impact
  quadrant-1 Plan
  quadrant-2 Do now
  quadrant-3 Skip
  quadrant-4 Delegate
  Cache: [0.2, 0.8]
  Rewrite: [0.85, 0.7]
  Rename: [0.15, 0.2]`,
  ],
  [
    'xychart',
    `xychart-beta
  title "Latency by release"
  x-axis [v1, v2, v3, v4, v5]
  y-axis "ms" 0 --> 120
  bar [100, 80, 60, 45, 30]
  line [100, 80, 60, 45, 30]`,
  ],
  [
    'sankey',
    `sankey-beta
  Tokens,Prompt,60
  Tokens,Reply,40
  Prompt,Cached,35
  Prompt,Fresh,25`,
  ],
  [
    'requirement',
    `requirementDiagram
  requirement fast_render {
    id: 1
    text: draws a token in under 1 ms
    risk: medium
    verifymethod: test
  }
  element renderer {
    type: library
  }
  renderer - satisfies -> fast_render`,
  ],
  [
    'C4',
    `C4Context
  title System context
  Person(user, "User", "Writes to the agent")
  System(agent, "Agent", "Answers and acts")
  System_Ext(model, "Model API", "Generates text")
  Rel(user, agent, "Asks")
  Rel(agent, model, "Calls", "HTTPS")`,
  ],
  [
    'block',
    `block-beta
  columns 3
  a["Input"] b["Parse"] c["Render"]
  a --> b
  b --> c`,
  ],
  [
    'packet',
    `packet-beta
  0-15: "Source port"
  16-31: "Destination port"
  32-63: "Sequence number"`,
  ],
  [
    'kanban',
    `kanban
  Todo
    [Write docs]
    [Fix bug]
  Doing
    [Math package]
  Done
    [Highlighter]`,
  ],
  [
    'architecture',
    `architecture-beta
  group api(cloud)[API]
  service db(database)[Database] in api
  service server(server)[Server] in api
  service disk(disk)[Storage] in api
  db:L -- R:server
  disk:T -- B:server`,
  ],
  [
    'radar',
    `radar-beta
  title Skills
  axis a["Speed"], b["Size"], c["Quality"], d["Coverage"]
  curve x["flowdown"]{90, 95, 80, 85}
  curve y["other"]{50, 40, 85, 90}`,
  ],
  [
    'treemap',
    `treemap-beta
  "Bundle"
    "Parser": 30
    "Renderer": 45
    "Math": 14
    "Diagrams": 25`,
  ],
]
