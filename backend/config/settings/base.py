import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "insecure-change-me")

DEBUG = False

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",")

# ---------- Apps ----------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
    "django_filters",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.microsoft",
    "django_celery_beat",
]

LOCAL_APPS = [
    "apps.authentication",
    "apps.core",
    "apps.workflow",
    "apps.compliance",
    "apps.documents",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ---------- Middleware ----------
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------- Database ----------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "arifa"),
        "USER": os.environ.get("POSTGRES_USER", "arifa"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "arifa_dev_password"),
        "HOST": os.environ.get("POSTGRES_HOST", "db"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}

# ---------- Auth ----------
AUTH_USER_MODEL = "authentication.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

SITE_ID = 1

# allauth
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_EMAIL_VERIFICATION = "none"


# ---------- i18n ----------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/Panama"
USE_I18N = True
USE_TZ = True

# ---------- Static ----------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "mediafiles"

# ---------- DRF ----------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "common.pagination.StandardPagination",
    "PAGE_SIZE": 25,
    "EXCEPTION_HANDLER": "common.exceptions.custom_exception_handler",
}

# ---------- CORS ----------
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-guest-token",
]

# ---------- Celery ----------
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://redis:6379/1")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "America/Panama"

CELERY_BEAT_SCHEDULE = {
    "recalculate-risks-weekly": {
        "task": "apps.compliance.tasks.recalculate_all_risks",
        "schedule": 604800.0,  # Weekly (seconds) - overridden by crontab in prod
    },
}

# ---------- Default PK ----------
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------- SharePoint ----------
SHAREPOINT_TENANT_ID = os.environ.get("SHAREPOINT_TENANT_ID", "")
SHAREPOINT_CLIENT_ID = os.environ.get("SHAREPOINT_CLIENT_ID", "")
SHAREPOINT_CLIENT_SECRET = os.environ.get("SHAREPOINT_CLIENT_SECRET", "")
SHAREPOINT_SITE_ID = os.environ.get("SHAREPOINT_SITE_ID", "")
SHAREPOINT_DRIVE_ID = os.environ.get("SHAREPOINT_DRIVE_ID", "")
SHAREPOINT_ROOT_FOLDER = os.environ.get("SHAREPOINT_ROOT_FOLDER", "ARIFA_Documents")

# ---------- World-Check ----------
WORLDCHECK_API_KEY = os.environ.get("WORLDCHECK_API_KEY", "")
WORLDCHECK_API_SECRET = os.environ.get("WORLDCHECK_API_SECRET", "")
WORLDCHECK_GROUP_ID = os.environ.get("WORLDCHECK_GROUP_ID", "")
WORLDCHECK_API_URL = os.environ.get(
    "WORLDCHECK_API_URL",
    "https://rms-world-check-one-api-pilot.thomsonreuters.com/v2",
)
WORLDCHECK_WEBHOOK_SECRET = os.environ.get("WORLDCHECK_WEBHOOK_SECRET", "")

# ---------- LLM ----------
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_API_URL = os.environ.get("LLM_API_URL", "")
LLM_AUTH_TYPE = os.environ.get("LLM_AUTH_TYPE", "bearer")
LLM_MODEL_NAME = os.environ.get("LLM_MODEL_NAME", "gpt-4o")

# ---------- Aderant ERP ----------
ADERANT_API_URL = os.environ.get("ADERANT_API_URL", "")
ADERANT_API_KEY = os.environ.get("ADERANT_API_KEY", "")
ADERANT_API_SECRET = os.environ.get("ADERANT_API_SECRET", "")

# ---------- Gotenberg ----------
GOTENBERG_URL = os.environ.get("GOTENBERG_URL", "http://gotenberg:3000")

# ---------- Email ----------
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "noreply@arifa.law")
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"
)
EMAIL_HOST = os.environ.get("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "25"))
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "False").lower() == "true"
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
