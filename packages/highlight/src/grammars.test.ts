import { expect, test } from 'bun:test'
import { GRAMMARS } from './languages'
import type { Rule, State } from './engine'

/** Every rule of a state, made for a sample argument when the state takes one. */
const rulesOf = (state: State): readonly Rule[] =>
  typeof state.rules === 'function' ? state.rules('x') : state.rules

test('every rule can be joined into its state’s one expression: no flags, no capturing group', () => {
  for (const grammar of GRAMMARS)
    for (const [name, state] of Object.entries(grammar.states))
      for (const rule of rulesOf(state)) {
        const where = `${grammar.name}.${name}: /${rule.match.source}/`
        expect(rule.match.flags, where).toBe('')
        // An alternation of the source with nothing: its groups are the source's own.
        expect(new RegExp(`${rule.match.source}|`).exec('')!.length, where).toBe(1)
      }
})

test('every state a rule enters is one its grammar has', () => {
  for (const grammar of GRAMMARS)
    for (const [name, state] of Object.entries(grammar.states)) {
      for (const rule of rulesOf(state))
        for (const target of [rule.push, rule.next])
          if (target)
            expect(grammar.states[target], `${grammar.name}.${name} → ${target}`).toBeDefined()
      if (state.after)
        expect(grammar.states[state.after], `${grammar.name}.${name} after`).toBeDefined()
    }
})

test('names are unique across grammars', () => {
  const seen = new Map<string, string>()
  for (const grammar of GRAMMARS)
    for (const name of [grammar.name, ...(grammar.aliases ?? [])]) {
      expect(seen.get(name), `${name} in ${grammar.name}`).toBeUndefined()
      seen.set(name, grammar.name)
    }
})
