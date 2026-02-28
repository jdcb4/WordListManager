from __future__ import annotations

import os

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Check deployment-related config and print actionable warnings."

    def handle(self, *args, **options):
        warnings = []

        if settings.DEBUG:
            warnings.append("DEBUG is true. Set DEBUG=false in production.")
        if settings.SECRET_KEY in {"dev-secret-key-change-me", ""}:
            warnings.append("SECRET_KEY is weak/default. Set a strong secret.")

        strict = os.getenv("RAILWAY_STRICT_HOST_CHECK", "false").lower() == "true"
        if strict and ("*" in settings.ALLOWED_HOSTS):
            warnings.append("RAILWAY_STRICT_HOST_CHECK=true but ALLOWED_HOSTS contains '*'.")
        if strict and not settings.CSRF_TRUSTED_ORIGINS:
            warnings.append("Strict host check is enabled but CSRF_TRUSTED_ORIGINS is empty.")

        if warnings:
            self.stdout.write(self.style.WARNING("Deployment config warnings:"))
            for warning in warnings:
                self.stdout.write(f"- {warning}")
            return

        self.stdout.write(self.style.SUCCESS("Deployment config looks good."))
