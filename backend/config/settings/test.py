from config.settings.base import *  # noqa: F401, F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "arifa_test",
        "USER": os.environ.get("POSTGRES_USER", "arifa"),  # noqa: F405
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "arifa_dev_password"),  # noqa: F405
        "HOST": os.environ.get("POSTGRES_HOST", "db"),  # noqa: F405
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),  # noqa: F405
    }
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
