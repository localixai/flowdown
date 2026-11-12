import { expect, test } from 'bun:test'

/**
 * The tables are module state, and other tests load the whole one: this runs in a process of its
 * own, where only the common names are there until the rest is added.
 */
const inOwnProcess = (script: string): unknown => {
  const run = Bun.spawnSync(['bun', '-e', script], { cwd: import.meta.dir })
  if (run.exitCode !== 0) throw new Error(run.stderr.toString())
  return JSON.parse(run.stdout.toString())
}

test('common names are decoded at once, the rest of HTML5 once its table is added', () => {
  const result = inOwnProcess(`
    import { parse, toHtml } from './index'
    import { addEntities, hasAllEntities, hasRareEntity } from './entities'
    const text = '&nbsp;&mdash;&rarr;&copy;&apos; and &nrarr;'
    const before = toHtml(parse(text))
    const facts = [hasAllEntities(), hasRareEntity('&nbsp; &mdash; &amp;'), hasRareEntity(text)]
    const { ENTITY_TABLE } = await import('./entity-table')
    addEntities(ENTITY_TABLE)
    console.log(JSON.stringify({ before, facts, after: toHtml(parse(text)), all: hasAllEntities(), rare: hasRareEntity(text) }))
  `)
  expect(result).toEqual({
    before: "<p> —→©' and &amp;nrarr;</p>\n",
    facts: [false, false, true],
    after: "<p> —→©' and ↛</p>\n",
    all: true,
    rare: false,
  })
})
