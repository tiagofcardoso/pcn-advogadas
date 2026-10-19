"""User and Refresh Token repositories."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.models.user import RefreshToken, User
from pcn.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(User, session)

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email.strip().lower()))
        return result.scalar_one_or_none()

    async def list_active_lawyers(self) -> Sequence[User]:
        result = await self.session.execute(
            select(User).where(User.is_active == True).order_by(User.name)
        )
        return result.scalars().all()

    async def get_by_id_or_alias(self, id_or_alias: str) -> User | None:
        user = await self.get_by_id(id_or_alias)
        if user:
            return user
        alias_map = {
            "usr_patricia": "patricia@pcnadvogadas.pt",
            "usr_ines": "ines@pcnadvogadas.pt",
            "usr_sofia": "sofia@pcnadvogadas.pt",
        }
        target_email = alias_map.get(id_or_alias)
        if target_email:
            return await self.get_by_email(target_email)
        return None


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(RefreshToken, session)

    async def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        result = await self.session.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def revoke_family(self, family_id: str, revoked_at: datetime) -> int:
        result = await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=revoked_at)
        )
        return result.rowcount

    async def revoke_all_for_user(self, user_id: str, revoked_at: datetime) -> int:
        """Ends every session of a user (password change, suspension, MFA reset)."""
        result = await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=revoked_at)
        )
        return result.rowcount
