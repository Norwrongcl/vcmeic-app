import {
  type ExceptionFilter,
  type ArgumentsHost,
  HttpException,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { ZodError } from 'zod'
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}
export function errorBody(error: unknown, correlationId: string) {
  const status =
    error instanceof ApiError
      ? error.status
      : error instanceof ZodError
        ? 422
        : error instanceof HttpException
          ? error.getStatus()
          : 500
  const code =
    error instanceof ApiError
      ? error.code
      : status === 422
        ? 'INVALID_INPUT'
        : status === 404
          ? 'NOT_FOUND'
          : status === 413
            ? 'PAYLOAD_TOO_LARGE'
            : 'INTERNAL_ERROR'
  return {
    status,
    body: {
      code,
      message:
        error instanceof ApiError
          ? error.message
          : status === 422
            ? 'Revisa los datos enviados.'
            : status === 404
              ? 'Recurso no encontrado.'
              : status === 413
                ? 'Solicitud demasiado grande.'
                : 'No se pudo procesar la solicitud.',
      correlationId,
      ...(error instanceof ZodError
        ? {
            issues: error.issues.map((i) => ({
              path: i.path.join('.'),
              code: i.code,
            })),
          }
        : {}),
    },
  }
}
export class ErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<Request>()
    const res = host.switchToHttp().getResponse<Response>()
    const out = errorBody(
      exception,
      String(
        res.locals.correlationId ??
          req.headers['x-correlation-id'] ??
          'unavailable',
      ),
    )
    res.status(out.status).json(out.body)
  }
}
