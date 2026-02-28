import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export function ok<T>(data: T, meta: Record<string, unknown> = {}) {
  return {
    success: true,
    data,
    meta
  }
}

export function fail(
  code: string,
  message: string,
  status: ContentfulStatusCode = 400
): never {
  throw new HTTPException(status, {
    message,
    cause: {
      success: false,
      error: {
        code,
        message
      }
    }
  })
}
