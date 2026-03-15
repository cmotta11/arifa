from django.conf import settings
from django.db import models

from common.base_model import TimeStampedModel

from .constants import (
    AuditAction,
    AuditSource,
    ClientCategory,
    ClientStatus,
    ClientType,
    EntityJurisdiction,
    EntityStatus,
    IdentificationType,
    MatterStatus,
    OfficerPosition,
    PersonStatus,
    PersonType,
    RiskLevel,
)


class Client(TimeStampedModel):
    aderant_client_id = models.CharField(
        max_length=50, null=True, blank=True, unique=True
    )
    name = models.CharField(max_length=255)
    client_type = models.CharField(
        max_length=20,
        choices=ClientType.choices,
    )
    category = models.CharField(
        max_length=20,
        choices=ClientCategory.choices,
        default=ClientCategory.SILVER,
    )
    status = models.CharField(
        max_length=20,
        choices=ClientStatus.choices,
        default=ClientStatus.ACTIVE,
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Client"
        verbose_name_plural = "Clients"

    def __str__(self):
        return f"{self.name} ({self.get_client_type_display()})"


class Entity(TimeStampedModel):
    name = models.CharField(max_length=255)
    jurisdiction = models.CharField(
        max_length=20,
        choices=EntityJurisdiction.choices,
    )
    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        related_name="entities",
    )
    incorporation_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=EntityStatus.choices,
        default=EntityStatus.PENDING,
    )
    nominal_directors_requested = models.BooleanField(default=False)
    ubo_exception_type = models.CharField(
        max_length=30,
        choices=[
            ("stock_exchange", "Listed on Stock Exchange"),
            ("multilateral", "Multilateral Organization"),
            ("state_owned", "State-Owned Entity"),
        ],
        blank=True,
        default="",
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Entity"
        verbose_name_plural = "Entities"

    def __str__(self):
        return f"{self.name} ({self.get_jurisdiction_display()})"


class Matter(TimeStampedModel):
    aderant_matter_id = models.CharField(
        max_length=50, null=True, blank=True, unique=True
    )
    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        related_name="matters",
    )
    entity = models.ForeignKey(
        Entity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matters",
    )
    description = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=MatterStatus.choices,
        default=MatterStatus.OPEN,
    )
    opened_date = models.DateField(auto_now_add=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Matter"
        verbose_name_plural = "Matters"

    def __str__(self):
        return f"Matter {self.aderant_matter_id or self.id} - {self.client.name}"


class Person(TimeStampedModel):
    full_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255, blank=True, default="")
    person_type = models.CharField(
        max_length=20,
        choices=PersonType.choices,
    )
    nationality = models.ForeignKey(
        "compliance.JurisdictionRisk",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="persons_by_nationality",
    )
    country_of_residence = models.ForeignKey(
        "compliance.JurisdictionRisk",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="persons_by_residence",
    )
    date_of_birth = models.DateField(null=True, blank=True)
    identification_number = models.CharField(max_length=100, blank=True, default="")
    identification_type = models.CharField(
        max_length=30,
        choices=IdentificationType.choices,
        blank=True,
        default="",
    )
    pep_status = models.BooleanField(default=False)
    status = models.CharField(
        max_length=20,
        choices=PersonStatus.choices,
        default=PersonStatus.PENDING_APPROVAL,
    )
    client = models.ForeignKey(
        Client,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="persons",
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Person"
        verbose_name_plural = "Persons"

    @property
    def display_name(self):
        return f"{self.full_name} {self.last_name}".strip()

    def __str__(self):
        return f"{self.display_name} ({self.get_person_type_display()})"


class EntityOfficer(TimeStampedModel):
    entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name="officers",
    )
    officer_person = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="officer_positions",
    )
    officer_entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="officer_positions_as_entity",
    )
    positions = models.JSONField(default=list)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Entity Officer"
        verbose_name_plural = "Entity Officers"
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(
                        officer_person__isnull=False,
                        officer_entity__isnull=True,
                    )
                    | models.Q(
                        officer_person__isnull=True,
                        officer_entity__isnull=False,
                    )
                ),
                name="entity_officer_holder_xor",
            )
        ]

    def __str__(self):
        holder = self.officer_person or self.officer_entity
        positions_str = ", ".join(self.positions) if self.positions else "no position"
        return f"{holder} - {positions_str} @ {self.entity.name}"


class ShareClass(TimeStampedModel):
    entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name="share_classes",
    )
    name = models.CharField(max_length=100)
    currency = models.CharField(max_length=3, default="USD")
    par_value = models.DecimalField(
        max_digits=12, decimal_places=4, null=True, blank=True
    )
    authorized_shares = models.IntegerField(null=True, blank=True)
    voting_rights = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Share Class"
        verbose_name_plural = "Share Classes"

    def __str__(self):
        return f"{self.name} ({self.entity.name})"


class ShareIssuance(TimeStampedModel):
    share_class = models.ForeignKey(
        ShareClass,
        on_delete=models.CASCADE,
        related_name="issuances",
    )
    shareholder_person = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="share_issuances",
    )
    shareholder_entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="share_issuances_as_holder",
    )
    num_shares = models.IntegerField()
    issue_date = models.DateField(null=True, blank=True)
    certificate_number = models.CharField(max_length=50, blank=True, default="")
    is_jtwros = models.BooleanField(default=False)
    jtwros_partner_name = models.CharField(max_length=255, blank=True, default="")
    is_trustee = models.BooleanField(default=False)
    trustee_for = models.CharField(max_length=255, blank=True, default="")

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Share Issuance"
        verbose_name_plural = "Share Issuances"
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(
                        shareholder_person__isnull=False,
                        shareholder_entity__isnull=True,
                    )
                    | models.Q(
                        shareholder_person__isnull=True,
                        shareholder_entity__isnull=False,
                    )
                ),
                name="share_issuance_holder_xor",
            )
        ]

    def __str__(self):
        holder = self.shareholder_person or self.shareholder_entity
        return f"{self.num_shares} shares of {self.share_class.name} -> {holder}"


class ActivityCatalog(TimeStampedModel):
    name = models.CharField(max_length=255, unique=True)
    default_risk_level = models.CharField(
        max_length=20,
        choices=RiskLevel.choices,
        default=RiskLevel.LOW,
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Activity Catalog"
        verbose_name_plural = "Activity Catalog"

    def __str__(self):
        return self.name


class EntityActivity(TimeStampedModel):
    entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name="activities",
    )
    activity = models.ForeignKey(
        ActivityCatalog,
        on_delete=models.CASCADE,
        related_name="entity_activities",
    )
    countries = models.ManyToManyField(
        "compliance.JurisdictionRisk",
        blank=True,
        related_name="entity_activities",
    )
    country_risk_level = models.CharField(
        max_length=20,
        choices=RiskLevel.choices,
        default=RiskLevel.LOW,
    )
    risk_level = models.CharField(
        max_length=20,
        choices=RiskLevel.choices,
    )
    description = models.TextField(blank=True, default="")

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Entity Activity"
        verbose_name_plural = "Entity Activities"

    def __str__(self):
        return f"{self.activity.name} - {self.entity.name}"


class SourceOfFundsCatalog(TimeStampedModel):
    name = models.CharField(max_length=255, unique=True)
    default_risk_level = models.CharField(
        max_length=20,
        choices=RiskLevel.choices,
        default=RiskLevel.LOW,
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Source of Funds Catalog"
        verbose_name_plural = "Source of Funds Catalog"

    def __str__(self):
        return self.name


class SourceOfFunds(TimeStampedModel):
    entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name="sources_of_funds",
    )
    source = models.ForeignKey(
        SourceOfFundsCatalog,
        on_delete=models.CASCADE,
        related_name="entity_sources",
    )
    countries = models.ManyToManyField(
        "compliance.JurisdictionRisk",
        blank=True,
        related_name="entity_sources_of_funds",
    )
    country_risk_level = models.CharField(
        max_length=20,
        choices=RiskLevel.choices,
        default=RiskLevel.LOW,
    )
    risk_level = models.CharField(
        max_length=20,
        choices=RiskLevel.choices,
    )
    description = models.TextField(blank=True, default="")

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Source of Funds"
        verbose_name_plural = "Sources of Funds"

    def __str__(self):
        return f"{self.source.name} - {self.entity.name}"


class ClientContact(TimeStampedModel):
    client = models.ForeignKey(
        Client, on_delete=models.CASCADE, related_name="contacts"
    )
    user = models.OneToOneField(
        "authentication.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="client_contact",
    )
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150, blank=True)
    email = models.EmailField()
    phone = models.CharField(max_length=50, blank=True)
    position = models.CharField(max_length=150, blank=True)
    has_portal_access = models.BooleanField(default=False)

    class Meta(TimeStampedModel.Meta):
        unique_together = [("client", "email")]
        ordering = ["first_name", "last_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"


class SourceOfWealth(TimeStampedModel):
    person = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name="sources_of_wealth",
    )
    description = models.TextField()
    risk_level = models.CharField(
        max_length=20,
        choices=RiskLevel.choices,
        default=RiskLevel.LOW,
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Source of Wealth"
        verbose_name_plural = "Sources of Wealth"

    def __str__(self):
        return f"SoW: {self.person.full_name} - {self.description[:50]}"


class EntityAuditLog(TimeStampedModel):
    entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name="audit_logs",
    )
    kyc_submission = models.ForeignKey(
        "compliance.KYCSubmission",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    model_name = models.CharField(max_length=50)
    record_id = models.UUIDField(null=True, blank=True)
    action = models.CharField(
        max_length=10,
        choices=AuditAction.choices,
    )
    field_name = models.CharField(max_length=100)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="entity_audit_logs",
    )
    source = models.CharField(
        max_length=20,
        choices=AuditSource.choices,
    )
    comment = models.TextField(blank=True, default="")

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Entity Audit Log"
        verbose_name_plural = "Entity Audit Logs"
        indexes = [
            models.Index(
                fields=["entity", "-created_at"],
                name="idx_audit_entity_created",
            ),
        ]

    def __str__(self):
        return f"Audit: {self.entity.name} - {self.action} {self.model_name}.{self.field_name}"


class PersonAuditLog(TimeStampedModel):
    person = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name="audit_logs",
    )
    model_name = models.CharField(max_length=50)
    record_id = models.UUIDField(null=True, blank=True)
    action = models.CharField(
        max_length=10,
        choices=AuditAction.choices,
    )
    field_name = models.CharField(max_length=100)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="person_audit_logs",
    )
    source = models.CharField(
        max_length=20,
        choices=AuditSource.choices,
    )
    comment = models.TextField(blank=True, default="")

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Person Audit Log"
        verbose_name_plural = "Person Audit Logs"
        indexes = [
            models.Index(
                fields=["person", "-created_at"],
                name="idx_audit_person_created",
            ),
        ]

    def __str__(self):
        return f"Audit: {self.person.full_name} - {self.action} {self.model_name}.{self.field_name}"


class SavedFilter(TimeStampedModel):
    """User-specific saved filter presets for any list page."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_filters",
    )
    name = models.CharField(max_length=100)
    module = models.CharField(max_length=50)  # e.g. "entities", "tickets", "people"
    filters = models.JSONField(default=dict)  # The actual filter params
    is_default = models.BooleanField(default=False)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Saved Filter"
        verbose_name_plural = "Saved Filters"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "module", "name"],
                name="unique_filter_name_per_user_module",
            ),
        ]

    def __str__(self):
        return f"{self.user} - {self.module}: {self.name}"
