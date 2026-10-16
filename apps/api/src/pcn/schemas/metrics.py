"""Pydantic schemas for Metrics, Performance and Aggregations."""

from datetime import date

from pydantic import BaseModel, Field


class MetricsFilterRequest(BaseModel):
    query: str | None = Field(None, description="Termo de pesquisa (ex: 'negativa')")
    task_type_id: str | None = None
    lawyer_id: str | None = None
    client_id: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class TaskTypeMetric(BaseModel):
    task_type_id: str
    task_type_name: str
    task_count: int
    total_seconds: int
    total_hours: float
    average_minutes_per_task: float


class LawyerMetric(BaseModel):
    lawyer_id: str
    lawyer_name: str
    completed_task_count: int
    total_seconds: int
    total_hours: float


class MetricsSummaryResponse(BaseModel):
    total_tasks: int
    completed_tasks: int
    total_duration_seconds: int
    total_duration_hours: float
    average_duration_minutes: float
    by_task_type: list[TaskTypeMetric]
    by_lawyer: list[LawyerMetric]
