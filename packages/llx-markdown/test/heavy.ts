import { describe } from 'bun:test'

/**
 * A sweep over every prefix of the seeded replies: seconds of work for each reply, and the same
 * check at a thousand points. It runs with `bun test`, and CI leaves it out (`LLX_SKIP_HEAVY=1`):
 * a push is checked by the rest of the suite in seconds, a change to streaming is checked here,
 * locally, before it is pushed.
 */
export const heavyDescribe = describe.skipIf(Boolean(process.env.LLX_SKIP_HEAVY))
