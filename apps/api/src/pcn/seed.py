"""Database seeder with initial PCN Advogadas data for live interactive testing."""

import asyncio
from datetime import datetime

from sqlalchemy import select

from pcn.core.database import get_session_factory
from pcn.core.security import hash_password
from pcn.domain.enums import FeeNoteStatus, TaskStatus, UserRole
from pcn.models.base import Base
from pcn.models.client import Client, TaskType
from pcn.models.fee_note import FeeNote, FeeNoteItem
from pcn.models.task import Task
from pcn.models.user import User


async def run_seed() -> None:
    session_factory = get_session_factory()
    engine = session_factory.kw["bind"]

    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        # 1. Utilizadoras
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
                    must_change_password=False,
                    is_totp_enabled=False,
                    is_active=True,
                )
                session.add(u)
            else:
                u.password_hash = hash_password("Advogada2026!")
                u.is_active = True
                u.failed_login_attempts = 0
                u.locked_until = None
            created_users[uid] = u

        # 2. Tipos de Tarefa
        types_data = [
            ("tp_1", "Certidões e Registos", "#92006F"),
            ("tp_2", "Peças Processuais", "#5E0047"),
            ("tp_3", "Consultoria e Reuniões", "#D4AF37"),
            ("tp_4", "Audiências e Julgamentos", "#2B2B2B"),
        ]
        created_types = {}
        for tid, name, color in types_data:
            existing = await session.execute(select(TaskType).where(TaskType.name == name))
            tt = existing.scalar_one_or_none()
            if not tt:
                tt = TaskType(id=tid, name=name, color=color, default_billable=True)
                session.add(tt)
            created_types[name] = tt

        # 3. Clientes
        clients_data = [
            ("cli_1", "Cliente A", "501234567", "Proc. 142/26.8T8LSB", "contacto@clientea.pt"),
            ("cli_2", "Cliente B (Sociedade Imobiliária)", "509876543", "Proc. 890/26.1T8OVR", "geral@imobiliaria.pt"),
        ]
        for cid, name, nif, proc, email in clients_data:
            existing = await session.execute(select(Client).where(Client.name == name))
            if not existing.scalar_one_or_none():
                session.add(
                    Client(id=cid, name=name, nif=nif, process_reference=proc, email=email)
                )

        await session.flush()

        # 4. Tarefas
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

        await session.flush()

        # 5. Nota de Honorários Inicial (NH-2026-0001)
        existing_fn = await session.execute(select(FeeNote).where(FeeNote.reference_code == "NH-2026-0001"))
        if not existing_fn.scalar_one_or_none():
            from decimal import Decimal
            subtotal = Decimal("335.00")
            vat = subtotal * Decimal("0.23")
            withholding = subtotal * Decimal("0.23")
            fn = FeeNote(
                id="fn_seed_001",
                client_id="cli_1",
                reference_code="NH-2026-0001",
                status=FeeNoteStatus.DRAFT,
                subtotal=subtotal,
                vat_rate=Decimal("0.2300"),
                vat_amount=vat,
                withholding_rate=Decimal("0.2300"),
                withholding_amount=withholding,
                total=subtotal,
                notes="Processo n.º 142/26.8T8LSB - Honorários relativos a Consultoria Forense",
            )
            session.add(fn)
            await session.flush()

            item1 = FeeNoteItem(
                id="fni_1",
                fee_note_id="fn_seed_001",
                task_id="tsk_4",
                date=datetime.utcnow(),
                description="Análise de autos e consulta jurídica forense",
                lawyer_name="Dr.ª Inês",
                duration_seconds=9000,
                amount=Decimal("250.00"),
                position=1,
            )
            item2 = FeeNoteItem(
                id="fni_2",
                fee_note_id="fn_seed_001",
                task_id="tsk_1",
                date=datetime.utcnow(),
                description="Registo predial e pedido de certidão",
                lawyer_name="Dr.ª Inês",
                duration_seconds=2700,
                amount=Decimal("85.00"),
                position=2,
            )
            session.add_all([item1, item2])

        await session.commit()
        print("[+] Base de dados inicializada e semeada com sucesso!")


if __name__ == "__main__":
    asyncio.run(run_seed())

