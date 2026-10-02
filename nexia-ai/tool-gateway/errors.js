'use strict';
const CODES = Object.freeze({
  UNKNOWN_TOOL: 'UNKNOWN_TOOL',
  INVALID_INPUT: 'INVALID_INPUT',
  FORBIDDEN: 'FORBIDDEN',
  SCOPE: 'SCOPE',
  NOT_PENDING: 'NOT_PENDING',
  EXPIRED: 'EXPIRED',
  UPSTREAM: 'UPSTREAM',
  UPSTREAM_NOT_FOUND: 'UPSTREAM_NOT_FOUND',
});
const HTTP_STATUS = { UNKNOWN_TOOL: 404, INVALID_INPUT: 400, FORBIDDEN: 403, SCOPE: 403, NOT_PENDING: 409, EXPIRED: 409, UPSTREAM: 502, UPSTREAM_NOT_FOUND: 404 };

class GatewayError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.details = details;
  }
}

module.exports = { GatewayError, CODES, HTTP_STATUS };
