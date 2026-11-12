import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

export function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected server error occurred';
  let details = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Authentication token is invalid or corrupted';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  } else if (err.code === 'P2002') {
    // Prisma unique constraint violation
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    const fields = err.meta?.target ? ` on field: ${err.meta.target}` : '';
    message = `A resource with identical unique attributes already exists${fields}`;
  } else if (err.code === 'P2025') {
    // Prisma record not found
    statusCode = 404;
    code = 'NOT_FOUND';
    message = 'Requested record was not found';
  }

  // Log error
  if (statusCode >= 500) {
    logger.error({
      err,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      tenantId: req.tenant?.id || req.user?.tenantId
    }, 'Server error encountered');
  } else {
    logger.warn({
      code,
      message,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    }, 'Operational client error');
  }

  const responsePayload = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {})
    }
  };

  if (env.NODE_ENV !== 'production' && statusCode >= 500) {
    responsePayload.error.stack = err.stack;
  }

  res.status(statusCode).json(responsePayload);
}

