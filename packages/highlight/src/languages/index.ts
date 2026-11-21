/** Every grammar the package ships, in the order `languages` lists them. */
import type { Grammar } from '../engine'
import { c, cpp, csharp, go, java, kotlin, php, rust, swift } from './c-family'
import { dockerfile, ini, json, toml, yaml } from './data'
import { javascript, typescript } from './javascript'
import { python } from './python'
import { ruby } from './ruby'
import { shellSession, shell } from './shell'
import { sql } from './sql'
import { diff, markdown } from './text'
import { cssGrammar, scss, xml } from './web'

export const GRAMMARS: readonly Grammar[] = [
  shell,
  shellSession,
  c,
  cpp,
  csharp,
  cssGrammar,
  scss,
  diff,
  dockerfile,
  go,
  ini,
  java,
  javascript,
  json,
  kotlin,
  markdown,
  php,
  python,
  ruby,
  rust,
  sql,
  swift,
  toml,
  typescript,
  xml,
  yaml,
]
