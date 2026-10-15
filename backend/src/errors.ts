export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class AuthenticationError extends HttpError {
  constructor(code = "AUTHENTICATION_REQUIRED", message = "A valid bearer token is required") {
    super(401, code, message);
  }
}

export class AuthorizationError extends HttpError {
  constructor(code = "ACCESS_DENIED", message = "The authenticated identity is not authorized") {
    super(403, code, message);
  }
}
