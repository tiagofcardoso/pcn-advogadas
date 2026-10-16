"""Domain/application errors mapped to a uniform JSON error envelope.

Responses carry a stable machine-readable `code` (translated by the frontend i18n layer)
and a generic English message. Internal details are never leaked to clients.
"""

from typing import Any


class AppError(Exception):
    status_code: int = 400
    code: str = "bad_request"
    message: str = "Bad request."

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.message = message or self.message
        self.code = code or self.code
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(AppError):
    status_code = 401
    code = "invalid_credentials"
    message = "Invalid credentials or account temporarily locked."


class TokenError(AppError):
    status_code = 401
    code = "invalid_token"
    message = "Invalid or expired token."


class PermissionDenied(AppError):
    status_code = 403
    code = "forbidden"
    message = "You do not have permission to perform this action."


class NotFound(AppError):
    status_code = 404
    code = "not_found"
    message = "Resource not found."


class Conflict(AppError):
    status_code = 409
    code = "conflict"
    message = "The request conflicts with the current state of the resource."


class InvalidTransition(Conflict):
    code = "invalid_transition"
    message = "This action is not allowed in the task's current state."


class BusinessRuleViolation(AppError):
    status_code = 422
    code = "business_rule_violation"
    message = "The request violates a business rule."
