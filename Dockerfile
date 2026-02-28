FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput

CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn wordlist_manager.wsgi --bind 0.0.0.0:${PORT:-8000} --access-logfile - --error-logfile - --log-level info"]
