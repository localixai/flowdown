import { describe, expect, test } from 'bun:test'
import { render } from '../../test/render'
import { answerFormatPrompt } from './index'

/** The examples the prompt shows, as a model reads them: each indented run under its rule. */
function examplesIn(prompt: string): string[] {
  const examples: string[] = []
  let current: string[] = []
  for (const line of [...prompt.split('\n'), '-']) {
    if (line.startsWith('  ') || (line === '' && current.length)) current.push(line.slice(2))
    else if (current.length) {
      examples.push(current.join('\n').trim())
      current = []
    }
  }
  return examples
}

describe('the prompt teaches only what the page renders', () => {
  test('every example it shows renders as its form, with no marker left as text', () => {
    const examples = examplesIn(answerFormatPrompt())
    expect(examples.length).toBeGreaterThanOrEqual(4)
    for (const example of examples) {
      const html = render(example)
      expect(html).not.toContain('[!')
      expect(html).toMatch(/class="fd-(steps|tabs|stats|pros|cons|sides|verdict|details|sources)/)
    }
  })

  test('math and diagrams are taught only when the page turns them on, as <Markdown> does', () => {
    const plain = answerFormatPrompt()
    expect(plain).not.toContain('mermaid')
    expect(plain).not.toContain('$…$')
    const full = answerFormatPrompt({ math: true, diagrams: true })
    expect(full).toContain('```mermaid')
    expect(full).toContain('$…$')
  })
})
