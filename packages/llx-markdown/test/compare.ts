/**
 * What React's HTML writer and the package's own are allowed to differ in, taken out of both
 * before the two are compared byte for byte:
 * - React asks the browser to preload an image it draws (`<link rel="preload">`), ahead of the page;
 * - a `[!TABS]` form's ids start with React's own id there and with the block's place here;
 * - a line break first in a `<pre>` is written twice so that the parser keeps one. React does it
 *   only for a `<pre>` whose whole inside is one text; `render/vnode.test.ts` holds the package's
 *   writer to it always.
 */
export const comparable = (markup: string): string =>
  markup
    .replace(/<link rel="preload" as="image"[^>]*\/>/g, '')
    .replace(/(_R_[0-9a-z]+_|llx-\d+)-(tab|panel)-/g, 'ID-$2-')
    .replace(/(<pre[^>]*>)\n\n?/g, '$1\n')
