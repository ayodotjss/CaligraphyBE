import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: error.flatten()
    });
  }

  const statusCode = error.statusCode ?? 500;
  const message = statusCode === 500 ? "Internal server error" : error.message;

  if (statusCode === 500) {
    console.error(error);
  }

  return res.status(statusCode).json({
    error: message,
    ...(error.details ? { details: error.details } : {})
  });
}
