import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { ROUTES } from "@/config/routes";
import { PageLayout } from "@/components/layout/page-layout";
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
import { PortalLayout } from "@/features/client-portal/components/portal-layout";

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

        {/* Client portal routes */}
        <Route
          element={
            <ClientProtectedRoute>
              <PortalLayout />
            </ClientProtectedRoute>
          }
        >
          <Route path={ROUTES.CLIENT_PORTAL} element={<PortalDashboard />} />
          <Route
            path={ROUTES.CLIENT_PORTAL_KYC_DETAIL}
            element={<PortalKYCDetail />}
          />
        </Route>

        {/* Protected routes - Suspense is inside PageLayout wrapping Outlet */}
        <Route
          element={
            <ProtectedRoute>
              <PageLayout />
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
          <Route path={ROUTES.ADMIN} element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
