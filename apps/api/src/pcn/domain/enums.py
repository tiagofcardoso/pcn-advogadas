"""Domain enumerations (persisted by value)."""

from enum import StrEnum


class UserRole(StrEnum):
    MASTER = "master"  # IT / system owner: full access, manages admins
    ADMIN = "admin_lawyer"
    LAWYER = "lawyer"


ADMIN_ROLES: frozenset["UserRole"] = frozenset({UserRole.MASTER, UserRole.ADMIN})


class TaskStatus(StrEnum):
    BACKLOG = "backlog"  # private to direction board
    POOL = "pool"  # visible on shared board, unassigned
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class TaskAction(StrEnum):
    PUBLISH = "publish"  # backlog → pool
    WITHDRAW = "withdraw"  # pool → backlog
    ASSIGN = "assign"  # admin assigns / reassigns
    CLAIM = "claim"  # lawyer self-assigns from pool
    RELEASE = "release"  # lawyer returns task to pool
    START = "start"  # assigned/paused → in_progress
    PAUSE = "pause"
    COMPLETE = "complete"
    REOPEN = "reopen"  # admin reopens a non-billed completed task
    ARCHIVE = "archive"  # move completed task to archived


class FeeNoteStatus(StrEnum):
    DRAFT = "draft"
    ISSUED = "issued"
    PAID = "paid"


class AuditAction(StrEnum):
    LOGIN_SUCCESS = "auth.login_success"
    LOGIN_FAILURE = "auth.login_failure"
    ACCOUNT_LOCKED = "auth.account_locked"
    REFRESH_REUSE = "auth.refresh_reuse_detected"
    PASSWORD_CHANGED = "auth.password_changed"
    MFA_ENABLED = "auth.mfa_enabled"
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_PASSWORD_RESET = "user.password_reset"
    USER_MFA_RESET = "user.mfa_reset"
    USER_UNLOCKED = "user.unlocked"
    USER_SUSPENDED = "user.suspended"
    USER_REACTIVATED = "user.reactivated"
    USER_ROLE_CHANGED = "user.role_changed"
    LOGOUT = "auth.logout"
    TASK_TRANSITION = "task.transition"
    SESSION_CORRECTED = "time_session.corrected"
    FEE_NOTE_ISSUED = "fee_note.issued"
    FEE_NOTE_EXPORTED = "fee_note.exported"
    FEE_NOTE_PAID = "fee_note.paid"
    CLIENT_DELETED = "client.deleted"
