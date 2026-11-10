Folded
---
## Folded sections

> [!DETAILS] Timings from the last ten runs
> | Step  | Before | After |
> | ----- | -----: | ----: |
> | Build |  212 s |  47 s |

> [!DETAILS] Closed by default, text only
> A paragraph of **text**, then a list:
>
> - Detail 1
> - Detail 2

<details open>
<summary>Нажмите, чтобы раскрыть подробности</summary>

Внутри можно разместить **текст**, список и другие элементы:

- Деталь 1
- Деталь 2

</details>

<details open>
<summary>Bare text inside</summary>
Text written right after the summary, with no blank line.
</details>

<details open>
<summary>Code and a callout inside</summary>

```ts
const answer = 42
```

> [!NOTE]
> Nested callout.

</details>

<details>
<summary>Closed HTML details</summary>

Hidden.

</details>

Text after.

## Tabs

> [!TABS]
#### macOS
```sh
brew install llx
```
#### Linux
```sh
curl -fsSL https://example.com/install.sh | sh
```
#### Windows
Download the installer and run it.

---

Both put `llx` on your `PATH`.

## Sources

> [!SOURCES] Further reading
- [Bundler options](https://bun.sh/docs/bundler) — `typecheck` runs the compiler inside the build
- [Project references](https://www.typescriptlang.org/docs/handbook/project-references.html)
- https://example.com/a/very/long/path

## Quote

> Simplicity is prerequisite for reliability. — Edsger W. Dijkstra

> A plain quote, two lines long so that it wraps onto the next line and shows the rule beside it clearly.
