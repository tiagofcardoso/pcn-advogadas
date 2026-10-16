"""Clock abstraction so time-dependent logic (timer, lockout, tokens) is deterministic in tests."""

from datetime import UTC, datetime
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime: ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC).replace(microsecond=0)


system_clock = SystemClock()
