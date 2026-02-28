import { createHash } from 'node:crypto'

const SHARE_PASSWORD_PATTERN = /^[0-9A-Za-z]{4}$/

export function normalizeSharePassword(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function validateSharePassword(value: string | null) {
  if (!value) {
    return
  }

  if (!SHARE_PASSWORD_PATTERN.test(value)) {
    throw new Error('Share password must be exactly 4 characters using 0-9, a-z, or A-Z.')
  }
}

export function hashSharePassword(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function isSharePasswordValid(value: string, hash: string) {
  return hashSharePassword(value) === hash
}
