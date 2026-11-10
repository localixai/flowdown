import basics from '../review/basics.md' with { type: 'text' }
import folded from '../review/folded.md' with { type: 'text' }
import forms from '../review/forms.md' with { type: 'text' }
import code from '../scenes/code.md' with { type: 'text' }
import diagram from '../scenes/diagram.md' with { type: 'text' }
import hero from '../scenes/hero.md' with { type: 'text' }
import sources from '../scenes/sources.md' with { type: 'text' }
import steps from '../scenes/steps.md' with { type: 'text' }
import viewer from '../scenes/viewer.md' with { type: 'text' }

/** A scene file is the question, a line `---`, then the reply. */
function scene(source: string) {
  const at = source.indexOf('\n---\n')
  return { question: source.slice(0, at).trim(), reply: source.slice(at + 5).trim() }
}

export const scenes: Record<string, { question: string; reply: string }> = {
  hero: scene(hero),
  steps: scene(steps),
  code: scene(code),
  diagram: scene(diagram),
  sources: scene(sources),
  viewer: scene(viewer),
}

/** Every form at once, for looking at (`bun run review`); not in the README. */
export const reviewScenes: Record<string, { question: string; reply: string }> = {
  basics: scene(basics),
  forms: scene(forms),
  folded: scene(folded),
}
