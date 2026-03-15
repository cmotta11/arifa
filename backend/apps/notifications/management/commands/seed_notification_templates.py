"""Seed notification templates."""

from django.core.management.base import BaseCommand

from apps.notifications.models import NotificationTemplate

TEMPLATES = [
    # Ticket notifications
    {
        "key": "ticket_created",
        "display_name": "Ticket Created",
        "category": "ticket",
        "subject_template": "New ticket: {ticket_title}",
        "body_template": "A new ticket '{ticket_title}' has been created and assigned to you.",
        "in_app_template": "New ticket: {ticket_title}",
    },
    {
        "key": "ticket_state_change",
        "display_name": "Ticket State Changed",
        "category": "ticket",
        "subject_template": "Ticket updated: {ticket_title}",
        "body_template": "Ticket '{ticket_title}' moved from {previous_state} to {new_state} by {changed_by}.",
        "in_app_template": "{ticket_title}: {previous_state} → {new_state}",
    },
    {
        "key": "ticket_assigned",
        "display_name": "Ticket Assigned",
        "category": "ticket",
        "subject_template": "Ticket assigned: {ticket_title}",
        "body_template": "You have been assigned to ticket '{ticket_title}'.",
        "in_app_template": "Assigned to you: {ticket_title}",
    },
    {
        "key": "ticket_comment",
        "display_name": "Ticket Comment",
        "category": "ticket",
        "subject_template": "Comment on: {ticket_title}",
        "body_template": "{changed_by} commented on ticket '{ticket_title}': {comment}",
        "in_app_template": "Comment on {ticket_title}",
    },
    # KYC notifications
    {
        "key": "kyc_submitted",
        "display_name": "KYC Submitted for Review",
        "category": "kyc",
        "subject_template": "KYC submission ready for review",
        "body_template": "A KYC submission (ID: {kyc_id}) has been submitted and is ready for compliance review.",
        "in_app_template": "KYC submitted for review",
    },
    {
        "key": "kyc_approved",
        "display_name": "KYC Approved",
        "category": "kyc",
        "subject_template": "KYC submission approved",
        "body_template": "KYC submission (ID: {kyc_id}) has been approved.",
        "in_app_template": "KYC approved",
    },
    {
        "key": "kyc_rejected",
        "display_name": "KYC Rejected",
        "category": "kyc",
        "subject_template": "KYC submission rejected",
        "body_template": "KYC submission (ID: {kyc_id}) has been rejected. Please review and resubmit.",
        "in_app_template": "KYC rejected",
    },
    {
        "key": "kyc_sent_back",
        "display_name": "KYC Sent Back",
        "category": "kyc",
        "subject_template": "KYC returned for corrections",
        "body_template": "KYC submission (ID: {kyc_id}) has been sent back for corrections.",
        "in_app_template": "KYC sent back for corrections",
    },
    # Compliance notifications
    {
        "key": "rfi_created",
        "display_name": "RFI Created",
        "category": "compliance",
        "subject_template": "Request for Information",
        "body_template": "A new Request for Information has been created. Notes: {notes}",
        "in_app_template": "New RFI received",
    },
    {
        "key": "rfi_responded",
        "display_name": "RFI Response Received",
        "category": "compliance",
        "subject_template": "RFI response received",
        "body_template": "A response has been received for RFI (ID: {rfi_id}).",
        "in_app_template": "RFI response received",
    },
    {
        "key": "risk_high_alert",
        "display_name": "High Risk Alert",
        "category": "compliance",
        "subject_template": "HIGH RISK: {entity_name}",
        "body_template": "Entity '{entity_name}' has been assessed as HIGH RISK (score: {total_score}). Immediate review required.",
        "in_app_template": "HIGH RISK: {entity_name} (score: {total_score})",
        "default_channel": "both",
    },
    {
        "key": "risk_level_change",
        "display_name": "Risk Level Changed",
        "category": "compliance",
        "subject_template": "Risk level changed: {entity_name}",
        "body_template": "Risk level for '{entity_name}' changed from {old_level} to {new_level}.",
        "in_app_template": "{entity_name}: risk {old_level} → {new_level}",
    },
    {
        "key": "worldcheck_match",
        "display_name": "World-Check Match Found",
        "category": "compliance",
        "subject_template": "Screening match: {party_name}",
        "body_template": "A potential World-Check match was found for '{party_name}'. Review required.",
        "in_app_template": "Screening match: {party_name}",
    },
    # RPA notifications
    {
        "key": "rpa_job_completed",
        "display_name": "RPA Job Completed",
        "category": "rpa",
        "subject_template": "RPA job completed: {job_name}",
        "body_template": "RPA job '{job_name}' has completed successfully.",
        "in_app_template": "RPA completed: {job_name}",
    },
    {
        "key": "rpa_job_failed",
        "display_name": "RPA Job Failed",
        "category": "rpa",
        "subject_template": "RPA job failed: {job_name}",
        "body_template": "RPA job '{job_name}' has failed. Error: {error}",
        "in_app_template": "RPA failed: {job_name}",
        "default_channel": "both",
    },
    # Document notifications
    {
        "key": "document_uploaded",
        "display_name": "Document Uploaded",
        "category": "document",
        "subject_template": "New document uploaded",
        "body_template": "A new document '{filename}' has been uploaded.",
        "in_app_template": "Document uploaded: {filename}",
    },
    {
        "key": "document_extracted",
        "display_name": "Document Extraction Complete",
        "category": "document",
        "subject_template": "Document extraction complete",
        "body_template": "AI extraction for '{filename}' is complete. Review the results.",
        "in_app_template": "Extraction complete: {filename}",
    },
    {
        "key": "document_generated",
        "display_name": "Document Generated",
        "category": "document",
        "subject_template": "Document generated: {template_name}",
        "body_template": "Document '{template_name}' has been generated and is ready for download.",
        "in_app_template": "Document ready: {template_name}",
    },
    # System notifications
    {
        "key": "delegation_invitation",
        "display_name": "Delegation Invitation",
        "category": "system",
        "subject_template": "You've been delegated: {entity_name}",
        "body_template": "You have been delegated access to {module} for entity '{entity_name}'. Log in to accept.",
        "in_app_template": "Delegation: {entity_name} ({module})",
    },
    {
        "key": "delegation_accepted",
        "display_name": "Delegation Accepted",
        "category": "system",
        "subject_template": "Delegation accepted: {entity_name}",
        "body_template": "{delegate_email} has accepted the delegation for {entity_name}.",
        "in_app_template": "Delegation accepted: {entity_name}",
    },
    {
        "key": "daily_digest",
        "display_name": "Daily Digest",
        "category": "system",
        "subject_template": "ARIFA Daily Digest - {count} notifications",
        "body_template": "You have {count} unread notifications. Log in to review them.",
        "in_app_template": "",
        "default_channel": "email",
    },
    {
        "key": "welcome",
        "display_name": "Welcome",
        "category": "system",
        "subject_template": "Welcome to ARIFA",
        "body_template": "Welcome to the ARIFA platform! Your account has been created. Log in to get started.",
        "in_app_template": "Welcome to ARIFA!",
    },
    {
        "key": "password_reset",
        "display_name": "Password Reset",
        "category": "system",
        "subject_template": "Password reset requested",
        "body_template": "A password reset was requested for your account. Click the link to reset: {reset_url}",
        "in_app_template": "",
        "default_channel": "email",
    },
    # Reminder templates
    {
        "key": "reminder_kyc_expiry",
        "display_name": "KYC Expiry Reminder",
        "category": "reminder",
        "subject_template": "KYC renewal due: {entity_name}",
        "body_template": "The KYC for entity '{entity_name}' is due for renewal. Please initiate the renewal process.",
        "in_app_template": "KYC renewal due: {entity_name}",
    },
    {
        "key": "reminder_document_pending",
        "display_name": "Pending Documents Reminder",
        "category": "reminder",
        "subject_template": "Documents pending: {entity_name}",
        "body_template": "There are pending document requests for entity '{entity_name}'. Please upload the required documents.",
        "in_app_template": "Documents pending: {entity_name}",
    },
    {
        "key": "reminder_es_filing",
        "display_name": "Economic Substance Filing Reminder",
        "category": "reminder",
        "subject_template": "ES filing due: {entity_name}",
        "body_template": "The Economic Substance filing for '{entity_name}' is approaching its deadline.",
        "in_app_template": "ES filing due: {entity_name}",
    },
    {
        "key": "reminder_ar_filing",
        "display_name": "Accounting Records Filing Reminder",
        "category": "reminder",
        "subject_template": "AR filing due: {entity_name}",
        "body_template": "The Accounting Records (Registros Contables) for '{entity_name}' are due for filing.",
        "in_app_template": "AR filing due: {entity_name}",
    },
    {
        "key": "reminder_general",
        "display_name": "General Reminder",
        "category": "reminder",
        "subject_template": "Reminder: {title}",
        "body_template": "{body}",
        "in_app_template": "Reminder: {title}",
    },
    # INC Workflow notifications
    {
        "key": "high_capital_alert",
        "display_name": "High Capital Alert",
        "category": "system",
        "subject_template": "HIGH CAPITAL: {entity_name}",
        "body_template": "Incorporation for '{entity_name}' has authorized capital of {authorized_capital}. This exceeds the high-capital threshold.",
        "in_app_template": "High capital: {entity_name} ({authorized_capital})",
        "default_channel": "both",
    },
    {
        "key": "delayed_notary_alert",
        "display_name": "Delayed Notary Process",
        "category": "ticket",
        "subject_template": "Delayed in Notary: {ticket_title}",
        "body_template": "Ticket '{ticket_title}' has been in Notary stage for more than {hours_in_state} hours.",
        "in_app_template": "Notary delay: {ticket_title}",
        "default_channel": "both",
    },
    {
        "key": "delayed_registry_alert",
        "display_name": "Delayed Registry Process",
        "category": "ticket",
        "subject_template": "Delayed in Registry: {ticket_title}",
        "body_template": "Ticket '{ticket_title}' has been in Public Registry for an extended period.",
        "in_app_template": "Registry delay: {ticket_title}",
        "default_channel": "both",
    },
    {
        "key": "accounting_batch_summary",
        "display_name": "Accounting Batch Summary",
        "category": "system",
        "subject_template": "{period} Accounting Update: {expense_count} pending expenses",
        "body_template": "There are {expense_count} pending expenses awaiting processing in this {period} batch.",
        "in_app_template": "{period} batch: {expense_count} pending expenses",
    },
    {
        "key": "unfactured_incorporation_alert",
        "display_name": "Unfactured Incorporation Alert",
        "category": "system",
        "subject_template": "Uninvoiced incorporation: {ticket_title}",
        "body_template": "Incorporation '{ticket_title}' for {client_name} completed {days_since_completion} days ago but has not been invoiced.",
        "in_app_template": "Uninvoiced: {ticket_title} ({days_since_completion}d)",
        "default_channel": "both",
    },
    {
        "key": "payment_recorded",
        "display_name": "Payment Recorded",
        "category": "ticket",
        "subject_template": "Payment recorded: {ticket_title}",
        "body_template": "A payment of {amount} {currency} has been recorded for '{ticket_title}'.",
        "in_app_template": "Payment: {amount} {currency} for {ticket_title}",
    },
    {
        "key": "payment_approved",
        "display_name": "Payment Approved",
        "category": "ticket",
        "subject_template": "Payment approved: {ticket_title}",
        "body_template": "Payment for '{ticket_title}' has been approved. RPA jobs will be dispatched.",
        "in_app_template": "Payment approved: {ticket_title}",
    },
    {
        "key": "deed_assigned",
        "display_name": "Notary Deed Assigned",
        "category": "ticket",
        "subject_template": "Deed assigned: {deed_number}",
        "body_template": "Notary deed {deed_number} has been assigned to service request for '{entity_name}'.",
        "in_app_template": "Deed {deed_number} assigned",
    },
    {
        "key": "incorporation_completed",
        "display_name": "Incorporation Completed",
        "category": "ticket",
        "subject_template": "Incorporation complete: {entity_name}",
        "body_template": "The incorporation of '{entity_name}' has been completed. Entity status is now active.",
        "in_app_template": "Incorporated: {entity_name}",
    },
    {
        "key": "client_signing_reminder",
        "display_name": "Client Signing Reminder",
        "category": "reminder",
        "subject_template": "Documents pending signature: {entity_name}",
        "body_template": "Documents for '{entity_name}' are awaiting your signature. Please review and sign at your earliest convenience.",
        "in_app_template": "Signing pending: {entity_name}",
    },
    {
        "key": "draft_reminder",
        "display_name": "Draft Reminder",
        "category": "reminder",
        "subject_template": "Continue your service request",
        "body_template": "You have an incomplete service request that was last updated {days_ago} days ago. Log in to continue.",
        "in_app_template": "Draft reminder: continue your request",
    },
]


class Command(BaseCommand):
    help = "Seed notification templates"

    def handle(self, *args, **options):
        created = 0
        updated = 0

        for tmpl in TEMPLATES:
            _, was_created = NotificationTemplate.objects.update_or_create(
                key=tmpl["key"],
                defaults={
                    "display_name": tmpl["display_name"],
                    "category": tmpl.get("category", "system"),
                    "subject_template": tmpl["subject_template"],
                    "body_template": tmpl["body_template"],
                    "in_app_template": tmpl.get("in_app_template", ""),
                    "default_channel": tmpl.get("default_channel", "both"),
                    "is_active": True,
                },
            )
            if was_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(f"  Created {tmpl['key']}"))
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone: {created} created, {updated} updated. "
                f"Total: {len(TEMPLATES)} templates."
            )
        )
