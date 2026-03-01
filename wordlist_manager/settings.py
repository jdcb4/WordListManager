"""Django settings for wordlist_manager project."""

import os
from pathlib import Path
from urllib.parse import urlparse

import dj_database_url
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

EXPORTS_DIR = BASE_DIR / "exports"
EXPORTS_DIR.mkdir(exist_ok=True)


SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
DEBUG = os.getenv("DEBUG", "true").lower() == "true"
REACT_MANAGE_UI_ENABLED = os.getenv("REACT_MANAGE_UI_ENABLED", "false").strip().lower() == "true"
REACT_UI_BASE_URL = os.getenv("REACT_UI_BASE_URL", "").strip().rstrip("/")


def _parse_allowed_hosts(raw_hosts: str) -> list[str]:
    railway_detected = any(
        os.getenv(key)
        for key in ("RAILWAY_PROJECT_ID", "RAILWAY_ENVIRONMENT_ID", "RAILWAY_PUBLIC_DOMAIN")
    )
    strict_host_check = os.getenv("RAILWAY_STRICT_HOST_CHECK", "false").strip().lower() == "true"
    if railway_detected and not strict_host_check:
        return ["*"]

    hosts: list[str] = ["localhost", "127.0.0.1", "[::1]"]
    for part in raw_hosts.split(","):
        candidate = part.strip().strip("\"'")
        if not candidate:
            continue
        if candidate == "*":
            return ["*"]
        if "://" in candidate:
            parsed = urlparse(candidate)
            if parsed.hostname:
                hosts.append(parsed.hostname)
            continue
        hosts.append(candidate.split("/")[0])
    railway_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN", "").strip()
    if railway_domain:
        hosts.append(railway_domain)
    deduped = [host for i, host in enumerate(hosts) if host and host not in hosts[:i]]
    return deduped or ["*"]


def _parse_csrf_trusted_origins(raw_origins: str) -> list[str]:
    origins: list[str] = []
    for part in raw_origins.split(","):
        candidate = part.strip().strip("\"'")
        if not candidate:
            continue
        if not candidate.startswith(("http://", "https://")):
            candidate = f"https://{candidate}"
        parsed = urlparse(candidate)
        if parsed.scheme and parsed.netloc:
            origins.append(f"{parsed.scheme}://{parsed.netloc}")
    railway_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN", "").strip()
    if railway_domain:
        origins.append(f"https://{railway_domain}")
    return [origin for i, origin in enumerate(origins) if origin and origin not in origins[:i]]


ALLOWED_HOSTS = _parse_allowed_hosts(os.getenv("ALLOWED_HOSTS", "*"))
CSRF_TRUSTED_ORIGINS = _parse_csrf_trusted_origins(os.getenv("CSRF_TRUSTED_ORIGINS", ""))


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'django_filters',
    'words',
    'api',
    'webui',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'wordlist_manager.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / "templates"],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'wordlist_manager.wsgi.application'


default_db_url = f"sqlite:///{BASE_DIR / 'db.sqlite3'}"
database_url = os.getenv("DATABASE_URL") or default_db_url
DATABASES = {
    "default": dj_database_url.parse(
        database_url,
        conn_max_age=int(os.getenv("DB_CONN_MAX_AGE", "600")),
        ssl_require=os.getenv("DB_SSL_REQUIRE", "false").lower() == "true",
    )
}


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = os.getenv("TIME_ZONE", "UTC")

USE_I18N = True

USE_TZ = True


STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / "staticfiles"
_frontend_dist = BASE_DIR / "frontend" / "dist"
STATICFILES_DIRS = [_frontend_dist] if _frontend_dist.exists() else []
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

LOGIN_URL = "/accounts/login/"
LOGIN_REDIRECT_URL = "/manage/"
LOGOUT_REDIRECT_URL = "/"

REST_FRAMEWORK = {
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("THROTTLE_ANON_RATE", "120/hour"),
        "user": os.getenv("THROTTLE_USER_RATE", "1200/hour"),
        "exports": os.getenv("THROTTLE_EXPORT_RATE", "20/hour"),
    },
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 100,
}

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
