/**
 * Text with marks: Markdown (headings, emphasis, code, links, lists, quotes, fenced blocks) and
 * diffs, the patch an agent proposes: added and removed lines, hunks and file headers.
 */
import { EMBED, type Grammar } from '../engine'
import { literal } from './common'

export const markdown: Grammar = {
  name: 'markdown',
  aliases: ['md', 'mkd', 'mdx', 'gfm'],
  states: {
    root: {
      rules: [
        {
          // A fence: its lines are read as the language it names (```ts), up to its closer.
          match: /^ {0,3}(?:`{3,}|~{3,}).*/,
          scope: 'code',
          push: 'fence',
          arg: (text) => {
            const marker = /[`~]+/.exec(text)![0]
            const language =
              text
                .slice(text.indexOf(marker) + marker.length)
                .trim()
                .split(/[\s{]/)[0] ?? ''
            return `${marker}${EMBED}${language.toLowerCase()}${EMBED}`
          },
        },
        { match: /^ {0,3}#{1,6}(?=\s|$).*/, scope: 'section' },
        { match: /^ {0,3}(?:=+|-+)[ \t]*$/, scope: 'section' },
        { match: /^ {0,3}(?:[-*_][ \t]*){3,}$/, scope: 'meta' },
        { match: /^[ \t]*>.*/, scope: 'quote' },
        { match: /^[ \t]*(?:[-*+]|\d{1,9}[.)])(?=[ \t]|$)/, scope: 'bullet' },
        { match: /(?<=^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+)\[[ xX]\](?=[ \t])/, scope: 'bullet' },
        { match: /`[^`\n]+`/, scope: 'string' },
        { match: /\*\*[^*\n]+\*\*|__[^_\n]+__/, scope: 'strong' },
        {
          match: /(?<![\w*])\*[^*\s][^*\n]*\*(?!\*)|(?<![\w_])_[^_\s][^_\n]*_(?![\w_])/,
          scope: 'emphasis',
        },
        { match: /(?<=!?\[)[^\]\n]+(?=\][([])/, scope: 'string' },
        { match: /(?<=\])\([^)\s]*(?:\s+"[^"\n]*")?\)|(?<=\])\[[^\]\n]*\]/, scope: 'link' },
        { match: /^ {0,3}\[[^\]\n]+\]:[ \t]*\S+/, scope: 'symbol' },
        { match: /<https?:\/\/[^>\s]+>|https?:\/\/[^\s<>)\]]+/, scope: 'link' },
        { match: /<\/?[A-Za-z][\w-]*(?:\s[^>\n]*)?\/?>/, scope: 'tag' },
      ],
    },
    fence: {
      rules: (marker) => [
        {
          match: new RegExp(`^ {0,3}${literal(marker)}${marker[0] === '`' ? '`' : '~'}*[ \\t]*$`),
          scope: 'code',
          pop: true,
        },
      ],
      embed: true,
    },
  },
}

export const diff: Grammar = {
  name: 'diff',
  aliases: ['patch', 'udiff'],
  states: {
    root: {
      rules: [
        {
          match: /^@@ [^@\n]*@@|^\*\*\* +\d+(?:,\d+)? +\*\*\*\*$|^--- +\d+(?:,\d+)? +----$/,
          scope: 'meta',
        },
        {
          match:
            /^(?:diff --git|diff |index |Index: |similarity index|rename (?:from|to)|new file mode|deleted file mode|old mode|new mode|Binary files|-{3}|\+{3}|\*{3} |={3,}|\*{15}$).*/,
          scope: 'comment',
        },
        { match: /^\\ .*/, scope: 'comment' },
        { match: /^[+>].*|^!.*/, scope: 'addition' },
        { match: /^[-<].*/, scope: 'deletion' },
      ],
    },
  },
}
