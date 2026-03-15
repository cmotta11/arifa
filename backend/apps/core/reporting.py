"""Reporting views for financial summary and user activity."""

from datetime import timedelta

from django.db.models import Count, F, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsStaffRole, STAFF_ROLES


class FinancialSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsStaffRole]

    @extend_schema(
        summary="Financial summary report",
        parameters=[
            OpenApiParameter(name="period", type=str, required=False),
            OpenApiParameter(name="jurisdiction", type=str, required=False),
        ],
    )
    def get(self, request):
        from apps.services_platform.models import ExpenseRecord, Quotation

        period = request.query_params.get("period", "this_year")
        jurisdiction = request.query_params.get("jurisdiction")

        now = timezone.now()

        if period == "this_month":
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif period == "this_quarter":
            quarter_month = ((now.month - 1) // 3) * 3 + 1
            start_date = now.replace(
                month=quarter_month, day=1, hour=0, minute=0, second=0, microsecond=0
            )
        elif period == "custom":
            date_from = request.query_params.get("date_from")
            if date_from:
                from datetime import datetime

                try:
                    start_date = timezone.make_aware(
                        datetime.strptime(date_from, "%Y-%m-%d")
                    )
                except ValueError:
                    return Response(
                        {"detail": "Invalid date format. Use YYYY-MM-DD."},
                        status=400,
                    )
            else:
                start_date = now.replace(
                    month=1, day=1, hour=0, minute=0, second=0, microsecond=0
                )
        else:
            # this_year
            start_date = now.replace(
                month=1, day=1, hour=0, minute=0, second=0, microsecond=0
            )

        # Quotations accepted (revenue)
        quotation_qs = Quotation.objects.filter(
            status="accepted",
            accepted_at__gte=start_date,
        )
        if jurisdiction:
            quotation_qs = quotation_qs.filter(
                service_request__jurisdiction__country_name__icontains=jurisdiction
            )

        revenue_agg = quotation_qs.aggregate(total=Sum("total"))
        total_revenue = float(revenue_agg["total"] or 0)

        # Expenses
        expense_qs = ExpenseRecord.objects.filter(created_at__gte=start_date)
        if jurisdiction:
            expense_qs = expense_qs.filter(
                entity__jurisdiction__icontains=jurisdiction
            )

        expense_agg = expense_qs.aggregate(total=Sum("amount"))
        total_expenses = float(expense_agg["total"] or 0)

        net_income = total_revenue - total_expenses

        # Pending invoices (quotations sent but not accepted/rejected)
        pending_qs = Quotation.objects.filter(status="sent")
        if jurisdiction:
            pending_qs = pending_qs.filter(
                service_request__jurisdiction__country_name__icontains=jurisdiction
            )
        pending_agg = pending_qs.aggregate(
            count=Count("id"), amount=Sum("total")
        )

        # By jurisdiction
        by_jurisdiction_revenue = (
            quotation_qs.values(
                jurisdiction_name=F(
                    "service_request__jurisdiction__country_name"
                )
            )
            .annotate(revenue=Sum("total"))
            .order_by("-revenue")
        )
        by_jurisdiction_expense = (
            expense_qs.filter(entity__isnull=False)
            .values(jurisdiction_name=F("entity__jurisdiction"))
            .annotate(expenses=Sum("amount"))
            .order_by("-expenses")
        )

        jurisdiction_map: dict = {}
        for row in by_jurisdiction_revenue:
            name = row["jurisdiction_name"] or "Unknown"
            jurisdiction_map.setdefault(name, {"revenue": 0, "expenses": 0})
            jurisdiction_map[name]["revenue"] = float(row["revenue"] or 0)
        for row in by_jurisdiction_expense:
            name = row["jurisdiction_name"] or "Unknown"
            jurisdiction_map.setdefault(name, {"revenue": 0, "expenses": 0})
            jurisdiction_map[name]["expenses"] = float(row["expenses"] or 0)

        by_jurisdiction = [
            {"jurisdiction": k, "revenue": v["revenue"], "expenses": v["expenses"]}
            for k, v in jurisdiction_map.items()
        ]

        # By month
        by_month_revenue = (
            quotation_qs.annotate(month=TruncMonth("accepted_at"))
            .values("month")
            .annotate(revenue=Sum("total"))
            .order_by("month")
        )
        by_month_expense = (
            expense_qs.annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(expenses=Sum("amount"))
            .order_by("month")
        )

        month_map: dict = {}
        for row in by_month_revenue:
            key = row["month"].strftime("%Y-%m") if row["month"] else "Unknown"
            month_map.setdefault(key, {"revenue": 0, "expenses": 0})
            month_map[key]["revenue"] = float(row["revenue"] or 0)
        for row in by_month_expense:
            key = row["month"].strftime("%Y-%m") if row["month"] else "Unknown"
            month_map.setdefault(key, {"revenue": 0, "expenses": 0})
            month_map[key]["expenses"] = float(row["expenses"] or 0)

        by_month = [
            {"month": k, "revenue": v["revenue"], "expenses": v["expenses"]}
            for k, v in sorted(month_map.items())
        ]

        return Response(
            {
                "total_revenue": total_revenue,
                "total_expenses": total_expenses,
                "net_income": net_income,
                "pending_invoices": pending_agg["count"] or 0,
                "pending_amount": float(pending_agg["amount"] or 0),
                "by_jurisdiction": by_jurisdiction,
                "by_month": by_month,
            }
        )


class UserActivityReportView(APIView):
    permission_classes = [IsAuthenticated, IsStaffRole]

    @extend_schema(
        summary="User activity report",
        parameters=[
            OpenApiParameter(name="date_from", type=str, required=False),
            OpenApiParameter(name="date_to", type=str, required=False),
        ],
    )
    def get(self, request):
        from apps.authentication.models import User
        from apps.workflow.models import Ticket, TicketLog, WorkflowState

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        now = timezone.now()

        if date_from:
            from datetime import datetime

            try:
                start_date = timezone.make_aware(
                    datetime.strptime(date_from, "%Y-%m-%d")
                )
            except ValueError:
                return Response(
                    {"detail": "Invalid date format. Use YYYY-MM-DD."},
                    status=400,
                )
        else:
            start_date = now - timedelta(days=30)

        if date_to:
            from datetime import datetime

            try:
                end_date = timezone.make_aware(
                    datetime.strptime(date_to, "%Y-%m-%d")
                ) + timedelta(days=1)
            except ValueError:
                return Response(
                    {"detail": "Invalid date format. Use YYYY-MM-DD."},
                    status=400,
                )
        else:
            end_date = now

        # Staff users only
        staff_users = User.objects.filter(
            role__in=list(STAFF_ROLES), is_active=True
        )

        # Get final states for computing completed tickets
        final_state_ids = list(
            WorkflowState.objects.filter(is_final=True).values_list("id", flat=True)
        )

        user_data = []
        for user in staff_users:
            # Count ticket log entries (transitions) by this user in period
            tickets_completed = TicketLog.objects.filter(
                changed_by=user,
                new_state_id__in=final_state_ids,
                created_at__gte=start_date,
                created_at__lt=end_date,
            ).count()

            # Average processing days: tickets completed by user
            completed_tickets = Ticket.objects.filter(
                current_state__is_final=True,
                assigned_to=user,
                updated_at__gte=start_date,
                updated_at__lt=end_date,
            )
            avg_days = None
            if completed_tickets.exists():
                total_days = sum(
                    (t.updated_at - t.created_at).total_seconds() / 86400
                    for t in completed_tickets
                )
                avg_days = round(total_days / completed_tickets.count(), 1)

            # Last active
            last_log = (
                TicketLog.objects.filter(changed_by=user)
                .order_by("-created_at")
                .first()
            )
            last_active = (
                last_log.created_at.isoformat() if last_log else user.last_login.isoformat() if user.last_login else None
            )

            user_data.append(
                {
                    "id": str(user.id),
                    "name": f"{user.first_name} {user.last_name}".strip()
                    or user.email,
                    "role": user.role,
                    "tickets_completed": tickets_completed,
                    "avg_processing_days": avg_days,
                    "last_active": last_active,
                }
            )

        # Sort by tickets completed descending
        user_data.sort(key=lambda u: u["tickets_completed"], reverse=True)

        # Role breakdown
        by_role: dict = {}
        for u in user_data:
            by_role[u["role"]] = by_role.get(u["role"], 0) + 1

        # Total active (had activity in period)
        active_user_ids = (
            TicketLog.objects.filter(
                created_at__gte=start_date,
                created_at__lt=end_date,
                changed_by__isnull=False,
            )
            .values_list("changed_by", flat=True)
            .distinct()
        )
        total_active_users = len(set(active_user_ids))

        return Response(
            {
                "users": user_data,
                "total_active_users": total_active_users,
                "by_role": by_role,
            }
        )
