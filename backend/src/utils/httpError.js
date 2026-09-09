export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new ApiError(400, message, details);
export const forbidden = (message, details) => new ApiError(403, message, details);
export const notFoundError = (message = 'Not found') => new ApiError(404, message);
export const tooManyRequests = (message = 'Too many requests') => new ApiError(429, message);

// Wrap async route handlers so rejections reach the error middleware.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
