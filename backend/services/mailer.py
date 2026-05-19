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


ROLE_DISPLAY = {
    "RECRUITER": "Recruiter / HR",
    "HIRING_MANAGER": "Hiring Manager",
}


def build_staff_invitation_email(
    *,
    first_name: str,
    invite_link: str,
    role: str,
    company_name: str,
    invited_by: str,
    expires_days: int = 3,
) -> tuple[str, str, str]:
    """Return (subject, plain text body, html body) for staff invitation."""
    role_label = ROLE_DISPLAY.get(role, role.replace("_", " ").title())
    app = settings.APP_NAME

    subject = f"You're invited to join {company_name} on {app}"

    body = (
        f"Hello {first_name},\n\n"
        f"{invited_by} invited you to join {company_name} on {app} as {role_label}.\n\n"
        f"Activate your account and set your password (link expires in {expires_days} days):\n"
        f"{invite_link}\n\n"
        f"If you did not expect this invitation, you can ignore this email.\n\n"
        f"Best regards,\n{app}"
    )

    html_body = f"""<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;">
    <motion.div style="background:linear-gradient(135deg,#7B5AC8,#9683EC);padding:28px 30px;border-radius:12px 12px 0 0;">
        <h1 style="color:white;margin:0;font-size:22px;">Talent<span style="color:#f97316;">Os</span></h1>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">Staff invitation</p>
    </motion.div>
    <motion.div style="padding:28px 30px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <p style="margin:0 0 16px;color:#374151;">Hello <strong>{first_name}</strong>,</p>
        <p style="margin:0 0 16px;color:#374151;line-height:1.6;">
            <strong>{invited_by}</strong> invited you to join <strong>{company_name}</strong>
            as <strong>{role_label}</strong>.
        </p>
        <p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.5;">
            Click the button below to set your password and activate your account.
            This link expires in <strong>{expires_days} days</strong>.
        </p>
        <motion.div style="text-align:center;margin:24px 0;">
            <a href="{invite_link}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7B5AC8,#9683EC);color:#fff;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;">
                Activate my account
            </a>
        </motion.div>
        <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;word-break:break-all;">
            Or copy this link:<br/><a href="{invite_link}" style="color:#7c3aed;">{invite_link}</a>
        </p>
        <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;"/>
        <p style="color:#9ca3af;font-size:12px;margin:0;">If you did not expect this email, you can safely ignore it.</p>
    </motion.div>
    </body></html>"""

    return subject, body, html_body.replace("<motion.div", "<div").replace("</motion.div>", "</div>")


def send_staff_invitation_email(
    to_email: str,
    *,
    first_name: str,
    invite_link: str,
    role: str,
    company_name: str,
    invited_by: str,
    expires_days: int = 3,
) -> bool:
    subject, body, html = build_staff_invitation_email(
        first_name=first_name,
        invite_link=invite_link,
        role=role,
        company_name=company_name,
        invited_by=invited_by,
        expires_days=expires_days,
    )
    return send_email(to_email, subject, body, html=html)
