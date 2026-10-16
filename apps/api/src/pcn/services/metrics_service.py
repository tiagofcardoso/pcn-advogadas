"""Metrics and Reporting service for law firm productivity and fee analysis."""

from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pcn.domain.enums import TaskStatus
from pcn.models.task import Task
from pcn.repositories.task_repository import TaskRepository
from pcn.schemas.metrics import (
    LawyerMetric,
    MetricsFilterRequest,
    MetricsSummaryResponse,
    TaskTypeMetric,
)


class MetricsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.task_repo = TaskRepository(session)

    async def get_summary(self, filters: MetricsFilterRequest) -> MetricsSummaryResponse:
        """Computes consolidated metrics grouped by Task Type and by Lawyer with partial text search."""
        query = select(Task).options(selectinload(Task.task_type), selectinload(Task.assignee))

        if filters.query:
            term = f"%{filters.query.strip()}%"
            query = query.where((Task.title.ilike(term)) | (Task.description.ilike(term)))
        if filters.task_type_id:
            query = query.where(Task.task_type_id == filters.task_type_id)
        if filters.lawyer_id:
            query = query.where(Task.assigned_to == filters.lawyer_id)
        if filters.client_id:
            query = query.where(Task.client_id == filters.client_id)
        if filters.start_date:
            query = query.where(func.date(Task.created_at) >= filters.start_date)
        if filters.end_date:
            query = query.where(func.date(Task.created_at) <= filters.end_date)

        result = await self.session.execute(query)
        tasks = result.scalars().all()

        total_tasks = len(tasks)
        completed_tasks = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
        total_seconds = sum(t.total_duration_seconds for t in tasks)
        total_hours = round(total_seconds / 3600.0, 2)
        avg_minutes = round((total_seconds / 60.0) / total_tasks, 1) if total_tasks > 0 else 0.0

        # Group by TaskType
        type_groups: dict[str, list[Task]] = defaultdict(list)
        for t in tasks:
            key = t.task_type_id
            type_groups[key].append(t)

        by_task_type: list[TaskTypeMetric] = []
        for type_id, group in type_groups.items():
            type_name = group[0].task_type.name if group[0].task_type else "Outros"
            t_seconds = sum(t.total_duration_seconds for t in group)
            t_count = len(group)
            by_task_type.append(
                TaskTypeMetric(
                    task_type_id=type_id,
                    task_type_name=type_name,
                    task_count=t_count,
                    total_seconds=t_seconds,
                    total_hours=round(t_seconds / 3600.0, 2),
                    average_minutes_per_task=round((t_seconds / 60.0) / t_count, 1)
                    if t_count > 0
                    else 0.0,
                )
            )
        by_task_type.sort(key=lambda m: m.total_seconds, reverse=True)

        # Group by Lawyer
        lawyer_groups: dict[str, list[Task]] = defaultdict(list)
        for t in tasks:
            if t.assigned_to:
                lawyer_groups[t.assigned_to].append(t)

        by_lawyer: list[LawyerMetric] = []
        for l_id, group in lawyer_groups.items():
            l_name = group[0].assignee.name if group[0].assignee else "Desconhecido"
            l_completed = sum(1 for t in group if t.status == TaskStatus.COMPLETED)
            l_seconds = sum(t.total_duration_seconds for t in group)
            by_lawyer.append(
                LawyerMetric(
                    lawyer_id=l_id,
                    lawyer_name=l_name,
                    completed_task_count=l_completed,
                    total_seconds=l_seconds,
                    total_hours=round(l_seconds / 3600.0, 2),
                )
            )
        by_lawyer.sort(key=lambda m: m.total_seconds, reverse=True)

        return MetricsSummaryResponse(
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            total_duration_seconds=total_seconds,
            total_duration_hours=total_hours,
            average_duration_minutes=avg_minutes,
            by_task_type=by_task_type,
            by_lawyer=by_lawyer,
        )
