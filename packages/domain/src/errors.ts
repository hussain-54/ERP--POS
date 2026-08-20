export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class ValidationDomainError extends DomainError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationDomainError";
  }
}

export class ForbiddenDomainError extends DomainError {
  constructor(message: string) {
    super(message, "FORBIDDEN");
    this.name = "ForbiddenDomainError";
  }
}

export class ConflictDomainError extends DomainError {
  constructor(message: string) {
    super(message, "CONFLICT");
    this.name = "ConflictDomainError";
  }
}
