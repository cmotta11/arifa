import base64
import logging
import uuid

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def extract_document_data(self, document_upload_id: str, file_b64: str = ""):
    """Call the LLM extraction integration and update the DocumentUpload record."""
    from .constants import LLMExtractionStatus
    from .integrations.llm_extraction import LLMExtractionClient
    from .models import DocumentUpload

    try:
        doc = DocumentUpload.objects.get(id=document_upload_id)
    except DocumentUpload.DoesNotExist:
        logger.error("DocumentUpload %s not found", document_upload_id)
        return {"error": "DocumentUpload not found", "id": document_upload_id}

    doc.llm_extraction_status = LLMExtractionStatus.PROCESSING
    doc.save(update_fields=["llm_extraction_status", "updated_at"])

    image_bytes = base64.b64decode(file_b64) if file_b64 else b""

    try:
        client = LLMExtractionClient()
        extraction_result = client.extract_from_image(
            image_bytes=image_bytes, document_type=doc.document_type,
        )
        doc.llm_extraction_json = extraction_result
        doc.llm_extraction_status = LLMExtractionStatus.COMPLETED
        doc.save(update_fields=["llm_extraction_json", "llm_extraction_status", "updated_at"])
        logger.info("LLM extraction completed for DocumentUpload %s", document_upload_id)
        return {
            "status": "completed",
            "document_upload_id": document_upload_id,
            "data": extraction_result,
        }
    except Exception as exc:
        doc.llm_extraction_status = LLMExtractionStatus.FAILED
        doc.llm_extraction_json = {"error": str(exc)}
        doc.save(update_fields=["llm_extraction_json", "llm_extraction_status", "updated_at"])
        logger.exception("LLM extraction failed for DocumentUpload %s", document_upload_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def screen_party_worldcheck(self, party_id: str):
    """Screen a party against World-Check One."""
    from .constants import ScreeningStatus
    from .integrations.worldcheck import WorldCheckClient
    from .models import Party, WorldCheckCase

    try:
        party = Party.objects.get(id=party_id)
    except Party.DoesNotExist:
        logger.error("Party %s not found", party_id)
        return {"error": "Party not found", "party_id": party_id}

    try:
        wc_client = WorldCheckClient()
        entity_type = "INDIVIDUAL" if party.party_type == "natural" else "ORGANISATION"
        result = wc_client.screen_entity(
            name=party.name, entity_type=entity_type,
            date_of_birth=str(party.date_of_birth) if party.date_of_birth else None,
            nationality=party.nationality or None,
            country_of_residence=party.country_of_residence or None,
        )
        case_system_id = result.get("caseSystemId", "")
        results_list = result.get("results", [])
        screening_status = ScreeningStatus.MATCHED if results_list else ScreeningStatus.CLEAR

        case, _created = WorldCheckCase.objects.update_or_create(
            party=party, case_system_id=case_system_id,
            defaults={"screening_status": screening_status, "last_screened_at": timezone.now(), "match_data_json": result},
        )
        logger.info("World-Check screening completed for party %s: status=%s", party_id, screening_status)
        return {"status": "completed", "party_id": party_id, "screening_status": screening_status, "case_id": str(case.id), "matches_found": len(results_list)}
    except Exception as exc:
        logger.exception("World-Check screening failed for party %s", party_id)
        raise self.retry(exc=exc)


# ===========================================================================
# New risk recalculation tasks
# ===========================================================================


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def recalculate_entity_risk_task(self, entity_id: str, trigger: str = "auto"):
    """Recalculate risk for a single entity."""
    from .services import calculate_entity_risk

    try:
        assessment = calculate_entity_risk(entity_id=entity_id, trigger=trigger)
        logger.info("Entity risk recalculated: entity=%s score=%d level=%s", entity_id, assessment.total_score, assessment.risk_level)
        return {"entity_id": entity_id, "score": assessment.total_score, "level": assessment.risk_level}
    except Exception as exc:
        logger.exception("Entity risk recalculation failed: entity=%s", entity_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def recalculate_person_risk_task(self, person_id: str, trigger: str = "auto"):
    """Recalculate risk for a single person."""
    from .services import calculate_person_risk

    try:
        assessment = calculate_person_risk(person_id=person_id, trigger=trigger)
        logger.info("Person risk recalculated: person=%s score=%d level=%s", person_id, assessment.total_score, assessment.risk_level)
        return {"person_id": person_id, "score": assessment.total_score, "level": assessment.risk_level}
    except Exception as exc:
        logger.exception("Person risk recalculation failed: person=%s", person_id)
        raise self.retry(exc=exc)


@shared_task(soft_time_limit=3600, time_limit=3900)
def recalculate_all_risks():
    """Iterate all active entities and persons and recalculate risk scores."""
    from .constants import RecalculationStatus, RiskTrigger
    from .models import RiskRecalculationLog
    from .services import calculate_entity_risk, calculate_person_risk

    from apps.core.models import Entity, Person

    batch_id = uuid.uuid4()
    log = RiskRecalculationLog.objects.create(
        batch_id=batch_id, status=RecalculationStatus.RUNNING,
        triggered_by="celery:recalculate_all_risks",
    )

    entities = Entity.objects.filter(status__in=["pending", "active"])
    persons = Person.objects.filter(status__in=["pending_approval", "approved"])

    log.total_entities = entities.count()
    log.save(update_fields=["total_entities", "updated_at"])

    # Pre-fetch shared data to avoid repeated DB queries per-entity/person
    from .models import JurisdictionRisk, RiskMatrixConfig
    _active_configs = list(
        RiskMatrixConfig.objects.filter(is_active=True)
        .prefetch_related("factors", "trigger_rules")
    )
    _jurisdiction_risks = {
        jr.country_code.lower(): jr
        for jr in JurisdictionRisk.objects.all()
    }
    # Warm Django's query cache by evaluating prefetches
    for config in _active_configs:
        list(config.factors.all())
        list(config.trigger_rules.all())

    changed = 0
    recalculated = 0
    failed_entity_ids = []
    failed_person_ids = []

    try:
        for entity in entities.iterator():
            try:
                from . import selectors
                previous = selectors.get_current_entity_risk(entity_id=entity.id)
                previous_level = previous.risk_level if previous else None

                new_assessment = calculate_entity_risk(entity_id=entity.id, trigger=RiskTrigger.SCHEDULED)
                recalculated += 1
                if previous_level and previous_level != new_assessment.risk_level:
                    changed += 1
            except Exception:
                logger.exception("Failed to recalculate entity %s", entity.id)
                failed_entity_ids.append(str(entity.id))

        for person in persons.iterator():
            try:
                from . import selectors
                previous = selectors.get_current_person_risk(person_id=person.id)
                previous_level = previous.risk_level if previous else None

                new_assessment = calculate_person_risk(person_id=person.id, trigger=RiskTrigger.SCHEDULED)
                recalculated += 1
                if previous_level and previous_level != new_assessment.risk_level:
                    changed += 1
            except Exception:
                logger.exception("Failed to recalculate person %s", person.id)
                failed_person_ids.append(str(person.id))

        if failed_entity_ids or failed_person_ids:
            logger.warning(
                "Risk recalculation batch %s had failures: %d entities, %d persons",
                batch_id, len(failed_entity_ids), len(failed_person_ids),
            )

        log.recalculated_count = recalculated
        log.changed_count = changed
        log.status = RecalculationStatus.COMPLETED
        log.completed_at = timezone.now()
        log.save(update_fields=["recalculated_count", "changed_count", "status", "completed_at", "updated_at"])

        logger.info("Risk recalculation batch %s completed: %d recalculated, %d changed", batch_id, recalculated, changed)
        return {
            "batch_id": str(batch_id), "status": "completed",
            "recalculated": recalculated, "changed": changed,
            "failed_entity_ids": failed_entity_ids, "failed_person_ids": failed_person_ids,
        }
    except Exception as exc:
        log.recalculated_count = recalculated
        log.changed_count = changed
        log.status = RecalculationStatus.FAILED
        log.completed_at = timezone.now()
        log.save(update_fields=["recalculated_count", "changed_count", "status", "completed_at", "updated_at"])
        logger.exception("Risk recalculation batch %s failed", batch_id)
        raise exc


@shared_task
def recalculate_high_risk_entities():
    """Recalculate risk only for entities currently rated HIGH."""
    from .constants import RecalculationStatus, RiskLevel, RiskTrigger
    from .models import RiskAssessment, RiskRecalculationLog
    from .services import calculate_entity_risk

    batch_id = uuid.uuid4()
    log = RiskRecalculationLog.objects.create(
        batch_id=batch_id, status=RecalculationStatus.RUNNING,
        triggered_by="celery:recalculate_high_risk_entities",
    )

    high_risk_entity_ids = (
        RiskAssessment.objects.filter(
            is_current=True, risk_level=RiskLevel.HIGH, entity__isnull=False,
        ).values_list("entity_id", flat=True).distinct()
    )

    from apps.core.models import Entity
    entities = Entity.objects.filter(id__in=high_risk_entity_ids)
    log.total_entities = entities.count()
    log.save(update_fields=["total_entities", "updated_at"])

    changed = 0
    recalculated = 0
    failed_ids = []

    try:
        for entity in entities.iterator():
            try:
                from . import selectors
                previous = selectors.get_current_entity_risk(entity_id=entity.id)
                previous_level = previous.risk_level if previous else None

                new_assessment = calculate_entity_risk(entity_id=entity.id, trigger=RiskTrigger.SCHEDULED)
                recalculated += 1
                if previous_level and previous_level != new_assessment.risk_level:
                    changed += 1
            except Exception:
                logger.exception("Failed to recalculate entity %s", entity.id)
                failed_ids.append(str(entity.id))

        if failed_ids:
            logger.warning(
                "High-risk recalculation batch %s had %d failures: %s",
                batch_id, len(failed_ids), failed_ids,
            )

        log.recalculated_count = recalculated
        log.changed_count = changed
        log.status = RecalculationStatus.COMPLETED
        log.completed_at = timezone.now()
        log.save(update_fields=["recalculated_count", "changed_count", "status", "completed_at", "updated_at"])
        logger.info("High-risk recalculation batch %s completed: %d recalculated, %d changed", batch_id, recalculated, changed)
        return {"batch_id": str(batch_id), "status": "completed", "recalculated": recalculated, "changed": changed, "failed_ids": failed_ids}
    except Exception as exc:
        log.recalculated_count = recalculated
        log.changed_count = changed
        log.status = RecalculationStatus.FAILED
        log.completed_at = timezone.now()
        log.save(update_fields=["recalculated_count", "changed_count", "status", "completed_at", "updated_at"])
        logger.exception("High-risk recalculation batch %s failed", batch_id)
        raise exc


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def process_worldcheck_webhook(self, payload: dict):
    """Process an incoming World-Check webhook notification."""
    from .constants import RiskTrigger, ScreeningStatus
    from .models import WorldCheckCase
    from .services import request_risk_recalculation

    try:
        case_system_id = payload.get("caseSystemId") or payload.get("caseId", "")
        event_type = payload.get("eventType", "")
        match_data = payload.get("matchData") or payload.get("results", {})

        if not case_system_id:
            logger.warning("World-Check webhook received without case ID: %s", payload)
            return {"status": "skipped", "reason": "no case ID in payload"}

        try:
            case = WorldCheckCase.objects.select_related("party__person").get(case_system_id=case_system_id)
        except WorldCheckCase.DoesNotExist:
            logger.warning("World-Check webhook for unknown case %s", case_system_id)
            return {"status": "skipped", "reason": "case not found"}

        if event_type in ("NEW_MATCH", "UPDATED_MATCH"):
            case.screening_status = ScreeningStatus.MATCHED
            case.match_data_json = match_data
            case.last_screened_at = timezone.now()
            case.save(update_fields=["screening_status", "match_data_json", "last_screened_at", "updated_at"])

            # Trigger recalculation for affected person and entities
            if case.party and case.party.person_id:
                request_risk_recalculation(person_id=case.party.person_id, trigger=RiskTrigger.WEBHOOK)
                from apps.core.models import EntityOfficer, ShareIssuance
                entity_ids = set()
                entity_ids.update(
                    EntityOfficer.objects.filter(officer_person_id=case.party.person_id).values_list("entity_id", flat=True)
                )
                entity_ids.update(
                    ShareIssuance.objects.filter(shareholder_person_id=case.party.person_id).values_list("share_class__entity_id", flat=True)
                )
                for eid in entity_ids:
                    request_risk_recalculation(entity_id=eid, trigger=RiskTrigger.WEBHOOK)

        elif event_type == "RESOLVED":
            resolution = payload.get("resolution", ScreeningStatus.CLEAR)
            case.screening_status = resolution
            case.last_screened_at = timezone.now()
            case.save(update_fields=["screening_status", "last_screened_at", "updated_at"])

        logger.info("World-Check webhook processed: case=%s event=%s", case_system_id, event_type)
        return {"status": "processed", "case_system_id": case_system_id, "event_type": event_type}
    except Exception as exc:
        logger.exception("World-Check webhook processing failed")
        raise self.retry(exc=exc)


@shared_task(soft_time_limit=3600, time_limit=3900)
def run_compliance_snapshot_task(snapshot_id: str):
    """Run a batch compliance snapshot, creating risk assessments for all entities and persons."""
    from .constants import RiskLevel, RiskTrigger, SnapshotStatus
    from .models import ComplianceSnapshot
    from .services import calculate_entity_risk, calculate_person_risk

    from apps.core.models import Entity, Person

    try:
        snapshot = ComplianceSnapshot.objects.get(id=snapshot_id)
    except ComplianceSnapshot.DoesNotExist:
        logger.error("ComplianceSnapshot %s not found", snapshot_id)
        return

    entities = Entity.objects.filter(status__in=["pending", "active"])
    persons = Person.objects.filter(status__in=["pending_approval", "approved"])

    snapshot.total_entities = entities.count()
    snapshot.total_persons = persons.count()
    snapshot.save(update_fields=["total_entities", "total_persons", "updated_at"])

    high = 0
    medium = 0
    low = 0
    failed_ids = []

    try:
        for entity in entities.iterator():
            try:
                assessment = calculate_entity_risk(
                    entity_id=entity.id, trigger=RiskTrigger.SCHEDULED, snapshot=snapshot,
                )
                if assessment.risk_level == RiskLevel.HIGH:
                    high += 1
                elif assessment.risk_level == RiskLevel.MEDIUM:
                    medium += 1
                else:
                    low += 1
            except Exception:
                logger.exception("Snapshot: failed entity %s", entity.id)
                failed_ids.append(f"entity:{entity.id}")

        for person in persons.iterator():
            try:
                assessment = calculate_person_risk(
                    person_id=person.id, trigger=RiskTrigger.SCHEDULED, snapshot=snapshot,
                )
                if assessment.risk_level == RiskLevel.HIGH:
                    high += 1
                elif assessment.risk_level == RiskLevel.MEDIUM:
                    medium += 1
                else:
                    low += 1
            except Exception:
                logger.exception("Snapshot: failed person %s", person.id)
                failed_ids.append(f"person:{person.id}")

        if failed_ids:
            logger.warning(
                "Compliance snapshot %s had %d failures",
                snapshot_id, len(failed_ids),
            )

        snapshot.high_risk_count = high
        snapshot.medium_risk_count = medium
        snapshot.low_risk_count = low
        snapshot.status = SnapshotStatus.COMPLETED
        snapshot.completed_at = timezone.now()
        snapshot.save(update_fields=[
            "high_risk_count", "medium_risk_count", "low_risk_count",
            "status", "completed_at", "updated_at",
        ])
        logger.info("Compliance snapshot %s completed: high=%d medium=%d low=%d", snapshot_id, high, medium, low)
    except Exception:
        snapshot.status = SnapshotStatus.FAILED
        snapshot.completed_at = timezone.now()
        snapshot.save(update_fields=["status", "completed_at", "updated_at"])
        logger.exception("Compliance snapshot %s failed", snapshot_id)
        raise


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def upload_document_to_sharepoint_async(self, document_upload_id: str, file_bytes_b64: str = ""):
    """Upload a document file to storage (SharePoint or local fallback)."""
    import base64

    from common.storage import get_storage_backend

    from .models import DocumentUpload

    try:
        doc = DocumentUpload.objects.get(id=document_upload_id)
    except DocumentUpload.DoesNotExist:
        logger.error("DocumentUpload %s not found", document_upload_id)
        return {"error": "DocumentUpload not found", "id": document_upload_id}

    if not file_bytes_b64:
        logger.error("No file content provided for DocumentUpload %s", document_upload_id)
        return {"error": "No file content", "id": document_upload_id}

    try:
        file_bytes = base64.b64decode(file_bytes_b64)
        storage = get_storage_backend()
        folder_parts = []
        if doc.kyc_submission_id:
            folder_parts.append(f"kyc/{doc.kyc_submission_id}")
        if doc.party_id:
            folder_parts.append(f"parties/{doc.party_id}")
        folder_path = "/".join(folder_parts) if folder_parts else "uploads"

        result = storage.upload(
            file_bytes=file_bytes, folder_path=folder_path, filename=doc.original_filename,
        )
        doc.sharepoint_file_id = result.get("id", "")
        doc.sharepoint_web_url = result.get("web_url", "")
        doc.sharepoint_drive_item_id = result.get("drive_item_id", result.get("id", ""))
        doc.save(update_fields=["sharepoint_file_id", "sharepoint_web_url", "sharepoint_drive_item_id", "updated_at"])
        logger.info("Document %s uploaded via %s: %s", document_upload_id, result.get("backend", "unknown"), doc.sharepoint_web_url)
        return {"status": "uploaded", "document_upload_id": document_upload_id, "web_url": doc.sharepoint_web_url}
    except Exception as exc:
        logger.exception("Document upload failed for DocumentUpload %s", document_upload_id)
        raise self.retry(exc=exc)


# ===========================================================================
# KYC Renewal Check
# ===========================================================================


@shared_task
def check_kyc_renewals():
    """Check for KYC submissions due for renewal based on JurisdictionConfig.

    Queries entities where last KYC approval + kyc_renewal_months < now,
    and dispatches notifications to assigned compliance officers.
    """
    from datetime import timedelta

    from django.db.models import Max

    from apps.core.models import Entity

    from .constants import KYCStatus
    from .models import JurisdictionConfig, KYCSubmission

    configs = JurisdictionConfig.objects.select_related("jurisdiction").all()
    renewal_count = 0

    for config in configs:
        jurisdiction_code = config.jurisdiction.country_code
        renewal_months = config.kyc_renewal_months or 12

        entities = Entity.objects.filter(
            jurisdiction__iexact=jurisdiction_code,
            status__in=["pending", "active"],
        )

        for entity in entities.iterator():
            # Find the most recent approved KYC
            last_approved = KYCSubmission.objects.filter(
                ticket__entity=entity,
                status=KYCStatus.APPROVED,
            ).aggregate(last=Max("reviewed_at"))["last"]

            if last_approved is None:
                continue

            renewal_due = last_approved + timedelta(days=renewal_months * 30)
            if renewal_due < timezone.now():
                # Send notification
                try:
                    from apps.authentication.models import User
                    from apps.notifications.services import send_notification

                    officers = User.objects.filter(role="compliance_officer")
                    for officer in officers:
                        send_notification(
                            recipient=officer,
                            template_key="kyc_renewal_due",
                            context={
                                "entity_name": entity.name,
                                "last_approved": last_approved.isoformat(),
                                "renewal_months": renewal_months,
                            },
                            action_url=f"/entities/{entity.id}",
                        )
                    renewal_count += 1
                except Exception:
                    logger.warning(
                        "Failed to send KYC renewal notification for entity %s",
                        entity.id, exc_info=True,
                    )

    logger.info("KYC renewal check completed: %d entities due for renewal", renewal_count)
    return {"renewals_due": renewal_count}


# ===========================================================================
# Scheduled Risk Recalculation (frequency-based)
# ===========================================================================


@shared_task
def scheduled_risk_recalculation():
    """Recalculate risk for entities based on their current risk level.

    High risk: recalc if last assessment > 12 months ago
    Medium risk: recalc if last assessment > 24 months ago
    Low risk: recalc if last assessment > 36 months ago
    """
    from datetime import timedelta

    from .constants import RecalculationStatus, RiskLevel, RiskTrigger
    from .models import RiskAssessment, RiskRecalculationLog
    from .services import calculate_entity_risk

    batch_id = uuid.uuid4()
    log = RiskRecalculationLog.objects.create(
        batch_id=batch_id, status=RecalculationStatus.RUNNING,
        triggered_by="celery:scheduled_risk_recalculation",
    )

    now = timezone.now()
    thresholds = {
        RiskLevel.HIGH: timedelta(days=365),
        RiskLevel.MEDIUM: timedelta(days=730),
        RiskLevel.LOW: timedelta(days=1095),
    }

    recalculated = 0
    changed = 0
    failed_ids = []

    try:
        for risk_level, max_age in thresholds.items():
            cutoff = now - max_age
            stale_assessments = RiskAssessment.objects.filter(
                is_current=True,
                risk_level=risk_level,
                entity__isnull=False,
                assessed_at__lt=cutoff,
            ).select_related("entity")

            for assessment in stale_assessments.iterator():
                try:
                    previous_level = assessment.risk_level
                    new_assessment = calculate_entity_risk(
                        entity_id=assessment.entity_id,
                        trigger=RiskTrigger.SCHEDULED,
                    )
                    recalculated += 1
                    if previous_level != new_assessment.risk_level:
                        changed += 1
                except Exception:
                    logger.exception(
                        "Scheduled recalc failed for entity %s",
                        assessment.entity_id,
                    )
                    failed_ids.append(str(assessment.entity_id))

        if failed_ids:
            logger.warning(
                "Scheduled risk recalculation %s had %d failures: %s",
                batch_id, len(failed_ids), failed_ids,
            )

        log.total_entities = recalculated
        log.recalculated_count = recalculated
        log.changed_count = changed
        log.status = RecalculationStatus.COMPLETED
        log.completed_at = timezone.now()
        log.save(update_fields=[
            "total_entities", "recalculated_count", "changed_count",
            "status", "completed_at", "updated_at",
        ])

        logger.info(
            "Scheduled risk recalculation %s completed: %d recalculated, %d changed",
            batch_id, recalculated, changed,
        )
        return {"batch_id": str(batch_id), "recalculated": recalculated, "changed": changed, "failed_ids": failed_ids}
    except Exception as exc:
        log.status = RecalculationStatus.FAILED
        log.completed_at = timezone.now()
        log.save(update_fields=["status", "completed_at", "updated_at"])
        logger.exception("Scheduled risk recalculation %s failed", batch_id)
        raise exc


# ===========================================================================
# ES PDF generation
# ===========================================================================


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_es_pdf_task(self, submission_id: str):
    """Generate PDF for a completed ES submission and send email."""
    from django.template.loader import render_to_string

    from .models import EconomicSubstanceSubmission

    try:
        sub = EconomicSubstanceSubmission.objects.select_related(
            "entity__client", "reviewed_by",
        ).get(id=submission_id)

        context = {
            "submission": sub,
            "entity": sub.entity,
            "flow_answers": sub.flow_answers,
            "shareholders_data": sub.shareholders_data,
            "fiscal_year": sub.fiscal_year,
        }

        html_content = render_to_string("compliance/es_report.html", context)

        from apps.documents.integrations.gotenberg import GotenbergClient
        client = GotenbergClient()
        pdf_bytes = client.convert_html_to_pdf(html_content)

        logger.info("ES PDF generated for submission %s (%d bytes)", submission_id, len(pdf_bytes))

        # Send notification
        try:
            from apps.notifications.services import send_notification
            from apps.authentication.models import User
            contacts = User.objects.filter(client=sub.entity.client)
            for contact in contacts:
                send_notification(
                    recipient=contact,
                    template_key="es_completed",
                    context={
                        "entity_name": sub.entity.name,
                        "fiscal_year": sub.fiscal_year,
                    },
                    action_url=f"/economic-substance/{sub.id}",
                )
        except Exception:
            logger.warning("Failed to send ES completion notification", exc_info=True)

        return {"status": "completed", "submission_id": submission_id}
    except Exception as exc:
        logger.exception("ES PDF generation failed for %s", submission_id)
        raise self.retry(exc=exc)


# ===========================================================================
# Accounting Record PDF generation
# ===========================================================================


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_accounting_record_pdf_task(self, record_id: str):
    """Generate PDF for a submitted accounting record."""
    from .services import generate_accounting_record_pdf, send_accounting_completion_email

    try:
        generate_accounting_record_pdf(record_id=record_id)
        send_accounting_completion_email(record_id=record_id)
        logger.info("Accounting record PDF generated and email sent: %s", record_id)
        return {"status": "completed", "record_id": record_id}
    except Exception as exc:
        logger.exception("Accounting record PDF generation failed for %s", record_id)
        raise self.retry(exc=exc)
