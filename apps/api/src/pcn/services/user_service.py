"""User administration service (closed provisioning by Admin/Managing Partner)."""

from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from pcn.core.errors import Conflict, NotFound
from pcn.core.security import generate_temporary_password, hash_password
from pcn.domain.enums import AuditAction
from pcn.models.audit_log import AuditLog
from pcn.models.user import User
from pcn.repositories.user_repository import UserRepository
from pcn.schemas.user import UserCreate, UserCreateResponse, UserUpdate


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repo = UserRepository(session)

    async def _audit(
        self, action: AuditAction, actor_id: str, target_user_id: str, meta: str | None = None
    ) -> None:
        self.session.add(
            AuditLog(
                actor_id=actor_id,
                action=action,
                entity="user",
                entity_id=target_user_id,
                metadata_json=meta,
            )
        )

    async def create_lawyer_account(self, admin_user: User, data: UserCreate) -> UserCreateResponse:
        """Admin creates a new lawyer account with a secure temporary password."""
        existing = await self.user_repo.get_by_email(data.email)
        if existing:
            raise Conflict(
                "Já existe uma utilizadora registada com este endereço de correio eletrónico."
            )

        temp_password = data.password.strip() if data.password else generate_temporary_password()
        hashed = hash_password(temp_password)

        new_user = User(
            name=data.name.strip(),
            email=data.email.strip().lower(),
            password_hash=hashed,
            role=data.role,
            must_change_password=data.must_change_password,
            is_totp_enabled=False,
            is_active=True,
        )
        await self.user_repo.add(new_user)
        await self.session.flush()

        await self._audit(AuditAction.USER_CREATED, admin_user.id, new_user.id)
        await self.session.commit()

        return UserCreateResponse(
            id=new_user.id,
            name=new_user.name,
            email=new_user.email,
            role=new_user.role,
            temporary_password=temp_password,
        )

    async def list_users(self) -> Sequence[User]:
        return await self.user_repo.list_all()

    async def update_user(self, admin_user: User, user_id: str, data: UserUpdate) -> User:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFound("Utilizadora não encontrada.")

        if data.name is not None:
            user.name = data.name.strip()
        if data.role is not None:
            user.role = data.role
        if data.is_active is not None:
            user.is_active = data.is_active

        await self._audit(AuditAction.USER_UPDATED, admin_user.id, user.id)
        await self.session.commit()
        return user

    async def reset_password(self, admin_user: User, user_id: str) -> str:
        """Admin resets a lawyer's password and generates a new temporary one."""
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFound("Utilizadora não encontrada.")

        temp_password = generate_temporary_password()
        user.password_hash = hash_password(temp_password)
        user.must_change_password = True
        user.failed_login_attempts = 0
        user.locked_until = None

        await self._audit(AuditAction.USER_PASSWORD_RESET, admin_user.id, user.id)
        await self.session.commit()
        return temp_password

    async def reset_mfa(self, admin_user: User, user_id: str) -> None:
        """Admin resets 2FA for a user who lost their authenticator device."""
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFound("Utilizadora não encontrada.")

        user.is_totp_enabled = False
        user.totp_secret_enc = None
        user.totp_last_step = None

        await self._audit(AuditAction.USER_MFA_RESET, admin_user.id, user.id)
        await self.session.commit()
