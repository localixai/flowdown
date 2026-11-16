/**
 * ZenUML in a terminal, read into a sequence diagram and drawn as one.
 *
 * 1. Calls, nested calls and their replies, asynchronous messages, a title, a made-up starter.
 * 2. Frames: `if` with `else if` and `else`, `try` and `catch`, `opt`, and `new`.
 * 3. Narrow, the outline a sequence diagram is written as; and what does not read.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { diagramLines } from './text'
import { zenumlDiagram } from './zenuml'

const draw = (source: string, columns = 80): string[] | undefined =>
  zenumlDiagram.draw(diagramLines(source), columns)?.map(lineText)

const LOAD = [
  'zenuml',
  '  title Load',
  '  @Actor User',
  '  API',
  '  User->API: hello',
  '  r = API.load(x) {',
  '    DB.query()',
  '    return rows',
  '  }',
  '  v = API.check()',
  '  // a comment',
].join('\n')

describe('messages', () => {
  test('a call from the starter, the calls inside it made by its callee, and their replies', () => {
    expect(draw(LOAD, 60)).toEqual([
      'Load',
      '',
      '┌─────────┐ ╭──────╮ ┌─────┐   ┌────┐',
      '│ Starter │ │ User │ │ API │   │ DB │',
      '└────┬────┘ ╰───┬──╯ └──┬──┘   └──┬─┘',
      '     │          │ hello │         │',
      '     │          ├──────▷│         │',
      '     │     load(x)      │         │',
      '     ├──────────┼──────▶│         │',
      '     │          │       │ query() │',
      '     │          │       ├────────▶│',
      '     │       rows       │         │',
      '     │◀┄┄┄┄┄┄┄┄┄┼┄┄┄┄┄┄┄┤         │',
      '     │     check()      │         │',
      '     ├──────────┼──────▶│         │',
      '     │        v │       │         │',
      '     │◀┄┄┄┄┄┄┄┄┄┼┄┄┄┄┄┄┄┤         │',
      '     │          │       │         │',
    ])
  })
})

describe('frames', () => {
  test('if, else if and else; try and catch; opt; and a participant made with new', () => {
    const source = [
      'zenuml',
      '  @Starter(A)',
      '  B.run() {',
      '    if (ok) {',
      '      C.go()',
      '    } else if (late) {',
      '      C.wait()',
      '    } else {',
      '      C.stop()',
      '    }',
      '    try {',
      '      C.risky()',
      '    } catch (e) {',
      '      C.log()',
      '    }',
      '    opt {',
      '      new D()',
      '    }',
      '  }',
    ].join('\n')
    expect(draw(source, 60)).toEqual([
      '  ┌───┐   ┌───┐     ┌───┐ ┌───┐',
      '  │ A │   │ B │     │ C │ │ D │',
      '  └─┬─┘   └─┬─┘     └─┬─┘ └─┬─┘',
      '    │ run() │         │     │',
      '    ├──────▶│         │     │',
      '┌ if ok ────┼─────────┼─────┼───┐',
      '│   │       │  go()   │     │   │',
      '│   │       ├────────▶│     │   │',
      '├ else late ┼┄┄┄┄┄┄┄┄┄┼┄┄┄┄┄┼┄┄┄┤',
      '│   │       │ wait()  │     │   │',
      '│   │       ├────────▶│     │   │',
      '├ else ┄┄┄┄┄┼┄┄┄┄┄┄┄┄┄┼┄┄┄┄┄┼┄┄┄┤',
      '│   │       │ stop()  │     │   │',
      '│   │       ├────────▶│     │   │',
      '└───┼───────┼─────────┼─────┼───┘',
      '┌ try ──────┼─────────┼─────┼───┐',
      '│   │       │ risky() │     │   │',
      '│   │       ├────────▶│     │   │',
      '├ catch e ┄┄┼┄┄┄┄┄┄┄┄┄┼┄┄┄┄┄┼┄┄┄┤',
      '│   │       │  log()  │     │   │',
      '│   │       ├────────▶│     │   │',
      '└───┼───────┼─────────┼─────┼───┘',
      '┌ opt ──────┼─────────┼─────┼───┐',
      '│   │       │   «create»    │   │',
      '│   │       ├─────────┼────▶│   │',
      '└───┼───────┼─────────┼─────┼───┘',
      '    │       │         │     │',
    ])
  })

  test('a while loop on one line, and blocks left open closed at the end', () => {
    expect(draw('zenuml\n  while (more) { A.next() }\n  B.go() {\n    C.x()', 60)).toEqual([
      '  ┌─────────┐ ┌───┐ ┌───┐ ┌───┐',
      '  │ Starter │ │ A │ │ B │ │ C │',
      '  └────┬────┘ └─┬─┘ └─┬─┘ └─┬─┘',
      '┌ while more ───┼─────┼─────┼───┐',
      '│      │ next() │     │     │   │',
      '│      ├───────▶│     │     │   │',
      '└──────┼────────┼─────┼─────┼───┘',
      '       │     go()     │     │',
      '       ├────────┼────▶│     │',
      '       │        │     │ x() │',
      '       │        │     ├────▶│',
      '       │        │     │     │',
    ])
  })
})

describe('narrow, and what does not read', () => {
  test('narrow, the outline: participants, then each message', () => {
    expect(draw(LOAD, 20)).toEqual([
      'Load',
      '',
      'Starter, User, API,',
      '  DB',
      'User ──▷ API: hello',
      'Starter ──▶ API:',
      '  load(x)',
      'API ──▶ DB: query()',
      'API ┄┄▶ Starter:',
      '  rows',
      'Starter ──▶ API:',
      '  check()',
      'API ┄┄▶ Starter: v',
    ])
  })

  test('no participant, or another header', () => {
    expect(draw('zenuml')).toBeUndefined()
    expect(draw('zenuml\n  // only a comment\n  if (x) {\n  }')).toBeUndefined()
    expect(draw('sequenceDiagram\n  A->B: hi')).toBeUndefined()
    expect(zenumlDiagram.matches('zenuml')).toBe(true)
  })
})
