import { GlobalRegistrator } from '@happy-dom/global-registrator'

/**
 * A DOM for one test file: happy-dom registered on the globals, React told it runs under `act`.
 * Returns the teardown. Mermaid's chunks publish a few globals of their own while they load; those
 * are put back too, so the next file starts clean.
 */
export function registerDom(): () => Promise<void> {
  const kept = ['fastdom', 'injected'].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  )
  GlobalRegistrator.register({ url: 'https://example.test/' })
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  return async () => {
    await GlobalRegistrator.unregister()
    for (const [key, descriptor] of kept) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}
