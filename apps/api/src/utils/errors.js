class ResourceNotFoundException extends Error {
  constructor(message) {
    super(message);
    this.status = 404;
    this.error = 'Not Found';
  }
}

class BadRequestException extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.error = 'Bad Request';
  }
}

class UnauthorizedException extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.status = 401;
    this.error = 'Unauthorized';
  }
}

class AccessDeniedException extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.status = 403;
    this.error = 'Forbidden';
  }
}

class ConflictException extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
    this.error = 'Conflict';
  }
}

module.exports = {
  ResourceNotFoundException,
  BadRequestException,
  UnauthorizedException,
  AccessDeniedException,
  ConflictException,
};
