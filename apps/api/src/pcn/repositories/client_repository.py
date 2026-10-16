"""Client and TaskType repositories."""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.models.client import Client, TaskType
from pcn.repositories.base import BaseRepository


class ClientRepository(BaseRepository[Client]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Client, session)

    async def get_by_nif(self, nif: str) -> Client | None:
        result = await self.session.execute(select(Client).where(Client.nif == nif))
        return result.scalar_one_or_none()

    async def get_by_id_or_name(self, id_or_name: str) -> Client | None:
        if not id_or_name or not id_or_name.strip():
            return None
        clean_val = id_or_name.strip()
        found = await self.get_by_id(clean_val)
        if found:
            return found
        result = await self.session.execute(select(Client).where(Client.name == clean_val))
        found = result.scalar_one_or_none()
        if not found:
            result = await self.session.execute(
                select(Client).where(Client.name.ilike(f"%{clean_val}%"))
            )
            found = result.scalars().first()
        return found

    async def search(self, query: str, limit: int = 50) -> Sequence[Client]:
        pattern = f"%{query}%"
        result = await self.session.execute(
            select(Client)
            .where((Client.name.ilike(pattern)) | (Client.process_reference.ilike(pattern)))
            .order_by(Client.name)
            .limit(limit)
        )
        return result.scalars().all()


class TaskTypeRepository(BaseRepository[TaskType]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(TaskType, session)

    async def get_by_name(self, name: str) -> TaskType | None:
        result = await self.session.execute(select(TaskType).where(TaskType.name == name))
        return result.scalar_one_or_none()

    async def get_by_id_or_name(self, id_or_name: str) -> TaskType | None:
        found = await self.get_by_id(id_or_name)
        if found:
            return found
        result = await self.session.execute(select(TaskType).where(TaskType.name == id_or_name))
        found = result.scalar_one_or_none()
        if not found:
            alias_map = {
                "tp_1": "Certidões e Registos",
                "tp_2": "Peças Processuais",
                "tp_3": "Consultoria e Reuniões",
                "tp_4": "Audiências e Julgamentos",
            }
            target_name = alias_map.get(id_or_name)
            if target_name:
                res2 = await self.session.execute(
                    select(TaskType).where(TaskType.name.ilike(f"%{target_name}%"))
                )
                found = res2.scalars().first()
        return found
