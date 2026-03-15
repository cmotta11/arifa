from django.contrib import admin

from .models import (
    DeliveryLog,
    Notification,
    NotificationPreference,
    NotificationTemplate,
    ReminderCampaign,
    ReminderStep,
)


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ("key", "display_name", "category", "default_channel", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("key", "display_name")


class DeliveryLogInline(admin.TabularInline):
    model = DeliveryLog
    extra = 0
    readonly_fields = ("id", "created_at", "opened_at", "clicked_at")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "recipient", "category", "channel", "is_read", "created_at")
    list_filter = ("category", "channel", "is_read")
    inlines = [DeliveryLogInline]
    readonly_fields = ("id", "created_at")


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "daily_digest_enabled", "digest_hour")


class ReminderStepInline(admin.TabularInline):
    model = ReminderStep
    extra = 0


@admin.register(ReminderCampaign)
class ReminderCampaignAdmin(admin.ModelAdmin):
    list_display = ("name", "status", "created_by", "created_at")
    list_filter = ("status",)
    inlines = [ReminderStepInline]
