/**
 * SQL, as PostgreSQL, MySQL and SQLite write it: words in any case, strings in single quotes with
 * `''` for a quote, quoted names, `--` and block comments, placeholders and the common functions.
 */
import type { Grammar } from '../engine'
import { codeRules } from './common'

const KEYWORDS =
  'abort action add after all alter always analyze and any as asc attach autoincrement before ' +
  'begin between by cascade case cast check collate column commit conflict constraint create cross ' +
  'current current_date current_time current_timestamp database default deferrable deferred delete ' +
  'desc detach distinct do drop each else end escape except exclusive exists explain fetch filter ' +
  'first following for foreign from full generated glob grant group groups having if ignore ' +
  'immediate in index indexed initially inner insert instead intersect into is isnull join key ' +
  'language last lateral left like limit match materialized natural no not nothing notnull nulls ' +
  'of offset on only or order others outer over partition plan pragma preceding primary procedure ' +
  'raise range recursive references regexp reindex release rename replace restrict returning ' +
  'revoke right rollback row rows savepoint schema select sequence set show table temp temporary ' +
  'then ties to top transaction trigger truncate unbounded union unique update upsert using vacuum ' +
  'values view virtual when where window with without function returns declare execute'
const TYPES =
  'bigint binary bit blob bool boolean bytea char character date datetime decimal double float ' +
  'int integer interval json jsonb money nchar numeric nvarchar real serial bigserial smallint ' +
  'text time timestamp timestamptz tinyint uuid varbinary varchar xml'
const FUNCTIONS =
  'abs avg coalesce concat count date_trunc extract greatest ifnull json_agg json_build_object ' +
  'least length lower max min now nullif round row_number rank dense_rank string_agg substr ' +
  'substring sum trim upper array_agg to_char'

export const sql: Grammar = {
  name: 'sql',
  aliases: ['postgres', 'postgresql', 'psql', 'mysql', 'sqlite', 'plsql', 'tsql', 'pgsql'],
  states: {
    root: {
      rules: codeRules({
        name: 'sql',
        ignoreCase: true,
        calls: false,
        line: '--',
        strings: { double: false },
        words: {
          keyword: KEYWORDS,
          type: TYPES,
          literal: 'true false null unknown',
          built_in: FUNCTIONS,
        },
        first: [
          { match: /'(?:[^']|'')*'?/, scope: 'string' },
          // A quoted name is a name, not a string: `"user"`, `` `order` ``, `[Order Details]`.
          { match: /"[^"\n]*"?|`[^`\n]*`?/ },
          { match: /[$:@?]\w+|\$\d+|\?/, scope: 'variable' },
        ],
      }),
    },
    comment: { rules: [{ match: /\*\//, scope: 'comment', pop: true }], fill: 'comment' },
  },
}
