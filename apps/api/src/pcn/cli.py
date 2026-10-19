"""CLI utilities for database seeding and initial admin creation."""

import argparse
import asyncio
import sys

from sqlalchemy import select

from pcn.core.database import get_session_factory
from pcn.core.security import generate_temporary_password, hash_password
from pcn.domain.enums import UserRole
from pcn.models.client import TaskType
from pcn.models.user import User


async def create_admin(name: str, email: str) -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        result = await session.execute(select(User).where(User.email == email.strip().lower()))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"[!] Erro: Já existe uma conta com o email {email}")
            sys.exit(1)

        temp_password = generate_temporary_password()
        hashed = hash_password(temp_password)

        admin = User(
            name=name.strip(),
            email=email.strip().lower(),
            password_hash=hashed,
            role=UserRole.ADMIN,
            must_change_password=True,
            is_totp_enabled=False,
            is_active=True,
        )
        session.add(admin)
        await session.commit()

        print("\n" + "=" * 50)
        print("Conta de Direção Criada com Sucesso (PCN Advogadas)")
        print("=" * 50)
        print(f"Nome:               {name}")
        print(f"Email:              {email}")
        print(f"Senha Provisória:   {temp_password}")
        print("=" * 50)
        print("No primeiro login ser-lhe-á exigido alterar a palavra-passe e ativar o 2FA.\n")


async def set_role(email: str, role: str) -> None:
    """Changes a user's role from the server shell (e.g. promote IT to master)."""
    target_role = UserRole(role)
    session_factory = get_session_factory()
    async with session_factory() as session:
        result = await session.execute(select(User).where(User.email == email.strip().lower()))
        user = result.scalar_one_or_none()
        if not user:
            print(f"[!] Erro: Nenhuma conta com o email {email}")
            sys.exit(1)
        user.role = target_role
        await session.commit()
        print(f"[+] {user.email} agora tem o perfil '{target_role.value}'.")


async def seed_task_types() -> None:
    default_types = [
        {
            "name": "Certidões e Registos",
            "description": "Emissão de certidões prediais, comerciais e criminais",
            "color": "#92006F",
        },
        {
            "name": "Peças Processuais",
            "description": "Petições iniciais, contestações, alegações e recursos",
            "color": "#5E0047",
        },
        {
            "name": "Consultoria e Reuniões",
            "description": "Consultas com clientes e pareceres jurídicos",
            "color": "#D4AF37",
        },
        {
            "name": "Audiências e Julgamentos",
            "description": "Diligências em tribunal e inquirições",
            "color": "#2B2B2B",
        },
        {
            "name": "Análise Documental",
            "description": "Estudo de autos e revisão contratual",
            "color": "#7A005D",
        },
    ]

    session_factory = get_session_factory()
    async with session_factory() as session:
        for item in default_types:
            result = await session.execute(select(TaskType).where(TaskType.name == item["name"]))
            if not result.scalar_one_or_none():
                session.add(TaskType(**item))
        await session.commit()
        print("[+] Tipos de tarefa padrão semeados com sucesso.")


def main() -> None:
    parser = argparse.ArgumentParser(description="PCN Advogadas CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    admin_parser = subparsers.add_parser(
        "create-admin", help="Cria a conta da Advogada Principal / Admin"
    )
    admin_parser.add_argument("--name", default="Dr.ª Patrícia", help="Nome completo")
    admin_parser.add_argument("--email", required=True, help="Email institucional")

    subparsers.add_parser("seed-task-types", help="Semeia os tipos de tarefa jurídica padrão")

    role_parser = subparsers.add_parser("set-role", help="Altera o perfil de uma conta")
    role_parser.add_argument("--email", required=True)
    role_parser.add_argument("--role", required=True, choices=[r.value for r in UserRole])

    args = parser.parse_args()

    if args.command == "create-admin":
        asyncio.run(create_admin(args.name, args.email))
    elif args.command == "seed-task-types":
        asyncio.run(seed_task_types())
    elif args.command == "set-role":
        asyncio.run(set_role(args.email, args.role))


if __name__ == "__main__":
    main()
