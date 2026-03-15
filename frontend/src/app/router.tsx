import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { ROUTES } from "@/config/routes";
import { AppLayout } from "@/features/shell/app-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { ClientProtectedRoute } from "@/components/layout/client-protected-route";
import { Spinner } from "@/components/ui/spinner";

const LoginPage = lazy(() => import("@/features/auth/pages/login-page"));
const DashboardPage = lazy(
  () => import("@/features/dashboard/pages/dashboard-page"),
);
const TicketsPage = lazy(
  () => import("@/features/tickets/pages/tickets-page"),
);
const TicketDetailPage = lazy(
  () => import("@/features/tickets/pages/ticket-detail-page"),
);
const GuestIntakePage = lazy(
  () => import("@/features/guest-intake/guest-intake-page"),
);
const KYCListPage = lazy(
  () => import("@/features/kyc/pages/kyc-list-page"),
);
const KYCNewPage = lazy(
  () => import("@/features/kyc/pages/kyc-new-page"),
);
const KYCDetailPage = lazy(
  () => import("@/features/kyc/pages/kyc-detail-page"),
);
const ComplianceDashboardPage = lazy(
  () => import("@/features/compliance/pages/compliance-dashboard-page"),
);
const DocumentsPage = lazy(
  () => import("@/features/documents/pages/documents-page"),
);
const AdminPage = lazy(
  () => import("@/features/admin/pages/admin-page"),
);
const RiskMatrixConfigPage = lazy(
  () => import("@/features/compliance/pages/risk-matrix-config-page"),
);
const RiskMatrixConfigDetailPage = lazy(
  () => import("@/features/compliance/pages/risk-matrix-config-detail-page"),
);
const SnapshotsPage = lazy(
  () => import("@/features/compliance/pages/snapshots-page"),
);
const ClientsListPage = lazy(
  () => import("@/features/clients/pages/clients-list-page"),
);
const ClientDetailPage = lazy(
  () => import("@/features/clients/pages/client-detail-page"),
);
const EntitiesListPage = lazy(
  () => import("@/features/entities/pages/entities-list-page"),
);
const EntityDetailPage = lazy(
  () => import("@/features/entities/pages/entity-detail-page"),
);
const PeopleListPage = lazy(
  () => import("@/features/people/pages/people-list-page"),
);
const PersonDetailPage = lazy(
  () => import("@/features/people/pages/person-detail-page"),
);

// Client Portal
const PortalDashboard = lazy(
  () => import("@/features/client-portal/pages/portal-dashboard"),
);
const PortalKYCDetail = lazy(
  () => import("@/features/client-portal/pages/portal-kyc-detail"),
);
const PortalEntitiesPage = lazy(
  () => import("@/features/client-portal/pages/portal-entities-page"),
);
const PortalEntityDetailPage = lazy(
  () => import("@/features/client-portal/pages/portal-entity-detail-page"),
);
const PortalServiceTrackingPage = lazy(
  () => import("@/features/client-portal/pages/portal-service-tracking-page"),
);
const PortalNotificationsPage = lazy(
  () => import("@/features/client-portal/pages/portal-notifications-page"),
);
const PortalProfilePage = lazy(
  () => import("@/features/client-portal/pages/portal-profile-page"),
);
const PortalLayout = lazy(
  () => import("@/features/client-portal/components/portal-layout").then(m => ({ default: m.PortalLayout })),
);

// Client Login
const ClientLoginPage = lazy(
  () => import("@/features/auth/pages/client-login-page"),
);

// Magic Link Login
const MagicLoginPage = lazy(
  () => import("@/features/auth/pages/magic-login-page"),
);

// Onboarding
const OnboardingPage = lazy(
  () => import("@/features/onboarding/pages/onboarding-page"),
);

// RPA
const RPAJobsPage = lazy(
  () => import("@/features/rpa/pages/rpa-jobs-page"),
);
const RPAJobDetailPage = lazy(
  () => import("@/features/rpa/pages/rpa-job-detail-page"),
);

// Notifications
const NotificationPreferencesPage = lazy(
  () => import("@/features/notifications/pages/notification-preferences-page"),
);

// Economic Substance
const ESListPage = lazy(
  () => import("@/features/economic-substance/pages/es-list-page"),
);
const ESDetailPage = lazy(
  () => import("@/features/economic-substance/pages/es-detail-page"),
);
const ESGuestPage = lazy(
  () => import("@/features/economic-substance/pages/es-guest-page"),
);

// Due Diligence
const DueDiligenceDashboardPage = lazy(
  () => import("@/features/compliance/pages/due-diligence-dashboard-page"),
);

// Risk Dashboard
const RiskDashboardPage = lazy(
  () => import("@/features/compliance/pages/risk-dashboard-page"),
);

// Risk Assessment Detail
const RiskAssessmentDetailPage = lazy(
  () => import("@/features/compliance/pages/risk-assessment-detail-page"),
);

// Compliance Overview
const ComplianceOverviewPage = lazy(
  () => import("@/features/compliance/pages/compliance-overview-page"),
);

// Shareholders Calculator
const ShareholdersCalculatorPage = lazy(
  () => import("@/features/shareholders-calculator/pages/shareholders-calculator-page"),
);

// Services Platform
const ServiceRequestPage = lazy(
  () => import("@/features/services/pages/service-request-page"),
);
const QuotationDetailPage = lazy(
  () => import("@/features/services/pages/quotation-detail-page"),
);
const ExpenseTrackerPage = lazy(
  () => import("@/features/services/pages/expense-tracker-page"),
);

// Incorporation Workflow
const IncDashboardPage = lazy(
  () => import("@/features/incorporation/pages/inc-dashboard-page"),
);
const IncReportsPage = lazy(
  () => import("@/features/incorporation/pages/inc-reports-page"),
);
const GestoraDashboardPage = lazy(
  () => import("@/features/incorporation/pages/gestora-dashboard-page"),
);
const PaymentTrackingPage = lazy(
  () => import("@/features/incorporation/pages/payment-tracking-page"),
);

// Courier / Archive
const CourierArchivePage = lazy(
  () => import("@/features/courier/pages/courier-archive-page"),
);

// Reports
const ReportsHubPage = lazy(
  () => import("@/features/reports/pages/reports-hub-page"),
);
const FinancialDashboardPage = lazy(
  () => import("@/features/reports/pages/financial-dashboard-page"),
);
const UserActivityPage = lazy(
  () => import("@/features/reports/pages/user-activity-page"),
);

// Registros Contables
const RegistrosContablesListPage = lazy(
  () => import("@/features/registros-contables/pages/registros-contables-list-page"),
);
const RegistrosContablesDetailPage = lazy(
  () => import("@/features/registros-contables/pages/registros-contables-detail-page"),
);
const RegistrosContablesGuestPage = lazy(
  () => import("@/features/registros-contables/pages/registros-contables-guest-page"),
);
const RegistrosContablesPrintPage = lazy(
  () => import("@/features/registros-contables/pages/registros-contables-print-page"),
);

function LoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes - keep Suspense here since no shared layout */}
        <Route
          path={ROUTES.LOGIN}
          element={
            <Suspense fallback={<LoadingFallback />}>
              <LoginPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.CLIENT_LOGIN}
          element={
            <Suspense fallback={<LoadingFallback />}>
              <ClientLoginPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.GUEST_INTAKE}
          element={
            <Suspense fallback={<LoadingFallback />}>
              <GuestIntakePage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.ONBOARDING}
          element={
            <Suspense fallback={<LoadingFallback />}>
              <OnboardingPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.MAGIC_LOGIN}
          element={
            <Suspense fallback={<LoadingFallback />}>
              <MagicLoginPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.REGISTROS_CONTABLES_GUEST}
          element={
            <Suspense fallback={<LoadingFallback />}>
              <RegistrosContablesGuestPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.REGISTROS_CONTABLES_PRINT}
          element={
            <Suspense fallback={<LoadingFallback />}>
              <RegistrosContablesPrintPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.ECONOMIC_SUBSTANCE_GUEST}
          element={
            <Suspense fallback={<LoadingFallback />}>
              <ESGuestPage />
            </Suspense>
          }
        />

        {/* Client portal routes */}
        <Route
          element={
            <ClientProtectedRoute>
              <Suspense fallback={<LoadingFallback />}>
                <PortalLayout />
              </Suspense>
            </ClientProtectedRoute>
          }
        >
          <Route path={ROUTES.CLIENT_PORTAL} element={<PortalDashboard />} />
          <Route
            path={ROUTES.CLIENT_PORTAL_KYC_DETAIL}
            element={<PortalKYCDetail />}
          />
          <Route path={ROUTES.CLIENT_PORTAL_ENTITIES} element={<PortalEntitiesPage />} />
          <Route path={ROUTES.CLIENT_PORTAL_ENTITY_DETAIL} element={<PortalEntityDetailPage />} />
          <Route path={ROUTES.CLIENT_PORTAL_SERVICES} element={<PortalServiceTrackingPage />} />
          <Route path={ROUTES.CLIENT_PORTAL_NOTIFICATIONS} element={<PortalNotificationsPage />} />
          <Route path={ROUTES.CLIENT_PORTAL_PROFILE} element={<PortalProfilePage />} />
        </Route>

        {/* Protected routes - Suspense is inside AppLayout wrapping Outlet */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
          <Route path={ROUTES.CLIENTS} element={<ClientsListPage />} />
          <Route path={ROUTES.CLIENT_DETAIL} element={<ClientDetailPage />} />
          <Route path={ROUTES.ENTITIES} element={<EntitiesListPage />} />
          <Route path={ROUTES.ENTITY_DETAIL} element={<EntityDetailPage />} />
          <Route path={ROUTES.PEOPLE} element={<PeopleListPage />} />
          <Route path={ROUTES.PERSON_DETAIL} element={<PersonDetailPage />} />
          <Route path={ROUTES.TICKETS} element={<TicketsPage />} />
          <Route
            path={ROUTES.TICKET_DETAIL}
            element={<TicketDetailPage />}
          />
          <Route path={ROUTES.KYC} element={<KYCListPage />} />
          <Route path={ROUTES.KYC_NEW} element={<KYCNewPage />} />
          <Route path={ROUTES.KYC_DETAIL} element={<KYCDetailPage />} />
          <Route
            path={ROUTES.COMPLIANCE}
            element={<ComplianceDashboardPage />}
          />
          <Route path={ROUTES.DOCUMENTS} element={<DocumentsPage />} />
          <Route path={ROUTES.RISK_MATRIX} element={<RiskMatrixConfigPage />} />
          <Route path={ROUTES.RISK_MATRIX_DETAIL} element={<RiskMatrixConfigDetailPage />} />
          <Route path={ROUTES.COMPLIANCE_SNAPSHOTS} element={<SnapshotsPage />} />
          <Route path={ROUTES.REGISTROS_CONTABLES} element={<RegistrosContablesListPage />} />
          <Route path={ROUTES.REGISTROS_CONTABLES_DETAIL} element={<RegistrosContablesDetailPage />} />
          <Route path={ROUTES.ECONOMIC_SUBSTANCE} element={<ESListPage />} />
          <Route path={ROUTES.ECONOMIC_SUBSTANCE_DETAIL} element={<ESDetailPage />} />
          <Route path={ROUTES.DUE_DILIGENCE} element={<DueDiligenceDashboardPage />} />
          <Route path={ROUTES.RISK_DASHBOARD} element={<RiskDashboardPage />} />
          <Route path={ROUTES.RISK_ASSESSMENT_DETAIL} element={<RiskAssessmentDetailPage />} />
          <Route path={ROUTES.SHAREHOLDERS_CALCULATOR} element={<ShareholdersCalculatorPage />} />
          <Route path={ROUTES.COMPLIANCE_OVERVIEW} element={<ComplianceOverviewPage />} />
          <Route path={ROUTES.SERVICE_REQUESTS} element={<ServiceRequestPage />} />
          <Route path={ROUTES.SERVICE_REQUEST_DETAIL} element={<ServiceRequestPage />} />
          <Route path={ROUTES.QUOTATION_DETAIL} element={<QuotationDetailPage />} />
          <Route path={ROUTES.EXPENSES} element={<ExpenseTrackerPage />} />
          <Route path={ROUTES.ADMIN} element={<AdminPage />} />
          <Route path={ROUTES.RPA_JOBS} element={<RPAJobsPage />} />
          <Route path={ROUTES.RPA_JOB_DETAIL} element={<RPAJobDetailPage />} />
          <Route path={ROUTES.NOTIFICATION_PREFERENCES} element={<NotificationPreferencesPage />} />
          <Route path={ROUTES.INC_DASHBOARD} element={<IncDashboardPage />} />
          <Route path={ROUTES.INC_REPORTS} element={<IncReportsPage />} />
          <Route path={ROUTES.GESTORA_DASHBOARD} element={<GestoraDashboardPage />} />
          <Route path={ROUTES.PAYMENT_TRACKING} element={<PaymentTrackingPage />} />
          <Route path={ROUTES.COURIER_ARCHIVE} element={<CourierArchivePage />} />
          <Route path={ROUTES.REPORTS} element={<ReportsHubPage />} />
          <Route path={ROUTES.FINANCIAL_DASHBOARD} element={<FinancialDashboardPage />} />
          <Route path={ROUTES.USER_ACTIVITY} element={<UserActivityPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
