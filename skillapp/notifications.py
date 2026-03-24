
"""
skillapp/notifications.py
──────────────────────────
Checks all users' documents for upcoming expiry dates and sends email alerts.

Run via management command:  python manage.py check_expiry
Or schedule with cron:       0 8 * * * /path/to/venv/bin/python manage.py check_expiry
"""

from datetime import date, timedelta
from django.core.mail import send_mail
from django.conf import settings
from .models import Document, User


# ── Notification thresholds (days before expiry) ──────────────────────────────
ALERT_DAYS = [30, 7, 1]   # send alerts at 30 days, 7 days, and 1 day before expiry


def get_expiring_documents(days_ahead: int):
    """Return all documents expiring exactly `days_ahead` days from today."""
    target_date = date.today() + timedelta(days=days_ahead)
    return Document.objects.filter(
        expiry_date=target_date
    ).select_related("owner")


def get_expired_documents():
    """Return all documents that expired today."""
    return Document.objects.filter(
        expiry_date=date.today() - timedelta(days=1)
    ).select_related("owner")


def send_expiry_alert(user: User, documents: list, days_ahead: int):
    """Send a single email to the user listing their expiring documents."""
    if not user.email:
        return

    if days_ahead == 0:
        subject = "⚠️ SkillShelf — Your documents expired today"
        urgency = "expired today"
    elif days_ahead == 1:
        subject = "🚨 SkillShelf — Documents expiring TOMORROW"
        urgency = "expiring tomorrow"
    elif days_ahead <= 7:
        subject = f"⚠️ SkillShelf — Documents expiring in {days_ahead} days"
        urgency = f"expiring in {days_ahead} days"
    else:
        subject = f"📋 SkillShelf — Documents expiring in {days_ahead} days"
        urgency = f"expiring in {days_ahead} days"

    doc_lines = "\n".join(
        f"  • {doc.title} ({doc.category_display}) — expires {doc.expiry_date}"
        for doc in documents
    )

    body = f"""Hi {user.full_name},

This is a reminder from SkillShelf that the following documents are {urgency}:

{doc_lines}

Please log in to SkillShelf to review or renew these documents before they expire.

{settings.SITE_URL}/dashboard/

— SkillShelf Team
"""

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        print(f"[notifications] Sent expiry alert to {user.email} ({len(documents)} doc(s), {days_ahead}d)")
    except Exception as e:
        print(f"[notifications] Failed to send to {user.email}: {e}")


def run_expiry_checks():
    """
    Main entry point — called by the management command.
    Checks all threshold days and sends grouped emails per user.
    Returns a summary dict.
    """
    summary = {"checked": 0, "emails_sent": 0, "errors": 0}

    for days in ALERT_DAYS:
        expiring = get_expiring_documents(days)

        # Group by user
        by_user: dict[int, list] = {}
        for doc in expiring:
            by_user.setdefault(doc.owner.id, {"user": doc.owner, "docs": []})
            by_user[doc.owner.id]["docs"].append(doc)
            summary["checked"] += 1

        # Send one email per user per threshold
        for entry in by_user.values():
            try:
                send_expiry_alert(entry["user"], entry["docs"], days)
                summary["emails_sent"] += 1
            except Exception as e:
                summary["errors"] += 1
                print(f"[notifications] Error: {e}")

    # Also notify about documents that expired yesterday (missed alerts)
    expired = get_expired_documents()
    by_user_expired: dict[int, list] = {}
    for doc in expired:
        by_user_expired.setdefault(doc.owner.id, {"user": doc.owner, "docs": []})
        by_user_expired[doc.owner.id]["docs"].append(doc)
        summary["checked"] += 1

    for entry in by_user_expired.values():
        try:
            send_expiry_alert(entry["user"], entry["docs"], 0)
            summary["emails_sent"] += 1
        except Exception as e:
            summary["errors"] += 1

    return summary