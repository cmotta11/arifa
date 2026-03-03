from django.contrib import admin

from .models import (
    ActivityCatalog,
    Client,
    Entity,
    EntityActivity,
    EntityOfficer,
    Matter,
    Person,
    ShareClass,
    ShareIssuance,
    SourceOfFunds,
    SourceOfFundsCatalog,
    SourceOfWealth,
)


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ["name", "client_type", "category", "status", "created_at"]
    list_filter = ["client_type", "category", "status"]
    search_fields = ["name", "aderant_client_id"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(Entity)
class EntityAdmin(admin.ModelAdmin):
    list_display = ["name", "jurisdiction", "client", "status", "incorporation_date"]
    list_filter = ["jurisdiction", "status"]
    search_fields = ["name"]
    readonly_fields = ["id", "created_at", "updated_at"]
    raw_id_fields = ["client"]


@admin.register(Matter)
class MatterAdmin(admin.ModelAdmin):
    list_display = ["aderant_matter_id", "client", "entity", "status", "opened_date"]
    list_filter = ["status"]
    search_fields = ["aderant_matter_id", "description", "client__name"]
    readonly_fields = ["id", "created_at", "updated_at", "opened_date"]
    raw_id_fields = ["client", "entity"]


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = [
        "full_name",
        "person_type",
        "get_nationality",
        "get_country_of_residence",
        "pep_status",
        "client",
    ]
    list_filter = ["person_type", "pep_status", "identification_type"]
    search_fields = ["full_name", "identification_number"]
    readonly_fields = ["id", "created_at", "updated_at"]
    raw_id_fields = ["client", "nationality", "country_of_residence"]

    @admin.display(description="Nationality")
    def get_nationality(self, obj):
        return obj.nationality.country_name if obj.nationality else "—"

    @admin.display(description="Country of Residence")
    def get_country_of_residence(self, obj):
        return obj.country_of_residence.country_name if obj.country_of_residence else "—"


@admin.register(EntityOfficer)
class EntityOfficerAdmin(admin.ModelAdmin):
    list_display = ["get_holder_name", "entity", "positions", "is_active", "start_date"]
    list_filter = ["is_active"]
    search_fields = [
        "officer_person__full_name",
        "officer_entity__name",
        "entity__name",
    ]
    readonly_fields = ["id", "created_at", "updated_at"]
    raw_id_fields = ["entity", "officer_person", "officer_entity"]

    @admin.display(description="Holder")
    def get_holder_name(self, obj):
        if obj.officer_person:
            return obj.officer_person.full_name
        if obj.officer_entity:
            return obj.officer_entity.name
        return "—"


@admin.register(ShareClass)
class ShareClassAdmin(admin.ModelAdmin):
    list_display = ["name", "entity", "currency", "par_value", "authorized_shares", "voting_rights"]
    list_filter = ["currency", "voting_rights"]
    search_fields = ["name", "entity__name"]
    readonly_fields = ["id", "created_at", "updated_at"]
    raw_id_fields = ["entity"]


@admin.register(ShareIssuance)
class ShareIssuanceAdmin(admin.ModelAdmin):
    list_display = ["share_class", "num_shares", "issue_date", "is_jtwros", "is_trustee"]
    list_filter = ["is_jtwros", "is_trustee"]
    readonly_fields = ["id", "created_at", "updated_at"]
    raw_id_fields = ["share_class", "shareholder_person", "shareholder_entity"]


@admin.register(ActivityCatalog)
class ActivityCatalogAdmin(admin.ModelAdmin):
    list_display = ["name", "default_risk_level"]
    list_filter = ["default_risk_level"]
    search_fields = ["name"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(EntityActivity)
class EntityActivityAdmin(admin.ModelAdmin):
    list_display = ["entity", "activity", "country_risk_level", "risk_level"]
    list_filter = ["risk_level", "country_risk_level"]
    search_fields = ["entity__name", "activity__name"]
    readonly_fields = ["id", "created_at", "updated_at"]
    raw_id_fields = ["entity", "activity"]
    filter_horizontal = ["countries"]


@admin.register(SourceOfFundsCatalog)
class SourceOfFundsCatalogAdmin(admin.ModelAdmin):
    list_display = ["name", "default_risk_level"]
    list_filter = ["default_risk_level"]
    search_fields = ["name"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(SourceOfFunds)
class SourceOfFundsAdmin(admin.ModelAdmin):
    list_display = ["entity", "source", "country_risk_level", "risk_level"]
    list_filter = ["risk_level", "country_risk_level"]
    search_fields = ["entity__name", "source__name"]
    readonly_fields = ["id", "created_at", "updated_at"]
    raw_id_fields = ["entity", "source"]
    filter_horizontal = ["countries"]


@admin.register(SourceOfWealth)
class SourceOfWealthAdmin(admin.ModelAdmin):
    list_display = ["person", "risk_level", "created_at"]
    list_filter = ["risk_level"]
    search_fields = ["person__full_name", "description"]
    readonly_fields = ["id", "created_at", "updated_at"]
    raw_id_fields = ["person"]
