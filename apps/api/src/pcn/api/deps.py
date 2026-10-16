"""FastAPI dependencies for authentication, RBAC, and database sessions."""

from typing import Annotated

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.core.config import Settings, get_settings
from pcn.core.database import get_session
from pcn.core.errors import TokenError
from pcn.core.security import JwtService, TokenClaims, TokenScope, TokenType
from pcn.domain.enums import UserRole
from pcn.models.user import User
from pcn.repositories.user_repository import UserRepository

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> TokenClaims:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais de autenticação em falta.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    jwt_svc = JwtService(settings)
    try:
        return jwt_svc.decode(credentials.credentials, expected=TokenType.ACCESS)
    except TokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None


async def get_current_user(
    claims: Annotated[TokenClaims, Depends(get_current_claims)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> User:
    repo = UserRepository(session)
    user = await repo.get_by_id(claims.subject)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilizador inativo ou não encontrado.",
        )
    return user


async def require_full_access(
    claims: Annotated[TokenClaims, Depends(get_current_claims)],
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Blocks any user who still has pending mandatory setup (password change or 2FA)."""
    if claims.scope == TokenScope.SETUP or user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="É obrigatório alterar a palavra-passe provisória e configurar o 2FA antes de prosseguir.",
        )
    return user


async def require_admin(
    user: Annotated[User, Depends(require_full_access)],
) -> User:
    """Restricts route to Managing Partner (Dr.ª Patrícia / admin_lawyer)."""
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso reservado exclusivamente à Direção do escritório.",
        )
    return user
