"""Email notification service for task overtime (1h+) and deadline alerts."""

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from pcn.core.config import Settings, get_settings
from pcn.core.errors import NotFound
from pcn.domain.enums import AuditAction
from pcn.models.audit_log import AuditLog
from pcn.models.user import User
from pcn.repositories.task_repository import TaskRepository

logger = logging.getLogger("pcn")


def _format_hms(seconds: int) -> str:
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def _send_smtp_sync(
    settings: Settings,
    recipients: list[str],
    subject: str,
    plain_body: str,
    html_body: str,
) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = ", ".join(recipients)
    msg.set_content(plain_body)
    msg.add_alternative(html_body, subtype="html")

    if settings.SMTP_PORT == 465:
        with smtplib.SMTP_SSL(settings.SMTP_HOST or "", settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP(settings.SMTP_HOST or "", settings.SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)


class EmailNotificationService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.task_repo = TaskRepository(session)

    async def send_task_overtime_alert(
        self,
        actor: User,
        task_id: str,
        duration_seconds: int | None = None,
        recipient_email: str | None = None,
    ) -> dict[str, Any]:
        task = await self.task_repo.get_by_id_with_relations(task_id)
        if not task:
            raise NotFound("Tarefa não encontrada.")

        effective_seconds = duration_seconds if duration_seconds is not None else task.total_duration_seconds
        formatted_duration = _format_hms(max(effective_seconds, 3600))
        hours_reached = max(1, effective_seconds // 3600)

        recipients: list[str] = []
        if recipient_email and recipient_email.strip():
            recipients.append(recipient_email.strip())
        if actor.email and actor.email not in recipients:
            recipients.append(actor.email)
        if task.assignee and task.assignee.email and task.assignee.email not in recipients:
            recipients.append(task.assignee.email)

        client_name = task.client.name if task.client else "Cliente"
        lawyer_name = task.assignee.name if task.assignee else actor.name
        due_str = task.due_date.strftime("%d/%m/%Y") if task.due_date else "Sem prazo fixado"

        subject = f"[PCN Advogadas] Alerta de Tarefa em Andamento ({hours_reached}h+) — {task.title}"
        plain_body = (
            f"PCN Advogadas — Alerta Operacional de Controlo de Tempo\n\n"
            f"A tarefa jurídica abaixo encontra-se com o cronómetro 'Em Andamento' há pelo menos {hours_reached} hora(s):\n\n"
            f"• Tarefa: {task.title}\n"
            f"• Cliente: {client_name}\n"
            f"• Advogada Responsável: {lawyer_name}\n"
            f"• Tempo Acumulado: {formatted_duration}\n"
            f"• Data Limite / Prazo: {due_str}\n\n"
            f"Por favor, verifique na plataforma PCN Advogadas se pretende manter a tarefa em execução, "
            f"colocá-la na coluna 'Pausadas' ou concluí-la.\n"
        )
        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ECE6DB; border-radius: 10px; overflow: hidden;">
          <div style="background: #92006F; color: #FFFFFF; padding: 16px 24px;">
            <h2 style="margin: 0; font-size: 16px;">PCN Advogadas · Alerta de Tarefa em Andamento ({hours_reached}h+)</h2>
          </div>
          <div style="padding: 20px 24px; background: #FAF8F5; color: #222222; font-size: 14px; line-height: 1.6;">
            <p>A seguinte tarefa atingiu <strong>{hours_reached} hora(s)</strong> em andamento:</p>
            <table style="width: 100%; border-collapse: collapse; background: #FFFFFF; border: 1px solid #E5DECF; border-radius: 6px;">
              <tr><td style="padding: 8px 12px; color: #666;">Tarefa:</td><td style="padding: 8px 12px; font-weight: bold;">{task.title}</td></tr>
              <tr><td style="padding: 8px 12px; color: #666;">Cliente:</td><td style="padding: 8px 12px; font-weight: bold;">{client_name}</td></tr>
              <tr><td style="padding: 8px 12px; color: #666;">Advogada:</td><td style="padding: 8px 12px;">{lawyer_name}</td></tr>
              <tr><td style="padding: 8px 12px; color: #666;">Tempo Acumulado:</td><td style="padding: 8px 12px; font-family: monospace; font-weight: bold; color: #92006F;">{formatted_duration}</td></tr>
              <tr><td style="padding: 8px 12px; color: #666;">Prazo:</td><td style="padding: 8px 12px;">{due_str}</td></tr>
            </table>
            <p style="margin-top: 16px; font-size: 12px; color: #555;">
              Verifique na plataforma se o cronómetro deve continuar ativo ou se a tarefa deve ser movida para a coluna <strong>Pausadas</strong>.
            </p>
          </div>
        </div>
        """

        sent = False
        method = "audit_logged"
        error_detail: str | None = None

        if self.settings.RESEND_API_KEY and recipients:
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {self.settings.RESEND_API_KEY}"},
                        json={
                            "from": self.settings.SMTP_FROM,
                            "to": recipients,
                            "subject": subject,
                            "html": html_body,
                            "text": plain_body,
                        },
                    )
                    if resp.status_code in (200, 201):
                        sent = True
                        method = "resend_api"
                    else:
                        error_detail = resp.text
            except Exception as exc:
                error_detail = str(exc)
                logger.warning("Falha ao enviar email via Resend: %s", exc)

        if not sent and self.settings.SMTP_HOST and recipients:
            try:
                await asyncio.to_thread(
                    _send_smtp_sync,
                    self.settings,
                    recipients,
                    subject,
                    plain_body,
                    html_body,
                )
                sent = True
                method = "smtp"
            except Exception as exc:
                error_detail = str(exc)
                logger.warning("Falha ao enviar email via SMTP: %s", exc)

        self.session.add(
            AuditLog(
                actor_id=actor.id,
                action=AuditAction.TASK_TRANSITION,
                entity="task",
                entity_id=task.id,
                metadata_json=(
                    f"overtime_alert:{hours_reached}h|duration={formatted_duration}"
                    f"|recipients={','.join(recipients)}|sent={sent}|method={method}"
                ),
            )
        )
        await self.session.commit()

        return {
            "sent": sent,
            "method": method,
            "recipients": recipients,
            "subject": subject,
            "body": plain_body,
            "duration_formatted": formatted_duration,
            "hours_reached": hours_reached,
            "error_detail": error_detail,
        }
