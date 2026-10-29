export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly error: string,
    message: string,
  ) {
    super(message);
  }
}

export class ResourceNotFoundException extends HttpError {
  constructor(message: string) {
    super(404, 'Not Found', message);
  }
}

export class BadRequestException extends HttpError {
  constructor(message: string) {
    super(400, 'Bad Request', message);
  }
}

export class UnauthorizedException extends HttpError {
  constructor(message = 'Authentication required') {
    super(401, 'Unauthorized', message);
  }
}

export class AccessDeniedException extends HttpError {
  constructor(message = 'Access denied') {
    super(403, 'Forbidden', message);
  }
}

export class ConflictException extends HttpError {
  constructor(message: string) {
    super(409, 'Conflict', message);
  }
}

/** 400 with the flat { field: message } body that schema validation uses. */
export class ValidationException extends HttpError {
  constructor(readonly errors: Record<string, string>) {
    super(400, 'Bad Request', Object.values(errors)[0] ?? 'Invalid input');
  }
}

/** A dependency (the database) is down or not configured. */
export class ServiceUnavailableException extends HttpError {
  constructor(message = 'Service temporarily unavailable. Try again shortly.') {
    super(503, 'Service Unavailable', message);
  }
}

/** The request was understood but the result can't be used (e.g. an AI draft that fails validation). */
export class UnprocessableException extends HttpError {
  constructor(message: string) {
    super(422, 'Unprocessable Entity', message);
  }
}

export class TooManyRequestsException extends HttpError {
  constructor(message: string) {
    super(429, 'Too Many Requests', message);
  }
}
