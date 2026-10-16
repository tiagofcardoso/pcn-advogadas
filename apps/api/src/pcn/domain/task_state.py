"""State Pattern for the task lifecycle.

Each concrete state declares which actions it accepts and the resulting state. Services ask the
current state object for the next status instead of scattering if/elif chains.

    backlog     : publish→pool, assign→assigned
    pool        : withdraw→backlog, claim→assigned, assign→assigned
    assigned    : start→in_progress, assign→assigned, release→pool, withdraw→backlog,
                  complete→completed
    in_progress : pause→paused, complete→completed
    paused      : start→in_progress, complete→completed, assign→paused
    completed   : reopen→paused
"""

from abc import ABC
from collections.abc import Mapping
from types import MappingProxyType
from typing import ClassVar

from pcn.core.errors import InvalidTransition
from pcn.domain.enums import TaskAction, TaskStatus


class TaskState(ABC):
    status: ClassVar[TaskStatus]
    transitions: ClassVar[Mapping[TaskAction, TaskStatus]]
    has_running_timer: ClassVar[bool] = False

    def next(self, action: TaskAction) -> TaskStatus:
        try:
            return self.transitions[action]
        except KeyError:
            raise InvalidTransition(
                details={"status": self.status.value, "action": action.value}
            ) from None

    def allowed_actions(self) -> frozenset[TaskAction]:
        return frozenset(self.transitions)


class BacklogState(TaskState):
    status = TaskStatus.BACKLOG
    transitions = MappingProxyType(
        {
            TaskAction.PUBLISH: TaskStatus.POOL,
            TaskAction.ASSIGN: TaskStatus.ASSIGNED,
        }
    )


class PoolState(TaskState):
    status = TaskStatus.POOL
    transitions = MappingProxyType(
        {
            TaskAction.WITHDRAW: TaskStatus.BACKLOG,
            TaskAction.CLAIM: TaskStatus.ASSIGNED,
            TaskAction.ASSIGN: TaskStatus.ASSIGNED,
        }
    )


class AssignedState(TaskState):
    status = TaskStatus.ASSIGNED
    transitions = MappingProxyType(
        {
            TaskAction.START: TaskStatus.IN_PROGRESS,
            TaskAction.ASSIGN: TaskStatus.ASSIGNED,
            TaskAction.RELEASE: TaskStatus.POOL,
            TaskAction.WITHDRAW: TaskStatus.BACKLOG,
            TaskAction.COMPLETE: TaskStatus.COMPLETED,
        }
    )


class InProgressState(TaskState):
    status = TaskStatus.IN_PROGRESS
    has_running_timer = True
    transitions = MappingProxyType(
        {
            TaskAction.PAUSE: TaskStatus.PAUSED,
            TaskAction.COMPLETE: TaskStatus.COMPLETED,
        }
    )


class PausedState(TaskState):
    status = TaskStatus.PAUSED
    transitions = MappingProxyType(
        {
            TaskAction.START: TaskStatus.IN_PROGRESS,
            TaskAction.COMPLETE: TaskStatus.COMPLETED,
            TaskAction.ASSIGN: TaskStatus.PAUSED,
        }
    )


class CompletedState(TaskState):
    status = TaskStatus.COMPLETED
    transitions = MappingProxyType(
        {
            TaskAction.REOPEN: TaskStatus.PAUSED,
            TaskAction.ARCHIVE: TaskStatus.ARCHIVED,
        }
    )


class ArchivedState(TaskState):
    status = TaskStatus.ARCHIVED
    transitions = MappingProxyType(
        {
            TaskAction.REOPEN: TaskStatus.COMPLETED,
        }
    )


_REGISTRY: Mapping[TaskStatus, TaskState] = MappingProxyType(
    {
        state.status: state
        for state in (
            BacklogState(),
            PoolState(),
            AssignedState(),
            InProgressState(),
            PausedState(),
            CompletedState(),
            ArchivedState(),
        )
    }
)


def state_for(status: TaskStatus) -> TaskState:
    return _REGISTRY[status]


def next_status(current: TaskStatus, action: TaskAction) -> TaskStatus:
    return state_for(current).next(action)
