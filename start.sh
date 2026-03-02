#!/usr/bin/env sh
set -eu

echo "Booting web service..."
echo "PORT=${PORT:-unset}"

python manage.py migrate --noinput

echo "Starting Gunicorn..."
exec python -m gunicorn wordlist_manager.wsgi \
  --bind 0.0.0.0:${PORT:-8080} \
  --workers ${WEB_CONCURRENCY:-2} \
  --timeout ${GUNICORN_TIMEOUT:-300} \
  --graceful-timeout ${GUNICORN_GRACEFUL_TIMEOUT:-30} \
  --keep-alive ${GUNICORN_KEEPALIVE:-5} \
  --access-logfile - \
  --error-logfile - \
  --log-level info
