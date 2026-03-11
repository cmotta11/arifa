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


@shared_task
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

    changed = 0
    recalculated = 0

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

        log.recalculated_count = recalculated
        log.changed_count = changed
        log.status = RecalculationStatus.COMPLETED
        log.completed_at = timezone.now()
        log.save(update_fields=["recalculated_count", "changed_count", "status", "completed_at", "updated_at"])

        logger.info("Risk recalculation batch %s completed: %d recalculated, %d changed", batch_id, recalculated, changed)
        return {"batch_id": str(batch_id), "status": "completed", "recalculated": recalculated, "changed": changed}
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

        log.recalculated_count = recalculated
        log.changed_count = changed
        log.status = RecalculationStatus.COMPLETED
        log.completed_at = timezone.now()
        log.save(update_fields=["recalculated_count", "changed_count", "status", "completed_at", "updated_at"])
        logger.info("High-risk recalculation batch %s completed: %d recalculated, %d changed", batch_id, recalculated, changed)
        return {"batch_id": str(batch_id), "status": "completed", "recalculated": recalculated, "changed": changed}
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


@shared_task
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


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def upload_document_to_sharepoint_async(self, document_upload_id: str):
    """Upload a document file to SharePoint via the Graph API."""
    from .integrations.sharepoint import SharePointClient
    from .models import DocumentUpload

    try:
        doc = DocumentUpload.objects.get(id=document_upload_id)
    except DocumentUpload.DoesNotExist:
        logger.error("DocumentUpload %s not found", document_upload_id)
        return {"error": "DocumentUpload not found", "id": document_upload_id}

    try:
        sp_client = SharePointClient()
        folder_parts = []
        if doc.kyc_submission_id:
            folder_parts.append(f"kyc/{doc.kyc_submission_id}")
        if doc.party_id:
            folder_parts.append(f"parties/{doc.party_id}")
        folder_path = "/".join(folder_parts) if folder_parts else "uploads"

        result = sp_client.upload_document(
            file_bytes=b"", folder_path=folder_path, filename=doc.original_filename,
        )
        doc.sharepoint_file_id = result.get("id", "")
        doc.sharepoint_web_url = result.get("webUrl", "")
        doc.sharepoint_drive_item_id = result.get("driveItemId", "")
        doc.save(update_fields=["sharepoint_file_id", "sharepoint_web_url", "sharepoint_drive_item_id", "updated_at"])
        logger.info("Document %s uploaded to SharePoint: %s", document_upload_id, doc.sharepoint_web_url)
        return {"status": "uploaded", "document_upload_id": document_upload_id, "sharepoint_web_url": doc.sharepoint_web_url}
    except Exception as exc:
        logger.exception("SharePoint upload failed for DocumentUpload %s", document_upload_id)
        raise self.retry(exc=exc)
