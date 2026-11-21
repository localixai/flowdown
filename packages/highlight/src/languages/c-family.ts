/**
 * The languages that read like C: C and C++ with their preprocessor, C#, Java, Kotlin, Swift, Go,
 * Rust and PHP. Each is the common rules (`cLike`) with its own words and the strings and marks
 * only it has.
 */
import type { Grammar, Rule, State } from '../engine'
import { cLike, literal } from './common'

/** A preprocessor line: `#include <stdio.h>`, `#define MAX 10`, `#region`. */
const preprocessor = (words: string): Rule => ({
  match: new RegExp(`^\\s*#\\s*(?:${words})\\b`),
  scope: 'meta',
  push: 'directive',
})
const directive: State = {
  rules: [
    { match: /<[^>\n]*>|"[^"\n]*"?/, scope: 'string' },
    { match: /\/\/.*/, scope: 'comment' },
  ],
  fill: 'meta',
  line: true,
}

const C_TYPES =
  'bool char double float int long short signed unsigned void size_t ssize_t ptrdiff_t ' +
  'int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t intptr_t uintptr_t FILE'
const C_KEYWORDS =
  'auto break case const continue default do else enum extern for goto if inline register ' +
  'restrict return sizeof static struct switch typedef union volatile while _Alignas _Alignof ' +
  '_Atomic _Bool _Generic _Noreturn _Static_assert _Thread_local'
const DIRECTIVES =
  'include|define|undef|if|ifdef|ifndef|elif|else|endif|error|warning|pragma|line|import'

export const c: Grammar = cLike({
  name: 'c',
  aliases: ['h'],
  words: { keyword: C_KEYWORDS, type: C_TYPES, literal: 'true false NULL' },
  classes: 'struct union enum',
  first: [preprocessor(DIRECTIVES)],
  states: { directive },
})

/** C++'s raw string, `R"x(…)x"`: its own closer, across lines. */
const RAW: Rule = {
  match: /(?:u8|[uUL])?R"[^\s()\\]{0,16}\(/,
  scope: 'string',
  push: 'raw',
  arg: (text) => text.slice(text.indexOf('"') + 1, -1),
}

export const cpp: Grammar = cLike({
  name: 'cpp',
  aliases: ['c++', 'cc', 'cxx', 'hpp', 'hh', 'hxx', 'h++'],
  words: {
    keyword:
      `${C_KEYWORDS} alignas alignof and asm catch class co_await co_return co_yield concept ` +
      'consteval constexpr constinit const_cast decltype delete dynamic_cast explicit export final ' +
      'friend mutable namespace new noexcept not operator or override private protected public ' +
      'reinterpret_cast requires static_assert static_cast template this throw try typeid typename ' +
      'using virtual',
    type:
      `${C_TYPES} wchar_t char8_t char16_t char32_t auto string vector map set unordered_map ` +
      'unique_ptr shared_ptr optional',
    literal: 'true false nullptr NULL',
    built_in: 'std cout cerr cin endl printf malloc free',
  },
  classes: 'class struct union enum namespace',
  first: [preprocessor(DIRECTIVES), RAW],
  states: {
    directive,
    raw: {
      rules: (delimiter) => [
        { match: new RegExp(`\\)${literal(delimiter)}"`), scope: 'string', pop: true },
      ],
      fill: 'string',
    },
  },
})

export const csharp: Grammar = cLike({
  name: 'csharp',
  aliases: ['cs', 'c#'],
  capitals: true,
  words: {
    keyword:
      'abstract add alias as ascending async await base break by case catch checked class const ' +
      'continue default delegate descending do else enum event explicit extern finally fixed for ' +
      'foreach from get global goto group if implicit in init interface internal into is join let ' +
      'lock nameof namespace new notnull on operator orderby out override params partial private ' +
      'protected public readonly record ref remove required return sealed select set sizeof ' +
      'stackalloc static struct switch this throw try typeof unchecked unmanaged unsafe using value ' +
      'var virtual volatile when where while with yield ' +
      // C# writes its built-in types as keywords, and editors colour them so.
      'bool byte char decimal double dynamic float int long nint nuint object sbyte short string ' +
      'uint ulong ushort void',
    literal: 'true false null',
  },
  classes: 'class struct interface enum record new',
  first: [
    preprocessor(
      'if|else|elif|endif|define|undef|warning|error|line|region|endregion|pragma|nullable',
    ),
    // A verbatim string (`@"C:\path"`) has no escapes and goes on across lines; `""` is a quote.
    { match: /\$?@"|@\$"/, scope: 'string', push: 'verbatim' },
    { match: /\$"/, scope: 'string', push: 'interpolated' },
    // An attribute's name, `[ApiController]`, `[HttpGet("{id}")]`: a type, as it is one.
    { match: /(?<=^\s*\[)[A-Za-z_][\w.]*(?=[\](])/, scope: 'type' },
  ],
  states: {
    directive,
    verbatim: {
      rules: [{ match: /""/ }, { match: /"/, scope: 'string', pop: true }],
      fill: 'string',
    },
    interpolated: {
      rules: [
        { match: /\\[\s\S]?|\{\{|\}\}/ },
        { match: /\{[^}"\n]*\}?/, scope: 'subst' },
        { match: /"/, scope: 'string', pop: true },
      ],
      fill: 'string',
      line: true,
    },
  },
})

/** Annotations (`@Override`, `@Test`): Java, Kotlin, Swift's attributes. */
const ANNOTATION: Rule = { match: /@[A-Za-z_][\w.]*/, scope: 'meta' }
/** A text block, `"""…"""`, across lines (Java, Kotlin, Swift). */
const TEXT_BLOCK: Rule = { match: /"""/, scope: 'string', push: 'block' }
const textBlock = (extra: Rule[] = []): State => ({
  rules: [{ match: /\\[\s\S]?/ }, ...extra, { match: /"""/, scope: 'string', pop: true }],
  fill: 'string',
})

export const java: Grammar = cLike({
  name: 'java',
  aliases: ['jsp'],
  capitals: true,
  words: {
    keyword:
      'abstract assert break case catch class const continue default do else enum exports extends ' +
      'final finally for goto if implements import instanceof interface module native new non-sealed ' +
      'open opens package permits private protected provides public record requires return sealed ' +
      'static strictfp super switch synchronized this throw throws to transient transitive try uses ' +
      'var void volatile when while with yield',
    type: 'boolean byte char double float int long short void',
    literal: 'true false null',
  },
  classes: 'class interface enum record extends implements new throws',
  first: [TEXT_BLOCK, ANNOTATION],
  states: { block: textBlock() },
})

/** `$name` and `${expression}` in a Kotlin or a PHP string. */
const DOLLAR_NAME: Rule = { match: /\$[A-Za-z_]\w*/, scope: 'variable' }
const dollarBraces: Rule = { match: /\$\{[^}\n]*\}?/, scope: 'subst' }

export const kotlin: Grammar = cLike({
  name: 'kotlin',
  aliases: ['kt', 'kts'],
  capitals: true,
  words: {
    keyword:
      'abstract actual annotation as break by catch class companion const constructor continue ' +
      'crossinline data do dynamic else enum expect external field file final finally for fun get ' +
      'if import in infix init inline inner interface internal is lateinit noinline object open ' +
      'operator out override package param private property protected public reified return sealed ' +
      'set super suspend tailrec this throw try typealias typeof val value var vararg when where while',
    type:
      'Any Array Boolean Byte Char Double Float Int List Long Map MutableList MutableMap Nothing Set ' +
      'Short String Unit',
    literal: 'true false null',
  },
  functions: 'fun',
  classes: 'class interface object typealias',
  first: [TEXT_BLOCK, ANNOTATION],
  strings: { double: true, single: true, extra: [dollarBraces, DOLLAR_NAME] },
  states: { block: textBlock([dollarBraces, DOLLAR_NAME]) },
})

export const swift: Grammar = cLike({
  name: 'swift',
  capitals: true,
  words: {
    keyword:
      'actor any as associatedtype async await break case catch class continue convenience default ' +
      'defer deinit didSet do dynamic else enum extension fallthrough fileprivate final for func get ' +
      'guard if import in indirect infix init inout internal is lazy let mutating nonisolated ' +
      'nonmutating open operator optional override postfix precedencegroup prefix private protocol ' +
      'public repeat required rethrows return self Self set some static struct subscript super ' +
      'switch throw throws try typealias unowned var weak where while willSet',
    type: 'Any AnyObject Bool Character Double Float Int Int8 Int16 Int32 Int64 String UInt Void',
    literal: 'true false nil',
  },
  functions: 'func',
  classes: 'class struct enum protocol extension actor typealias',
  strings: { double: true, extra: [{ match: /\\\([^)\n]*\)?/, scope: 'subst' }] },
  first: [
    TEXT_BLOCK,
    { match: /@[A-Za-z_]\w*/, scope: 'keyword' },
    { match: /#[A-Za-z_]\w*/, scope: 'meta' },
  ],
  nestedBlock: true,
  states: { block: textBlock([{ match: /\\\([^)\n]*\)?/, scope: 'subst' }]) },
})

export const go: Grammar = cLike({
  name: 'go',
  aliases: ['golang'],
  words: {
    keyword:
      'break case chan const continue default defer else fallthrough for func go goto if import ' +
      'interface map package range return select struct switch type var',
    type:
      'any bool byte comparable complex64 complex128 error float32 float64 int int8 int16 int32 ' +
      'int64 rune string uint uint8 uint16 uint32 uint64 uintptr',
    literal: 'true false nil iota',
    built_in:
      'append cap clear close complex copy delete imag len make max min new panic print println ' +
      'real recover',
  },
  functions: 'func',
  classes: 'type',
  // A raw string, between backticks, goes on across lines; a rune is a character in quotes.
  first: [
    { match: /`/, scope: 'string', push: 'raw' },
    { match: /(?<=\bfunc\s*\([^)]*\)\s*)[A-Za-z_]\w*/, scope: 'title function_' },
  ],
  states: { raw: { rules: [{ match: /`/, scope: 'string', pop: true }], fill: 'string' } },
})

export const rust: Grammar = cLike({
  name: 'rust',
  aliases: ['rs'],
  capitals: true,
  nestedBlock: true,
  words: {
    keyword:
      'as async await break const continue crate dyn else enum extern fn for if impl in let loop ' +
      'match mod move mut pub ref return static struct super trait type union unsafe use where while ' +
      'yield',
    type:
      'bool char f32 f64 i8 i16 i32 i64 i128 isize str u8 u16 u32 u64 u128 usize Box Option Result ' +
      'String Vec HashMap HashSet BTreeMap Rc Arc RefCell Cell',
    literal: 'true false Some None Ok Err',
    'variable language_': 'self Self',
  },
  functions: 'fn',
  classes: 'struct enum trait type impl for union',
  first: [
    // A raw string: `r#"…"#`, closed by a quote and as many `#`.
    { match: /b?r#*"/, scope: 'string', push: 'raw', arg: (text) => text.replace(/^b?r|"$/g, '') },
    // A character, not a lifetime: `'a'`, `'\n'`; a lifetime is `'a` with no closing quote.
    { match: /b?'(?:\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]{1,6}\}|.)|[^\\'\n])'/, scope: 'string' },
    { match: /'[A-Za-z_]\w*(?!')/, scope: 'symbol' },
    { match: /#!?\[[^\]\n]*\]?/, scope: 'meta' },
    { match: /[A-Za-z_]\w*!(?=\s*[([{])/, scope: 'built_in' },
  ],
  strings: { double: true, multiline: true, single: false },
  states: {
    raw: {
      rules: (hashes) => [{ match: new RegExp(`"${hashes}`), scope: 'string', pop: true }],
      fill: 'string',
    },
  },
})

export const php: Grammar = cLike({
  name: 'php',
  aliases: ['php3', 'php4', 'php5', 'php7', 'php8'],
  ignoreCase: true,
  capitals: true,
  line: '//',
  words: {
    keyword:
      'abstract and array as break callable case catch class clone const continue declare default do ' +
      'echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile enum extends final ' +
      'finally fn for foreach function global goto if implements include include_once instanceof ' +
      'insteadof interface isset list match namespace new or print private protected public readonly ' +
      'require require_once return static switch throw trait try unset use var while xor yield',
    type: 'bool float int mixed never object string void iterable',
    literal: 'true false null',
    'variable language_': '$this self parent',
  },
  functions: 'function fn',
  classes: 'class interface trait enum extends implements new',
  first: [
    { match: /<\?(?:php|=)?|\?>/, scope: 'meta' },
    { match: /#(?!\[).*/, scope: 'comment' },
    { match: /#\[[^\]\n]*\]?/, scope: 'meta' },
    { match: /\$this\b/, scope: 'variable language_' },
    DOLLAR_NAME,
  ],
  strings: {
    double: true,
    single: true,
    multiline: true,
    extra: [DOLLAR_NAME, { match: /\{\$[^}\n]*\}?/, scope: 'subst' }],
  },
})
