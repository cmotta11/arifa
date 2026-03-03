import factory
from django.utils import timezone
from datetime import timedelta

from apps.authentication.constants import COORDINATOR, GUEST_LINK_EXPIRY_DAYS
from apps.authentication.models import GuestLink, User


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    role = COORDINATOR
    is_active = True

    @factory.lazy_attribute
    def password(self):
        return "testpass123"

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        password = kwargs.pop("password", "testpass123")
        user = model_class(*args, **kwargs)
        user.set_password(password)
        user.save()
        return user


class GuestLinkFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = GuestLink

    created_by = factory.SubFactory(UserFactory)
    expires_at = factory.LazyFunction(
        lambda: timezone.now() + timedelta(days=GUEST_LINK_EXPIRY_DAYS)
    )
    is_active = True
    # By default, callers must pass either ticket or kyc_submission.
    # We do not set defaults because the DB constraint requires exactly one.
