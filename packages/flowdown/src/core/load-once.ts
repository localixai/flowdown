/**
 * A lazy loader that runs once and remembers its success, but not its failure.
 *
 * The heavy parts (the math typesetter, the diagram engine) are fetched on first use. A loader
 * that cached its rejection as faithfully as its result left the feature dead for the rest of the
 * page after one failed chunk fetch (an app updated under an open tab, a dev server re-optimizing a
 * dependency). A failure here clears the slot, so the next caller retries, while concurrent
 * callers still share one request.
 */
export function loadOnce<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null
  return () => {
    pending ??= load().catch((error: unknown) => {
      pending = null
      throw error
    })
    return pending
  }
}
