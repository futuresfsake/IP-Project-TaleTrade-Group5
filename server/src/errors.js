/* eslint-env node */
/** An error that maps onto an HTTP response: { error: { code, message, details? } }. */
class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (message, details) => new ApiError(400, 'invalid_request', message, details);
const unauthorized = (message = 'Sign in to use this endpoint.') =>
  new ApiError(401, 'unauthorized', message);
const forbidden = (message = 'You do not own this resource.') => new ApiError(403, 'forbidden', message);
const notFound = (code, message) => new ApiError(404, code, message);
const conflict = (code, message) => new ApiError(409, code, message);

module.exports = { ApiError, badRequest, unauthorized, forbidden, notFound, conflict };
