import smtplib
import logging
from typing import Optional
from email.message import EmailMessage
from core.config import settings

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, body: str, html: Optional[str] = None) -> bool:
    """
    Send an email using SMTP settings from config. Supports optional HTML body.
    Returns True on success, False otherwise. If SMTP settings are not configured,
    the function logs and returns False.
    """
    if not settings.SMTP_HOST:
        logger.info("SMTP not configured; skipping email send")
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM or "no-reply@localhost"
    msg["To"] = to_email
    # plain text fallback
    msg.set_content(body or "")

    # add HTML alternative when provided
    if html:
        try:
            msg.add_alternative(html, subtype="html")
        except Exception:
            logger.exception("Failed to attach HTML alternative to email; sending plain text only")

    try:
        port = int(settings.SMTP_PORT) if settings.SMTP_PORT else 587
        with smtplib.SMTP(settings.SMTP_HOST, port, timeout=10) as server:
            server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info(f"Email sent to {to_email} (subject={subject})")
        return True
    except Exception as e:
        logger.exception(f"Failed to send email to {to_email}: {e}")
        return False
