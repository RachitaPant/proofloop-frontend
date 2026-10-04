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
