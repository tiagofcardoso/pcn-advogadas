"""Generic asynchronous repository base class (Repository Pattern)."""

from collections.abc import Sequence
from typing import Generic, TypeVar

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.models.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    def __init__(self, model_class: type[ModelT], session: AsyncSession) -> None:
        self.model_class = model_class
        self.session = session

    async def get_by_id(self, id_: str) -> ModelT | None:
        result = await self.session.execute(
            select(self.model_class).where(self.model_class.id == id_)  # type: ignore[attr-defined]
        )
        return result.scalar_one_or_none()

    async def list_all(self, offset: int = 0, limit: int = 100) -> Sequence[ModelT]:
        result = await self.session.execute(select(self.model_class).offset(offset).limit(limit))
        return result.scalars().all()

    async def add(self, entity: ModelT) -> ModelT:
        self.session.add(entity)
        return entity

    async def delete(self, entity: ModelT) -> None:
        await self.session.delete(entity)

    async def delete_by_id(self, id_: str) -> bool:
        result = await self.session.execute(
            delete(self.model_class).where(self.model_class.id == id_)  # type: ignore[attr-defined]
        )
        return result.rowcount > 0
