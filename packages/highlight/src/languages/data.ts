/**
 * Data and configuration: JSON (with comments, and a line of it at a time), YAML with its block
 * strings, TOML, INI, and Dockerfiles, whose `RUN` lines are shell.
 */
import { words, type Grammar, type Rule } from '../engine'
import { anyCase, commentState, NUMBER } from './common'
import { COMMAND, shell } from './shell'

const JSON_RULES: Rule[] = [
  { match: /"(?:[^"\\]|\\.)*"(?=\s*:)/, scope: 'attr' },
  { match: /"(?:[^"\\]|\\.)*"?/, scope: 'string' },
  { match: /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/, scope: 'number' },
  { match: /\b(?:true|false|null)\b/, scope: 'literal' },
  { match: /\/\/.*/, scope: 'comment' },
  { match: /\/\*/, scope: 'comment', push: 'comment' },
]

export const json: Grammar = {
  name: 'json',
  aliases: ['jsonc', 'json5', 'jsonl', 'ndjson', 'geojson', 'webmanifest', 'har'],
  states: { root: { rules: JSON_RULES }, comment: commentState('*/') },
}

const yamlLiteral = words(
  { literal: 'true false yes no on off null ~ True False TRUE FALSE Null NULL Yes No' },
  {},
)

export const yaml: Grammar = {
  name: 'yaml',
  aliases: ['yml'],
  states: {
    root: {
      rules: [
        { match: /(?<=^|\s)#.*/, scope: 'comment' },
        { match: /^(?:---|\.\.\.)(?=\s|$)/, scope: 'meta' },
        { match: /^%\w+.*/, scope: 'meta' },
        {
          match:
            /(?<=^[ \t]*(?:-[ \t]+)*|[{,][ \t]*)(?:"[^"\n]*"|'[^'\n]*'|[^\s#'"\-?:,[\]{}&*!|>%@`][^#\n]*?|-[^\s#:][^#\n]*?)(?=[ \t]*:(?:[ \t]|$))/,
          scope: 'attr',
        },
        { match: /(?<=^[ \t]*)-(?=[ \t]|$)|(?<=^[ \t]*(?:-[ \t]+)+)-(?=[ \t]|$)/, scope: 'bullet' },
        {
          // `key: |` and `key: >-`: the lines below, indented further, are its text.
          match: /(?<=(?:^|[:-][ \t]+))[|>][+-]?\d*(?=[ \t]*(?:#.*)?$)/,
          scope: 'meta',
          push: 'block',
          arg: (_text, line) => String(/^[ \t]*/.exec(line)![0].length),
        },
        { match: /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\n]|'')*'?/, scope: 'string' },
        { match: /[&*][\w.-]+|!!?[\w.:/-]*/, scope: 'type' },
        {
          match:
            /(?<=(?:^|[:\-,[{][ \t]+|[[{]))(?:[-+]?(?:\d[\d_]*(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+|0x[\da-fA-F]+|0o[0-7]+|\.inf|\.nan)|\d{4}-\d\d-\d\d(?:[Tt ]\d\d?:\d\d:\d\d(?:\.\d+)?(?:Z|[ \t]*[+-]\d\d?(?::\d\d)?)?)?)(?=[ \t]*(?:[,\]}#]|$))/,
          scope: 'number',
        },
        {
          match: /(?<=(?:^|[:\-,[{][ \t]+|[[{]))[\w~]+(?=[ \t]*(?:[,\]}#]|$))/,
          scope: yamlLiteral,
        },
        // Any other value is text, as an editor shows it: `runs-on: ubuntu-latest`.
        {
          match: /(?<=(?:^[ \t]*|[:-][ \t]+))[^\s#'"[\]{}|>&*!%@`,][^#\n]*?(?=[ \t]*(?:[ \t]#|$))/,
          scope: 'string',
        },
        { match: /(?<=[[,][ \t]*)[^\s#'"[\]{},][^#\n,\]]*?(?=[ \t]*[,\]])/, scope: 'string' },
      ],
    },
    block: {
      rules: (indent) => [
        // A line not indented past the key's ends the text; a blank line does not.
        { match: new RegExp(`^(?![ \\t]{${Number(indent) + 1}}|[ \\t]*$)`), pop: true },
      ],
      fill: 'string',
    },
  },
}

const toml: Grammar = {
  name: 'toml',
  states: {
    root: {
      rules: [
        { match: /#.*/, scope: 'comment' },
        { match: /^[ \t]*\[\[?[^\]\n]*\]?\]?/, scope: 'section' },
        {
          match:
            /(?<=^[ \t]*|[{,][ \t]*)(?:[\w-]+|"[^"\n]*"|'[^'\n]*')(?:[ \t]*\.[ \t]*(?:[\w-]+|"[^"\n]*"|'[^'\n]*'))*(?=[ \t]*=)/,
          scope: 'attr',
        },
        { match: /"""|'''/, scope: 'string', push: 'long', arg: (text) => text },
        { match: /"(?:[^"\\\n]|\\.)*"?|'[^'\n]*'?/, scope: 'string' },
        {
          match:
            /\d{4}-\d\d-\d\d(?:[Tt ]\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)?)?|\d\d:\d\d:\d\d(?:\.\d+)?/,
          scope: 'number',
        },
        { match: /[+-]?(?:inf|nan)\b/, scope: 'number' },
        NUMBER,
        { match: /\b(?:true|false)\b/, scope: 'literal' },
      ],
    },
    long: {
      rules: (quote) => [
        ...(quote === '"""' ? [{ match: /\\[\s\S]?/ }] : []),
        { match: new RegExp(quote), scope: 'string', pop: true },
      ],
      fill: 'string',
    },
  },
}
export { toml }

export const ini: Grammar = {
  name: 'ini',
  aliases: [
    'cfg',
    'conf',
    'properties',
    'editorconfig',
    'gitconfig',
    'desktop',
    'dosini',
    'env',
    'dotenv',
  ],
  states: {
    root: {
      rules: [
        { match: /^[ \t]*[;#].*/, scope: 'comment' },
        { match: /^[ \t]*\[[^\]\n]*\]?/, scope: 'section' },
        { match: /^[ \t]*(?:export[ \t]+)?[^\s=:;#[][^=:\n]*?(?=[ \t]*[=:])/, scope: 'attr' },
        { match: /"(?:[^"\\\n]|\\.)*"?|'[^'\n]*'?/, scope: 'string' },
        { match: /\$\{?[A-Za-z_]\w*\}?/, scope: 'variable' },
        { match: /(?<=[=:][ \t]*)[+-]?\d+(?:\.\d+)?(?=[ \t]*(?:[;#]|$))/, scope: 'number' },
        {
          match: /(?<=[=:][ \t]*)(?:true|false|yes|no|on|off|null)(?=[ \t]*(?:[;#]|$))/,
          scope: 'literal',
        },
      ],
    },
  },
}

const INSTRUCTIONS =
  'ADD ARG CMD COPY ENTRYPOINT ENV EXPOSE FROM HEALTHCHECK LABEL MAINTAINER ONBUILD RUN SHELL ' +
  'STOPSIGNAL USER VOLUME WORKDIR'
const shellCode = shell.states.root!.rules as Rule[]

export const dockerfile: Grammar = {
  name: 'dockerfile',
  aliases: ['docker', 'containerfile'],
  states: {
    root: {
      rules: [
        { match: /^[ \t]*#.*/, scope: 'comment' },
        // A `RUN` line, and the lines a `\` at its end carries on to, is shell.
        {
          match: new RegExp(`^[ \\t]*${anyCase('(?:RUN|CMD|ENTRYPOINT|SHELL)')}\\b`),
          scope: 'keyword',
          push: 'run',
        },
        {
          match: new RegExp(`^[ \\t]*(?:${anyCase(INSTRUCTIONS.split(' ').join('|'))})\\b`),
          scope: 'keyword',
        },
        {
          match: new RegExp(`(?<=^[ \\t]*${anyCase('FROM')}\\b.*[ \\t])${anyCase('AS')}\\b`),
          scope: 'keyword',
        },
        { match: /(?<=[ \t])--[\w-]+/, scope: 'attr' },
        { match: /"(?:[^"\\\n]|\\.)*"?|'[^'\n]*'?/, scope: 'string' },
        { match: /\$\{?[A-Za-z_]\w*(?::?[-+?][^}\n]*)?\}?/, scope: 'variable' },
        // A number on its own (`EXPOSE 8080`), not one inside a name (`node:20-alpine`).
        { match: /(?<=^|[\s=])\d+(?:\.\d+)*(?=[\s,\]]|$)/, scope: 'number' },
      ],
    },
    run: {
      rules: [
        { match: /\\$/, next: 'runMore' },
        // The command a `RUN` line runs, after its flags (`--mount=…`).
        {
          match: new RegExp(
            `(?<=^[ \\t]*${anyCase('(?:RUN|CMD|ENTRYPOINT|SHELL)')}[ \\t]+(?:--[\\w-]+(?:=\\S*)?[ \\t]+)*)[A-Za-z_./~][\\w./+-]*`,
          ),
          scope: COMMAND,
        },
        ...shellCode,
      ],
      line: true,
    },
    runMore: { rules: [{ match: /^/, next: 'run' }] },
    ...Object.fromEntries(Object.entries(shell.states).filter(([name]) => name !== 'root')),
  },
}
