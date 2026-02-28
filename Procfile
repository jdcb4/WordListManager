web: python manage.py migrate --noinput && gunicorn wordlist_manager.wsgi --bind 0.0.0.0:$PORT --access-logfile - --error-logfile - --log-level info
