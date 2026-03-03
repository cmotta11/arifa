import logging
import uuid

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def extract_document_data(self, document_upload_id: str):
    """Call the LLM extraction integration and update the DocumentUpload record.

    Marks status as PROCESSING while running, then COMPLETED or FAILED.
    """
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

    try:
        client = LLMExtractionClient()
        # In production, we would read the actual file bytes from SharePoint
        # or a temporary storage location. For now, we pass empty bytes
        # to the extraction client.
        extraction_result = client.extract_from_image(
            image_bytes=b"",
            document_type=doc.document_type,
        )

        doc.llm_extraction_json = extraction_result
        doc.llm_extraction_status = LLMExtractionStatus.COMPLETED
        doc.save(update_fields=[
            "llm_extraction_json",
            "llm_extraction_status",
            "updated_at",
        ])

        logger.info(
            "LLM extraction completed for DocumentUpload %s", document_upload_id
        )
        return {
            "status": "completed",
            "document_upload_id": document_upload_id,
            "extraction_keys": list(extraction_result.keys()),
        }

    except Exception as exc:
        doc.llm_extraction_status = LLMExtractionStatus.FAILED
        doc.llm_extraction_json = {"error": str(exc)}
        doc.save(update_fields=[
            "llm_extraction_json",
            "llm_extraction_status",
            "updated_at",
        ])
        logger.exception(
            "LLM extraction failed for DocumentUpload %s", document_upload_id
        )
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def screen_party_worldcheck(self, party_id: str):
    """Screen a party against World-Check One and create/update a WorldCheckCase."""
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
            name=party.name,
            entity_type=entity_type,
            date_of_birth=str(party.date_of_birth) if party.date_of_birth else None,
            nationality=party.nationality or None,
            country_of_residence=party.country_of_residence or None,
        )

        # Determine screening status from results
        case_system_id = result.get("caseSystemId", "")
        results_list = result.get("results", [])

        if results_list:
            screening_status = ScreeningStatus.MATCHED
        else:
            screening_status = ScreeningStatus.CLEAR

        # Create or update the WorldCheckCase
        case, _created = WorldCheckCase.objects.update_or_create(
            party=party,
            case_system_id=case_system_id,
            defaults={
                "screening_status": screening_status,
                "last_screened_at": timezone.now(),
                "match_data_json": result,
            },
        )

        logger.info(
            "World-Check screening completed for party %s: status=%s, case=%s",
            party_id,
            screening_status,
            case.id,
        )
        return {
            "status": "completed",
            "party_id": party_id,
            "screening_status": screening_status,
            "case_id": str(case.id),
            "matches_found": len(results_list),
        }

    except Exception as exc:
        logger.exception("World-Check screening failed for party %s", party_id)
        raise self.retry(exc=exc)


@shared_task
def recalculate_all_risks():
    """Iterate all active KYC submissions and recalculate risk scores.

    Creates a RiskRecalculationLog entry to track the batch run.
    """
    from .constants import KYCStatus, RecalculationStatus, RiskTrigger
    from .models import KYCSubmission, RiskRecalculationLog
    from .services import calculate_risk_score

    batch_id = uuid.uuid4()
    log = RiskRecalculationLog.objects.create(
        batch_id=batch_id,
        status=RecalculationStatus.RUNNING,
        triggered_by="celery:recalculate_all_risks",
    )

    active_statuses = [
        KYCStatus.SUBMITTED,
        KYCStatus.UNDER_REVIEW,
        KYCStatus.APPROVED,
    ]
    submissions = KYCSubmission.objects.filter(status__in=active_statuses)
    log.total_entities = submissions.count()
    log.save(update_fields=["total_entities", "updated_at"])

    changed = 0
    recalculated = 0

    try:
        for kyc in submissions.iterator():
            # Get current assessment before recalculation
            from . import selectors

            previous = selectors.get_current_risk_assessment(kyc_id=kyc.id)
            previous_level = previous.risk_level if previous else None

            new_assessment = calculate_risk_score(
                kyc_id=kyc.id, trigger=RiskTrigger.SCHEDULED
            )
            recalculated += 1

            if previous_level and previous_level != new_assessment.risk_level:
                changed += 1

        log.recalculated_count = recalculated
        log.changed_count = changed
        log.status = RecalculationStatus.COMPLETED
        log.completed_at = timezone.now()
        log.save(update_fields=[
            "recalculated_count",
            "changed_count",
            "status",
            "completed_at",
            "updated_at",
        ])

        logger.info(
            "Risk recalculation batch %s completed: %d/%d recalculated, %d changed",
            batch_id,
            recalculated,
            log.total_entities,
            changed,
        )
        return {
            "batch_id": str(batch_id),
            "status": "completed",
            "recalculated": recalculated,
            "changed": changed,
        }

    except Exception as exc:
        log.recalculated_count = recalculated
        log.changed_count = changed
        log.status = RecalculationStatus.FAILED
        log.completed_at = timezone.now()
        log.save(update_fields=[
            "recalculated_count",
            "changed_count",
            "status",
            "completed_at",
            "updated_at",
        ])
        logger.exception("Risk recalculation batch %s failed", batch_id)
        raise exc


@shared_task
def recalculate_high_risk_entities():
    """Recalculate risk scores only for KYC submissions currently rated HIGH."""
    from .constants import KYCStatus, RecalculationStatus, RiskLevel, RiskTrigger
    from .models import KYCSubmission, RiskAssessment, RiskRecalculationLog
    from .services import calculate_risk_score

    batch_id = uuid.uuid4()
    log = RiskRecalculationLog.objects.create(
        batch_id=batch_id,
        status=RecalculationStatus.RUNNING,
        triggered_by="celery:recalculate_high_risk_entities",
    )

    # Find KYC submissions with current high-risk assessment
    high_risk_kyc_ids = (
        RiskAssessment.objects.filter(
            is_current=True,
            risk_level=RiskLevel.HIGH,
            kyc_submission__status__in=[
                KYCStatus.SUBMITTED,
                KYCStatus.UNDER_REVIEW,
                KYCStatus.APPROVED,
            ],
        )
        .values_list("kyc_submission_id", flat=True)
    )

    submissions = KYCSubmission.objects.filter(id__in=high_risk_kyc_ids)
    log.total_entities = submissions.count()
    log.save(update_fields=["total_entities", "updated_at"])

    changed = 0
    recalculated = 0

    try:
        for kyc in submissions.iterator():
            from . import selectors

            previous = selectors.get_current_risk_assessment(kyc_id=kyc.id)
            previous_level = previous.risk_level if previous else None

            new_assessment = calculate_risk_score(
                kyc_id=kyc.id, trigger=RiskTrigger.SCHEDULED
            )
            recalculated += 1

            if previous_level and previous_level != new_assessment.risk_level:
                changed += 1

        log.recalculated_count = recalculated
        log.changed_count = changed
        log.status = RecalculationStatus.COMPLETED
        log.completed_at = timezone.now()
        log.save(update_fields=[
            "recalculated_count",
            "changed_count",
            "status",
            "completed_at",
            "updated_at",
        ])

        logger.info(
            "High-risk recalculation batch %s completed: %d/%d recalculated, %d changed",
            batch_id,
            recalculated,
            log.total_entities,
            changed,
        )
        return {
            "batch_id": str(batch_id),
            "status": "completed",
            "recalculated": recalculated,
            "changed": changed,
        }

    except Exception as exc:
        log.recalculated_count = recalculated
        log.changed_count = changed
        log.status = RecalculationStatus.FAILED
        log.completed_at = timezone.now()
        log.save(update_fields=[
            "recalculated_count",
            "changed_count",
            "status",
            "completed_at",
            "updated_at",
        ])
        logger.exception("High-risk recalculation batch %s failed", batch_id)
        raise exc


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def process_worldcheck_webhook(self, payload: dict):
    """Process an incoming World-Check webhook notification.

    The payload typically contains updates about ongoing monitoring cases.
    """
    from .constants import RiskTrigger, ScreeningStatus
    from .models import WorldCheckCase
    from .services import calculate_risk_score

    try:
        case_system_id = payload.get("caseSystemId") or payload.get("caseId", "")
        event_type = payload.get("eventType", "")
        match_data = payload.get("matchData") or payload.get("results", {})

        if not case_system_id:
            logger.warning("World-Check webhook received without case ID: %s", payload)
            return {"status": "skipped", "reason": "no case ID in payload"}

        try:
            case = WorldCheckCase.objects.select_related("party__kyc_submission").get(
                case_system_id=case_system_id
            )
        except WorldCheckCase.DoesNotExist:
            logger.warning(
                "World-Check webhook for unknown case %s", case_system_id
            )
            return {"status": "skipped", "reason": "case not found"}

        # Update the case based on event type
        if event_type in ("NEW_MATCH", "UPDATED_MATCH"):
            case.screening_status = ScreeningStatus.MATCHED
            case.match_data_json = match_data
            case.last_screened_at = timezone.now()
            case.save(update_fields=[
                "screening_status",
                "match_data_json",
                "last_screened_at",
                "updated_at",
            ])

            # Trigger risk recalculation for the affected KYC
            if case.party and case.party.kyc_submission_id:
                calculate_risk_score(
                    kyc_id=case.party.kyc_submission_id,
                    trigger=RiskTrigger.WEBHOOK,
                )

        elif event_type == "RESOLVED":
            resolution = payload.get("resolution", ScreeningStatus.CLEAR)
            case.screening_status = resolution
            case.last_screened_at = timezone.now()
            case.save(update_fields=[
                "screening_status",
                "last_screened_at",
                "updated_at",
            ])

        logger.info(
            "World-Check webhook processed: case=%s event=%s",
            case_system_id,
            event_type,
        )
        return {
            "status": "processed",
            "case_system_id": case_system_id,
            "event_type": event_type,
        }

    except Exception as exc:
        logger.exception("World-Check webhook processing failed")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def upload_document_to_sharepoint_async(self, document_upload_id: str):
    """Upload a document file to SharePoint via the Graph API.

    Updates the DocumentUpload record with the SharePoint file metadata.
    """
    from .integrations.sharepoint import SharePointClient
    from .models import DocumentUpload

    try:
        doc = DocumentUpload.objects.get(id=document_upload_id)
    except DocumentUpload.DoesNotExist:
        logger.error("DocumentUpload %s not found", document_upload_id)
        return {"error": "DocumentUpload not found", "id": document_upload_id}

    try:
        sp_client = SharePointClient()

        # Build the folder path based on KYC submission or party
        folder_parts = []
        if doc.kyc_submission_id:
            folder_parts.append(f"kyc/{doc.kyc_submission_id}")
        if doc.party_id:
            folder_parts.append(f"parties/{doc.party_id}")
        folder_path = "/".join(folder_parts) if folder_parts else "uploads"

        # In production the actual file bytes would be read from temp storage.
        # For now we pass empty bytes; the SharePointClient handles the upload.
        result = sp_client.upload_document(
            file_bytes=b"",
            folder_path=folder_path,
            filename=doc.original_filename,
        )

        doc.sharepoint_file_id = result.get("id", "")
        doc.sharepoint_web_url = result.get("webUrl", "")
        doc.sharepoint_drive_item_id = result.get("driveItemId", "")
        doc.save(update_fields=[
            "sharepoint_file_id",
            "sharepoint_web_url",
            "sharepoint_drive_item_id",
            "updated_at",
        ])

        logger.info(
            "Document %s uploaded to SharePoint: %s",
            document_upload_id,
            doc.sharepoint_web_url,
        )
        return {
            "status": "uploaded",
            "document_upload_id": document_upload_id,
            "sharepoint_web_url": doc.sharepoint_web_url,
        }

    except Exception as exc:
        logger.exception(
            "SharePoint upload failed for DocumentUpload %s", document_upload_id
        )
        raise self.retry(exc=exc)
