"""Client and TaskType endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.api.deps import require_admin, require_full_access
from pcn.core.database import get_session
from pcn.core.errors import Conflict, NotFound
from pcn.models.client import Client, TaskType
from pcn.models.user import User
from pcn.repositories.client_repository import ClientRepository, TaskTypeRepository
from pcn.schemas.client import (
    ClientCreate,
    ClientRead,
    ClientUpdate,
    TaskTypeCreate,
    TaskTypeRead,
    TaskTypeUpdate,
)

router = APIRouter(tags=["Clientes e Tipos de Tarefa"])


# ── Clientes ──


@router.get("/clients", response_model=list[ClientRead])
async def list_clients(
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
    q: str | None = Query(None, description="Pesquisa por nome ou processo"),
) -> list[ClientRead]:
    repo = ClientRepository(session)
    if q:
        clients = await repo.search(q)
    else:
        clients = await repo.list_all()
    return [ClientRead.model_validate(c) for c in clients]


@router.post("/clients", response_model=ClientRead, status_code=status.HTTP_201_CREATED)
async def create_client(
    body: ClientCreate,
    user: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ClientRead:
    repo = ClientRepository(session)
    if body.nif:
        existing = await repo.get_by_nif(body.nif)
        if existing:
            raise Conflict("Já existe um cliente registado com este NIF.")

    client = Client(
        name=body.name.strip(),
        nif=body.nif,
        email=body.email,
        phone=body.phone,
        process_reference=body.process_reference,
        notes=body.notes,
    )
    await repo.add(client)
    await session.commit()
    return ClientRead.model_validate(client)


@router.get("/clients/{client_id}", response_model=ClientRead)
async def get_client(
    client_id: str,
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ClientRead:
    repo = ClientRepository(session)
    client = await repo.get_by_id(client_id)
    if not client:
        raise NotFound("Cliente não encontrado.")
    return ClientRead.model_validate(client)


@router.patch("/clients/{client_id}", response_model=ClientRead)
async def update_client(
    client_id: str,
    body: ClientUpdate,
    user: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ClientRead:
    repo = ClientRepository(session)
    client = await repo.get_by_id(client_id)
    if not client:
        raise NotFound("Cliente não encontrado.")

    if body.name is not None:
        client.name = body.name.strip()
    if body.nif is not None:
        client.nif = body.nif
    if body.email is not None:
        client.email = body.email
    if body.phone is not None:
        client.phone = body.phone
    if body.process_reference is not None:
        client.process_reference = body.process_reference
    if body.notes is not None:
        client.notes = body.notes
    if body.is_active is not None:
        client.is_active = body.is_active

    await session.commit()
    return ClientRead.model_validate(client)


# ── Tipos de Tarefa / Categorias de Serviços (CRUD Admin) ──


@router.get("/task-types", response_model=list[TaskTypeRead])
async def list_task_types(
    user: Annotated[User, Depends(require_full_access)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[TaskTypeRead]:
    repo = TaskTypeRepository(session)
    types = await repo.list_all()
    return [TaskTypeRead.model_validate(t) for t in types]


@router.post("/task-types", response_model=TaskTypeRead, status_code=status.HTTP_201_CREATED)
async def create_task_type(
    body: TaskTypeCreate,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskTypeRead:
    repo = TaskTypeRepository(session)
    existing = await repo.get_by_name(body.name.strip())
    if existing:
        raise Conflict("Já existe uma categoria de serviço com este nome.")

    task_type = TaskType(
        name=body.name.strip(),
        description=body.description,
        hourly_rate=body.hourly_rate,
        default_billable=body.default_billable,
        color=body.color,
    )
    await repo.add(task_type)
    await session.commit()
    return TaskTypeRead.model_validate(task_type)


@router.patch("/task-types/{type_id}", response_model=TaskTypeRead)
async def update_task_type(
    type_id: str,
    body: TaskTypeUpdate,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskTypeRead:
    repo = TaskTypeRepository(session)
    task_type = await repo.get_by_id(type_id)
    if not task_type:
        raise NotFound("Categoria de serviço não encontrada.")

    if body.name is not None:
        clean_name = body.name.strip()
        if clean_name != task_type.name:
            existing = await repo.get_by_name(clean_name)
            if existing and existing.id != type_id:
                raise Conflict("Já existe outra categoria de serviço com este nome.")
        task_type.name = clean_name
    if body.description is not None:
        task_type.description = body.description
    if body.hourly_rate is not None:
        task_type.hourly_rate = body.hourly_rate
    if body.default_billable is not None:
        task_type.default_billable = body.default_billable
    if body.color is not None:
        task_type.color = body.color

    await session.commit()
    return TaskTypeRead.model_validate(task_type)


@router.delete("/task-types/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_type(
    type_id: str,
    admin: Annotated[User, Depends(require_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    repo = TaskTypeRepository(session)
    task_type = await repo.get_by_id(type_id)
    if not task_type:
        raise NotFound("Categoria de serviço não encontrada.")
    await repo.delete(task_type)
    await session.commit()
