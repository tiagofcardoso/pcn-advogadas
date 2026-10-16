"""Fee Note repository."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pcn.models.fee_note import FeeNote, FeeNoteItem
from pcn.repositories.base import BaseRepository


class FeeNoteRepository(BaseRepository[FeeNote]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(FeeNote, session)

    async def get_with_items(self, id_: str) -> FeeNote | None:
        result = await self.session.execute(
            select(FeeNote)
            .where((FeeNote.id == id_) | (FeeNote.reference_code == id_))
            .options(
                selectinload(FeeNote.client),
                selectinload(FeeNote.items),
                selectinload(FeeNote.tasks),
            )
        )
        return result.scalar_one_or_none()

    async def list_by_client(self, client_id: str) -> Sequence[FeeNote]:
        result = await self.session.execute(
            select(FeeNote)
            .where(FeeNote.client_id == client_id)
            .order_by(FeeNote.created_at.desc())
            .options(selectinload(FeeNote.items), selectinload(FeeNote.client))
        )
        return result.scalars().all()

    async def next_reference_code(self, prefix: str = "NH") -> str:
        current_year = datetime.utcnow().year
        pattern = f"{prefix}-{current_year}-%"
        result = await self.session.execute(
            select(func.count(FeeNote.id)).where(FeeNote.reference_code.like(pattern))
        )
        count = result.scalar_one() or 0
        return f"{prefix}-{current_year}-{count + 1:04d}"


class FeeNoteItemRepository(BaseRepository[FeeNoteItem]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(FeeNoteItem, session)
