import { describe, expect, test } from 'bun:test'
import { hello } from './index'

describe('hello', () => {
  test('gives back what it was given', () => {
    expect(hello('a model wrote this')).toBe('a model wrote this')
  })
})
