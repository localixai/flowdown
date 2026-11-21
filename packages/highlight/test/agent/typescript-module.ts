import { readFile, writeFile } from 'node:fs/promises'
import type { Logger } from './logger'

/** A task the queue runs, with its retries. */
export interface Task<T = unknown> {
  id: string
  run: (signal: AbortSignal) => Promise<T>
  retries?: number
  readonly createdAt: Date
}

export type Status = 'queued' | 'running' | 'done' | 'failed'

const DEFAULT_RETRIES = 3
const ID_PATTERN = /^[a-z0-9-]{8,}$/i

export class TaskQueue<T> {
  private readonly tasks = new Map<string, Task<T>>()
  #running = 0

  constructor(
    private readonly logger: Logger,
    private readonly concurrency = 4,
  ) {}

  add(task: Task<T>): void {
    if (!ID_PATTERN.test(task.id)) throw new Error(`Invalid task id: ${task.id}`)
    this.tasks.set(task.id, { retries: DEFAULT_RETRIES, ...task })
  }

  async drain(timeoutMs = 30_000): Promise<Record<string, Status>> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const results: Record<string, Status> = {}
    try {
      for (const [id, task] of this.tasks) {
        results[id] = await this.attempt(task, controller.signal)
      }
    } finally {
      clearTimeout(timer)
    }
    return results
  }

  private async attempt(task: Task<T>, signal: AbortSignal): Promise<Status> {
    let left = task.retries ?? DEFAULT_RETRIES
    while (left-- > 0) {
      try {
        this.#running += 1
        await task.run(signal)
        return 'done'
      } catch (error) {
        this.logger.warn(`task ${task.id} failed (${left} left)`, error as Error)
      } finally {
        this.#running -= 1
      }
    }
    return 'failed'
  }
}

export async function loadConfig(path: string): Promise<{ name: string; port: number }> {
  const text = await readFile(path, 'utf8')
  const config = JSON.parse(text) as Partial<{ name: string; port: number }>
  return { name: config.name ?? 'app', port: Number(config.port) || 8080 }
}

export const saveReport = async (path: string, rows: readonly string[][]) =>
  writeFile(path, rows.map((row) => row.join('\t')).join('\n'))
