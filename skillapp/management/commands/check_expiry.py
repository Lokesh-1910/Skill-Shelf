
"""
skillapp/management/commands/check_expiry.py
─────────────────────────────────────────────
Django management command that triggers document expiry notifications.

Usage:
    python manage.py check_expiry

Schedule with cron (runs every day at 8 AM):
    0 8 * * * cd /path/to/project && /path/to/venv/bin/python manage.py check_expiry >> /var/log/skillshelf_expiry.log 2>&1

Schedule with Windows Task Scheduler:
    Action: python manage.py check_expiry
    Trigger: Daily at 8:00 AM
"""

from django.core.management.base import BaseCommand
from skillapp.notifications import run_expiry_checks


class Command(BaseCommand):
    help = "Check all user documents for expiry dates and send email alerts"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print which emails would be sent without actually sending them",
        )

    def handle(self, *args, **options):
        self.stdout.write("SkillShelf — running expiry checks...")

        if options.get("dry_run"):
            self.stdout.write(self.style.WARNING("DRY RUN — no emails will be sent"))

        summary = run_expiry_checks()

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Checked {summary['checked']} document(s), "
                f"sent {summary['emails_sent']} email(s), "
                f"{summary['errors']} error(s)."
            )
        )