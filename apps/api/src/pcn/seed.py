"""Database seeder with initial PCN Advogadas data and cleaner utility."""

import asyncio
from datetime import datetime
from decimal import Decimal

from sqlalchemy import delete, select

import pcn.models
from pcn.core.database import get_session_factory
from pcn.core.security import hash_password
from pcn.domain.enums import FeeNoteStatus, TaskStatus, UserRole
from pcn.models import (
    AuditLog,
    Base,
    Client,
    Event,
    FeeNote,
    FeeNoteItem,
    RefreshToken,
    Task,
    TaskTimeSession,
    TaskType,
    User,
)


async def clear_demo_data() -> None:
    """Elimina clientes, tarefas, sessões de tempo e notas de demonstração.
    Preserva intactos: os utilizadores (advogadas) e os tipos de tarefas forenses."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        await session.execute(delete(FeeNoteItem))
        await session.execute(delete(FeeNote))
        await session.execute(delete(TaskTimeSession))
        await session.execute(delete(Task))
        await session.execute(delete(Client))
        await session.commit()
    print("[+] Dados de teste (clientes, tarefas, sessões e notas) eliminados com sucesso!")


async def run_seed(include_demo_data: bool = False) -> None:
    """Garante tabelas criadas e povoa apenas dados essenciais de produção.
    Só inclui dados fictícios de demonstração se include_demo_data=True."""
    session_factory = get_session_factory()
    engine = session_factory.kw["bind"]

    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        # 1. Utilizadoras Essenciais da Sociedade
        users_data = [
            ("usr_patricia", "Dr.ª Patrícia", "patricia@pcnadvogadas.pt", UserRole.ADMIN),
            ("usr_ines", "Dr.ª Inês", "ines@pcnadvogadas.pt", UserRole.LAWYER),
            ("usr_sofia", "Dr.ª Sofia", "sofia@pcnadvogadas.pt", UserRole.LAWYER),
        ]

        created_users = {}
        for uid, name, email, role in users_data:
            existing = await session.execute(select(User).where(User.email == email))
            u = existing.scalar_one_or_none()
            if not u:
                u = User(
                    id=uid,
                    name=name,
                    email=email,
                    password_hash=hash_password("Advogada2026!"),
                    role=role,
                    must_change_password=True,
                    is_totp_enabled=False,
                    is_active=True,
                )
                session.add(u)
            else:
                u.is_active = True
                u.failed_login_attempts = 0
                u.locked_until = None
            created_users[uid] = u

        # 2. Tipos de Tarefa Oficiais do Escritório
        types_data = [
            ("tp_1", "Certidões e Registos", "#92006F"),
            ("tp_2", "Peças Processuais", "#5E0047"),
            ("tp_3", "Consultoria e Reuniões", "#D4AF37"),
            ("tp_4", "Audiências e Julgamentos", "#2B2B2B"),
            ("tp_5", "Análise Documental", "#7A005D"),
        ]
        created_types = {}
        for tid, name, color in types_data:
            existing = await session.execute(select(TaskType).where(TaskType.name == name))
            tt = existing.scalar_one_or_none()
            if not tt:
                tt = TaskType(id=tid, name=name, color=color, default_billable=True)
                session.add(tt)
            created_types[name] = tt

        await session.commit()

        # 3. Se explicitamente solicitado para testes locais, adiciona dados fictícios
        if include_demo_data:
            clients_data = [
                ("cli_1", "Cliente A", "501234567", "Proc. 142/26.8T8LSB", "contacto@clientea.pt"),
                ("cli_2", "Cliente B (Sociedade Imobiliária)", "509876543", "Proc. 890/26.1T8OVR", "geral@imobiliaria.pt"),
            ]
            for cid, name, nif, proc, email in clients_data:
                existing = await session.execute(select(Client).where(Client.name == name))
                if not existing.scalar_one_or_none():
                    session.add(Client(id=cid, name=name, nif=nif, process_reference=proc, email=email))

            await session.flush()

            tasks_data = [
                ("tsk_1", "cli_1", "Certidões e Registos", "Registo predial", TaskStatus.ASSIGNED, "usr_ines", 2700, 85.0),
                ("tsk_2", "cli_2", "Certidões e Registos", "Emitir certidão negativa de dívidas tributárias", TaskStatus.POOL, None, 0, None),
                ("tsk_3", "cli_1", "Peças Processuais", "Redação de Contestação Cível", TaskStatus.IN_PROGRESS, "usr_ines", 4800, 350.0),
                ("tsk_4", "cli_1", "Consultoria e Reuniões", "Análise de autos e consulta jurídica", TaskStatus.COMPLETED, "usr_ines", 9000, 250.0),
            ]

            for tid, cid, tname, title, status, lawyer_id, duration, fee in tasks_data:
                existing = await session.execute(select(Task).where(Task.title == title))
                if not existing.scalar_one_or_none():
                    tt = created_types[tname]
                    task = Task(
                        id=tid,
                        client_id=cid,
                        task_type_id=tt.id,
                        title=title,
                        status=status,
                        created_by="usr_patricia",
                        assigned_to=lawyer_id,
                        total_duration_seconds=duration,
                        fee_amount=fee,
                        completed_at=datetime.utcnow() if status == TaskStatus.COMPLETED else None,
                    )
                    session.add(task)

            await session.commit()

    print("[+] Base de dados inicializada com utilizadoras e categorias da PCN Advogadas.")


if __name__ == "__main__":
    asyncio.run(run_seed(include_demo_data=False))
