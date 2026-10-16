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

    async def get_latest_by_client(self, client_id: str) -> FeeNote | None:
        result = await self.session.execute(
            select(FeeNote)
            .where(FeeNote.client_id == client_id)
            .order_by(FeeNote.updated_at.desc())
            .options(
                selectinload(FeeNote.client),
                selectinload(FeeNote.items),
                selectinload(FeeNote.tasks),
            )
        )
        return result.scalars().first()

    async def list_by_client(self, client_id: str | None = None) -> Sequence[FeeNote]:
        stmt = (
            select(FeeNote)
            .order_by(FeeNote.created_at.desc())
            .options(selectinload(FeeNote.items), selectinload(FeeNote.client))
        )
        if client_id:
            stmt = stmt.where(FeeNote.client_id == client_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def next_reference_code(self, prefix: str = "NH") -> str:
        current_year = datetime.utcnow().year
        pattern = f"{prefix}-{current_year}-%"
        result = await self.session.execute(
            select(FeeNote.reference_code).where(FeeNote.reference_code.like(pattern))
        )
        codes = result.scalars().all()
        max_num = 0
        for code in codes:
            parts = code.split("-")
            if parts and parts[-1].isdigit():
                max_num = max(max_num, int(parts[-1]))
        return f"{prefix}-{current_year}-{max_num + 1:04d}"


class FeeNoteItemRepository(BaseRepository[FeeNoteItem]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(FeeNoteItem, session)
