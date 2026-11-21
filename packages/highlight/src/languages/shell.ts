/**
 * The shell, as a README and an agent write it: the command each line runs (the first word, and the
 * first after `|`, `&&`, `;`, `then`), its flags, numbers, variables, strings with what they
 * expand, `$(…)`, heredocs and comments. A shell's own words (`test`, `echo`) are coloured where a
 * command stands, so the `test` of `bun test` is an argument.
 *
 * `console` is a session: a line after a prompt (`$ `, `user@host:~$ `) is a command, every
 * other line is what it printed, left plain.
 */
import { words, type Grammar, type Rule, type State } from '../engine'
import { literal } from './common'

const KEYWORDS =
  'if then else elif fi for while until in do done case esac function select time coproc'
const keyword = words({ keyword: KEYWORDS, literal: 'true false' })

/** Where a command's name stands: a line's start, after a prompt, an operator or a keyword. */
const COMMAND_PLACE =
  '(?<=(?:^[ \\t]*(?:\\$[ \\t]+)?|[|&;(`][ \\t]*|\\$\\([ \\t]*|\\b(?:then|do|else|time|sudo|exec|xargs|env)[ \\t]+)(?:[A-Za-z_]\\w*=[^ \\t]*[ \\t]+)*)'

/** A command's name is drawn as a call is, as an editor draws it: `git`, `bun`, `echo`. */
export const COMMAND = 'title function_'

const VARIABLE: Rule = {
  match: /\$(?:\{[^}\n]*\}?|[A-Za-z_]\w*|[0-9@#?$!*-])/,
  scope: 'variable',
}
const SUBST_OPEN: Rule = { match: /\$\(\(?/, scope: 'subst', push: 'subst' }
const BACKTICK: Rule = { match: /`/, scope: 'subst', push: 'backtick' }

const code: Rule[] = [
  { match: /(?<=^|[\s;|&(])#.*/, scope: 'comment' },
  {
    // `<<EOF`, `<<-'EOF'`, `<<"EOF"`: the text from the next line to the word alone on its line.
    match: /<<-?[ \t]*(?:'[\w.-]+'|"[\w.-]+"|\\?[A-Za-z_][\w.-]*)/,
    scope: 'string',
    push: 'opener',
    arg: (text) => text.replace(/^<<-?[ \t]*\\?/, '').replace(/['"]/g, ''),
  },
  { match: /\$'/, scope: 'string', push: 'ansi' },
  { match: /'/, scope: 'string', push: 'single' },
  { match: /"/, scope: 'string', push: 'double' },
  SUBST_OPEN,
  BACKTICK,
  VARIABLE,
  { match: /(?<=\bfunction[ \t]+)[\w.:-]+/, scope: 'title function_' },
  { match: /(?<=^[ \t]*)[\w.:-]+(?=[ \t]*\(\)[ \t]*\{?)/, scope: 'title function_' },
  {
    match: new RegExp(
      `${COMMAND_PLACE}(?!(?:${KEYWORDS.split(' ').join('|')})(?![\\w.-]))(?![\\w./-]*=)[A-Za-z_./~][\\w./+-]*`,
    ),
    scope: COMMAND,
  },
  { match: /(?<=[ \t])--?[A-Za-z][\w-]*/, scope: 'attr' },
  { match: /(?<=[ \t=:])\d+(?:\.\d+)*(?![\w./-])/, scope: 'number' },
  { match: /[A-Za-z_][\w-]*/, scope: keyword },
]

/** Code that ends at its closer, with its parentheses counted (`$(cmd (a) b)`). */
const until = (closer: Rule, open?: Rule): State => ({
  rules: [closer, ...(open ? [open] : []), ...code],
})

const states: Record<string, State> = {
  root: { rules: code },
  single: { rules: [{ match: /'/, scope: 'string', pop: true }], fill: 'string' },
  ansi: {
    rules: [{ match: /\\[\s\S]?/ }, { match: /'/, scope: 'string', pop: true }],
    fill: 'string',
  },
  double: {
    rules: [
      { match: /\\[\s\S]?/ },
      SUBST_OPEN,
      BACKTICK,
      VARIABLE,
      { match: /"/, scope: 'string', pop: true },
    ],
    fill: 'string',
  },
  subst: until({ match: /\)\)?/, scope: 'subst', pop: true }, { match: /\(/, push: 'paren' }),
  paren: until({ match: /\)/, pop: true }, { match: /\(/, push: 'paren' }),
  backtick: until({ match: /`/, scope: 'subst', pop: true }),
  // The line `<<EOF` is on goes on as code; the heredoc is the lines after it.
  opener: { rules: code, line: true, after: 'heredoc' },
  heredoc: {
    rules: (word) => [
      { match: new RegExp(`^[ \\t]*${literal(word)}$`), scope: 'string', pop: true },
    ],
    fill: 'string',
  },
}

export const shell: Grammar = {
  name: 'bash',
  aliases: ['sh', 'shell', 'zsh', 'shellscript', 'ksh', 'fish'],
  states,
}

/**
 * A prompt: `$ `, `% `, `# `, `❯ `, or a user, host and directory before one. Not `> `: npm prints
 * its scripts so, and a command that goes on to a second line is in its string still.
 */
const PROMPT =
  /^(?:\([\w.-]+\)[ \t]*)?(?:[\w.-]+@[\w.-]+(?::[^\s$#%]*)?)?(?:[~/][^\s$#%]*)?[$#%❯](?=[ \t])/

export const shellSession: Grammar = {
  name: 'console',
  aliases: ['shell-session', 'shellsession', 'sh-session', 'terminal'],
  states: {
    root: { rules: [{ match: PROMPT, scope: 'meta', push: 'command' }] },
    command: {
      rules: [
        {
          match: /(?<=^\S*[$#%❯][ \t]+(?:[A-Za-z_]\w*=[^ \t]*[ \t]+)*)[A-Za-z_./~][\w./+-]*/,
          scope: COMMAND,
        },
        ...code,
      ],
      line: true,
    },
    ...Object.fromEntries(Object.entries(states).filter(([name]) => name !== 'root')),
  },
}
