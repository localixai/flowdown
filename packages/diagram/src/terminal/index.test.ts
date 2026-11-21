/** Every kind reached through `drawDiagram`: each header to its kind, each kind's lines as it reads them. */
import { expect, test } from 'bun:test'
import { lineText } from '../style'
import { width } from '../width'
import { drawDiagram } from './index'

/** One small diagram of each kind, as a model writes them. */
const KINDS: Record<string, string> = {
  flowchart: 'flowchart TD\n  A[Start] --> B[Done]',
  graph: 'graph LR\n  A --> B',
  sequence: 'sequenceDiagram\n  Alice->>Bob: Hi',
  state: 'stateDiagram-v2\n  [*] --> Still\n  Still --> Moving\n  Moving --> [*]',
  class: 'classDiagram\n  Animal <|-- Duck\n  class Duck {\n    +swim()\n  }',
  er: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
  requirement:
    'requirementDiagram\n  requirement test_req {\n    id: 1\n    text: the test text.\n    risk: high\n    verifymethod: test\n  }\n  element test_entity {\n    type: simulation\n  }\n  test_entity - satisfies -> test_req',
  c4: 'C4Context\n  Person(customer, "Customer")\n  System(bank, "Bank")\n  Rel(customer, bank, "Uses")',
  architecture:
    'architecture-beta\n  service db(database)[Database]\n  service api(server)[API]\n  db:L -- R:api',
  block: 'block-beta\n  columns 2\n  a b',
  gantt:
    'gantt\n  dateFormat YYYY-MM-DD\n  section Build\n  Backend :a1, 2024-01-01, 10d\n  Frontend :after a1, 5d',
  timeline: 'timeline\n  title History\n  2002 : LinkedIn\n  2004 : Facebook',
  journey: 'journey\n  title My day\n  section Work\n  Make tea: 5: Me',
  gitGraph: 'gitGraph\n  commit\n  branch develop\n  commit\n  checkout main\n  merge develop',
  kanban: 'kanban\n  Todo\n    [Write the docs]\n  Done\n    [Ship it]',
  mindmap: 'mindmap\n  root((Plans))\n    Work\n      Release\n    Home',
  zenuml: 'zenuml\n  Alice->Bob: Hi',
  pie: 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85',
  xychart: 'xychart-beta\n  x-axis [jan, feb, mar]\n  bar [3, 5, 2]',
  quadrant: 'quadrantChart\n  x-axis Low --> High\n  y-axis Low --> High\n  Campaign A: [0.3, 0.6]',
  sankey: 'sankey-beta\n  Agriculture,Bio-conversion,124.7\n  Bio-conversion,Losses,26.8',
  packet: 'packet-beta\n  0-15: "Source Port"\n  16-31: "Destination Port"',
  radar: 'radar-beta\n  axis a["Speed"], b["Power"], c["Range"]\n  curve x["One"]{1, 2, 3}',
  treemap: 'treemap-beta\n  "Section"\n    "Leaf A": 10\n    "Leaf B": 20\n  "Other": 5',
}

test('every kind is drawn, no wider than the terminal', () => {
  for (const [name, source] of Object.entries(KINDS)) {
    for (const columns of [80, 40, 20]) {
      const rows = drawDiagram(source, columns)
      expect(rows, `${name} at ${columns}`).not.toBeNull()
      for (const row of rows!) expect(width(lineText(row)), name).toBeLessThanOrEqual(columns)
    }
  }
})

test('a kind whose nesting is its indentation is read with it', () => {
  const mindmap = drawDiagram(KINDS.mindmap!, 80)!.map(lineText).join('\n')
  // `Release` hangs from `Work`, not from the root beside it.
  expect(mindmap.indexOf('Release')).toBeGreaterThan(mindmap.indexOf('Work'))
  expect(mindmap).toMatch(/│ {2}└─ Release|\s{3}└─ Release/)
  const treemap = drawDiagram(KINDS.treemap!, 80)!.map(lineText).join('\n')
  // `Other` is beside `Section`, not inside it.
  expect(treemap).toMatch(/Section[^\n]*\n(?:[^\n]*\n)*?\s+Leaf A/)
})

test('a kind not drawn, or a source that is not a diagram, is left to the caller', () => {
  for (const source of ['info', 'notADiagram', '', '%% only a comment'])
    expect(drawDiagram(source, 80)).toBeNull()
})
