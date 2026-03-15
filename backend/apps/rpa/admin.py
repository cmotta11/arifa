from django.contrib import admin

from .models import RPAJob, RPAJobDefinition, RPAJobStep


class RPAJobStepInline(admin.TabularInline):
    model = RPAJobStep
    extra = 0
    readonly_fields = ("id", "started_at", "completed_at")


@admin.register(RPAJobDefinition)
class RPAJobDefinitionAdmin(admin.ModelAdmin):
    list_display = ("name", "display_name", "target_integration", "is_active", "created_at")
    list_filter = ("is_active", "target_integration")
    search_fields = ("name", "display_name")


@admin.register(RPAJob)
class RPAJobAdmin(admin.ModelAdmin):
    list_display = ("id", "definition", "status", "retry_count", "created_at")
    list_filter = ("status",)
    inlines = [RPAJobStepInline]
    readonly_fields = ("id", "celery_task_id", "started_at", "completed_at")
