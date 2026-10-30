"""User administration service (closed provisioning by Admin/Managing Partner)."""

from collections.abc import Sequence

from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.core.clock import system_clock
from pcn.core.errors import Conflict, NotFound, PermissionDenied
from pcn.core.security import (
    generate_temporary_password,
    hash_password,
    validate_password_policy,
)
from pcn.domain.enums import ADMIN_ROLES, AuditAction, UserRole
from pcn.models.audit_log import AuditLog
from pcn.models.task import Task
from pcn.models.task_time_session import TaskTimeSession
from pcn.models.user import RefreshToken, User
from pcn.repositories.user_repository import RefreshTokenRepository, UserRepository
from pcn.schemas.user import UserCreate, UserCreateResponse, UserUpdate


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repo = UserRepository(session)
        self.refresh_repo = RefreshTokenRepository(session)

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

    # ── Hierarchy rules ──
    # Master (IT) manages everyone. Direção (admin) manages lawyers and non-master admins.

    @staticmethod
    def _ensure_can_manage(actor: User, target: User) -> None:
        if actor.role == UserRole.MASTER:
            return
        if target.role in ADMIN_ROLES and target.id != actor.id:
            raise PermissionDenied(
                "Apenas a equipa de TI (Master) pode gerir contas da Direção ou de TI."
            )

    @staticmethod
    def _ensure_can_assign_role(actor: User, role: UserRole) -> None:
        if role == UserRole.MASTER and actor.role != UserRole.MASTER:
            raise PermissionDenied("Apenas a equipa de TI (Master) pode atribuir o perfil Master.")

    async def _get_target(self, actor: User, user_id: str) -> User:
        user = await self.user_repo.get_by_id_or_alias(user_id)
        if not user:
            raise NotFound("Utilizadora não encontrada.")
        self._ensure_can_manage(actor, user)
        return user

    async def _end_sessions(self, user: User) -> None:
        await self.refresh_repo.revoke_all_for_user(user.id, revoked_at=system_clock.now())

    async def create_lawyer_account(self, admin_user: User, data: UserCreate) -> UserCreateResponse:
        """Admin creates a new account with a password (direct login enabled)."""
        self._ensure_can_assign_role(admin_user, data.role)
        existing = await self.user_repo.get_by_email(data.email)
        if existing:
            raise Conflict(
                "Já existe uma utilizadora registada com este endereço de correio eletrónico."
            )

        if data.password:
            validate_password_policy(data.password)
            temp_password = data.password
        else:
            temp_password = generate_temporary_password()

        new_user = User(
            name=data.name.strip(),
            email=data.email.strip().lower(),
            password_hash=hash_password(temp_password),
            role=data.role,
            must_change_password=False,
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

    async def update_user(self, actor: User, user_id: str, data: UserUpdate) -> User:
        user = await self._get_target(actor, user_id)
        is_self = user.id == actor.id

        if data.name is not None:
            user.name = data.name.strip()

        if data.email is not None:
            clean_email = data.email.strip().lower()
            if clean_email != user.email:
                existing = await self.user_repo.get_by_email(clean_email)
                if existing and existing.id != user.id:
                    raise Conflict(
                        "Já existe outra utilizadora registada com este endereço de correio eletrónico."
                    )
                user.email = clean_email

        if data.role is not None and data.role != user.role:
            if is_self and actor.role not in ADMIN_ROLES:
                raise PermissionDenied("Não pode alterar o perfil da sua própria conta.")
            self._ensure_can_assign_role(actor, data.role)
            await self._audit(
                AuditAction.USER_ROLE_CHANGED,
                actor.id,
                user.id,
                f"{user.role.value}->{data.role.value}",
            )
            user.role = data.role
            await self._end_sessions(user)

        if data.is_active is not None and data.is_active != user.is_active:
            if is_self:
                raise PermissionDenied("Não pode suspender a sua própria conta.")
            user.is_active = data.is_active
            if data.is_active:
                await self._audit(AuditAction.USER_REACTIVATED, actor.id, user.id)
            else:
                await self._end_sessions(user)
                await self._audit(AuditAction.USER_SUSPENDED, actor.id, user.id)

        if data.password:
            validate_password_policy(data.password)
            user.password_hash = hash_password(data.password)
            user.must_change_password = False
            user.failed_login_attempts = 0
            user.locked_until = None
            if not is_self:
                await self._end_sessions(user)
            await self._audit(AuditAction.USER_PASSWORD_RESET, actor.id, user.id)
        elif data.must_change_password is not None:
            user.must_change_password = data.must_change_password

        await self._audit(AuditAction.USER_UPDATED, actor.id, user.id)
        await self.session.commit()
        return user

    async def delete_user(self, admin_user: User, user_id: str) -> None:
        """Permanently deletes a user account and unlinks any assigned/created tasks."""
        user = await self._get_target(admin_user, user_id)
        if user.id == admin_user.id:
            raise PermissionDenied("Não pode eliminar a sua própria conta em sessão ativa.")

        target_id = user.id
        target_email = user.email

        # Reassign created_by to admin_user so tasks are preserved, and unassign assigned_to
        await self.session.execute(
            update(Task).where(Task.created_by == target_id).values(created_by=admin_user.id)
        )
        await self.session.execute(
            update(Task).where(Task.assigned_to == target_id).values(assigned_to=None)
        )
        await self.session.execute(
            delete(TaskTimeSession).where(TaskTimeSession.user_id == target_id)
        )
        await self.session.execute(delete(RefreshToken).where(RefreshToken.user_id == target_id))

        await self.user_repo.delete(user)
        await self._audit(
            AuditAction.USER_SUSPENDED,
            admin_user.id,
            target_id,
            f"deleted:{target_email}",
        )
        await self.session.commit()

    async def unlock_user(self, admin_user: User, user_id: str) -> User:
        """Clears a brute-force lockout before the timer runs out."""
        user = await self._get_target(admin_user, user_id)
        user.failed_login_attempts = 0
        user.locked_until = None
        await self._audit(AuditAction.USER_UNLOCKED, admin_user.id, user.id)
        await self.session.commit()
        return user

    async def reset_password(self, admin_user: User, user_id: str) -> str:
        """Admin resets a password and generates a new password."""
        user = await self._get_target(admin_user, user_id)
        if user.id == admin_user.id:
            raise PermissionDenied("Para a sua conta use a opção de alterar palavra-passe.")

        temp_password = generate_temporary_password()
        user.password_hash = hash_password(temp_password)
        user.must_change_password = False
        user.failed_login_attempts = 0
        user.locked_until = None
        await self._end_sessions(user)

        await self._audit(AuditAction.USER_PASSWORD_RESET, admin_user.id, user.id)
        await self.session.commit()
        return temp_password

    async def reset_mfa(self, admin_user: User, user_id: str) -> None:
        """Admin resets 2FA for a user."""
        user = await self._get_target(admin_user, user_id)
        if user.id == admin_user.id:
            raise PermissionDenied("Não pode repor o 2FA da sua própria conta.")

        user.is_totp_enabled = False
        user.totp_secret_enc = None
        user.totp_last_step = None
        await self._end_sessions(user)

        await self._audit(AuditAction.USER_MFA_RESET, admin_user.id, user.id)
        await self.session.commit()
