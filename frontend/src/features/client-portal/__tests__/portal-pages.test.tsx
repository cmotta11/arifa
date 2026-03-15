import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import type {
  PortalEntity,
  PortalEntityDetail,
  PortalServiceRequest,
  PortalNotification,
  PortalProfile,
} from "../api/portal-api";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUsePortalEntities = vi.fn();
const mockUsePortalEntityDetail = vi.fn();
const mockUsePortalServices = vi.fn();
const mockUsePortalNotifications = vi.fn();
const mockUseMarkNotificationRead = vi.fn();
const mockUseMarkAllNotificationsRead = vi.fn();
const mockUsePortalProfile = vi.fn();
const mockUseUpdatePortalProfile = vi.fn();
const mockUseChangePortalPassword = vi.fn();
const mockUseUpdateNotificationPreferences = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../api/portal-api", () => ({
  usePortalEntities: () => mockUsePortalEntities(),
  usePortalEntityDetail: (...args: unknown[]) =>
    mockUsePortalEntityDetail(...args),
  usePortalServices: () => mockUsePortalServices(),
  usePortalNotifications: () => mockUsePortalNotifications(),
  useMarkNotificationRead: () => mockUseMarkNotificationRead(),
  useMarkAllNotificationsRead: () => mockUseMarkAllNotificationsRead(),
  usePortalProfile: () => mockUsePortalProfile(),
  useUpdatePortalProfile: () => mockUseUpdatePortalProfile(),
  useChangePortalPassword: () => mockUseChangePortalPassword(),
  useUpdateNotificationPreferences: () =>
    mockUseUpdateNotificationPreferences(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "entity-001" }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock("@/config/routes", () => ({
  ROUTES: {
    CLIENT_PORTAL_ENTITIES: "/portal/entities",
    CLIENT_PORTAL_ENTITY_DETAIL: "/portal/entities/:id",
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = createQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function mockMutation(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
    error: null,
    reset: vi.fn(),
    ...overrides,
  };
}

function makeMockEntity(overrides: Partial<PortalEntity> = {}): PortalEntity {
  return {
    id: "entity-001",
    name: "ACME Corp",
    entity_type: "corporation",
    jurisdiction: "bvi",
    status: "active",
    incorporation_date: "2020-05-15",
    current_risk_level: "low",
    kyc_status: "approved",
    es_status: "completed",
    ar_status: "completed",
    created_at: "2020-05-15T00:00:00Z",
    ...overrides,
  };
}

function makeMockEntityDetail(
  overrides: Partial<PortalEntityDetail> = {},
): PortalEntityDetail {
  return {
    ...makeMockEntity(),
    documents: [
      {
        id: "doc-001",
        file_name: "passport.pdf",
        document_type: "passport",
        created_at: "2026-01-01T00:00:00Z",
        download_url: "https://example.com/download/1",
      },
    ],
    renewals: [
      {
        id: "renewal-001",
        renewal_type: "Annual Renewal",
        due_date: "2026-12-31",
        status: "pending",
      },
    ],
    ...overrides,
  };
}

function makeMockService(
  overrides: Partial<PortalServiceRequest> = {},
): PortalServiceRequest {
  return {
    id: "svc-001",
    service_type: "Incorporation",
    status: "in_progress",
    description: "New entity incorporation",
    current_stage: "Document Review",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-10T00:00:00Z",
    ...overrides,
  };
}

function makeMockNotification(
  overrides: Partial<PortalNotification> = {},
): PortalNotification {
  return {
    id: "notif-001",
    title: "KYC Approved",
    message: "Your KYC submission has been approved.",
    category: "kyc",
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeMockProfile(
  overrides: Partial<PortalProfile> = {},
): PortalProfile {
  return {
    id: "user-001",
    email: "client@example.com",
    first_name: "Jane",
    last_name: "Doe",
    phone: "+507 6000-0000",
    notification_preferences: {
      ticket: { email: true, in_app: true },
      kyc: { email: true, in_app: true },
      compliance: { email: false, in_app: true },
      document: { email: true, in_app: false },
      system: { email: true, in_app: true },
      reminder: { email: true, in_app: true },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PortalEntitiesPage Tests
// ---------------------------------------------------------------------------

describe("PortalEntitiesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderEntitiesPage() {
    const mod = await import("../pages/portal-entities-page");
    const PortalEntitiesPage = mod.default;
    return render(
      <Wrapper>
        <PortalEntitiesPage />
      </Wrapper>,
    );
  }

  it("renders page title and description", async () => {
    mockUsePortalEntities.mockReturnValue({
      data: { results: [] },
      isLoading: false,
      isError: false,
    });

    await renderEntitiesPage();

    expect(screen.getByText("portal.entities.title")).toBeInTheDocument();
    expect(screen.getByText("portal.entities.description")).toBeInTheDocument();
  });

  it("renders entity list when data is loaded", async () => {
    const entities = [
      makeMockEntity({ id: "e1", name: "ACME Corp" }),
      makeMockEntity({ id: "e2", name: "Widget LLC", status: "pending" }),
    ];
    mockUsePortalEntities.mockReturnValue({
      data: { results: entities },
      isLoading: false,
      isError: false,
    });

    await renderEntitiesPage();

    expect(screen.getByText("ACME Corp")).toBeInTheDocument();
    expect(screen.getByText("Widget LLC")).toBeInTheDocument();
  });

  it("shows loading spinner while loading", async () => {
    mockUsePortalEntities.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    await renderEntitiesPage();

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("shows error state on query error", async () => {
    mockUsePortalEntities.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    await renderEntitiesPage();

    expect(screen.getByText("common.error")).toBeInTheDocument();
  });

  it("shows empty state when no entities exist", async () => {
    mockUsePortalEntities.mockReturnValue({
      data: { results: [] },
      isLoading: false,
      isError: false,
    });

    await renderEntitiesPage();

    expect(screen.getByText("portal.entities.empty")).toBeInTheDocument();
  });

  it("filters entities by search input", async () => {
    const user = userEvent.setup();
    const entities = [
      makeMockEntity({ id: "e1", name: "ACME Corp", jurisdiction: "bvi" }),
      makeMockEntity({ id: "e2", name: "Panama Holdings", jurisdiction: "panama" }),
    ];
    mockUsePortalEntities.mockReturnValue({
      data: { results: entities },
      isLoading: false,
      isError: false,
    });

    await renderEntitiesPage();

    const searchInput = screen.getByPlaceholderText("portal.entities.search");
    await user.type(searchInput, "ACME");

    expect(screen.getByText("ACME Corp")).toBeInTheDocument();
    expect(screen.queryByText("Panama Holdings")).not.toBeInTheDocument();
  });

  it("navigates to entity detail when card is clicked", async () => {
    const user = userEvent.setup();
    const entities = [makeMockEntity({ id: "e1", name: "ACME Corp" })];
    mockUsePortalEntities.mockReturnValue({
      data: { results: entities },
      isLoading: false,
      isError: false,
    });

    await renderEntitiesPage();

    await user.click(screen.getByText("ACME Corp"));

    expect(mockNavigate).toHaveBeenCalledWith("/portal/entities/e1");
  });
});

// ---------------------------------------------------------------------------
// PortalEntityDetailPage Tests
// ---------------------------------------------------------------------------

describe("PortalEntityDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderEntityDetailPage() {
    const mod = await import("../pages/portal-entity-detail-page");
    const PortalEntityDetailPage = mod.default;
    return render(
      <Wrapper>
        <PortalEntityDetailPage />
      </Wrapper>,
    );
  }

  it("renders entity name and badges", async () => {
    mockUsePortalEntityDetail.mockReturnValue({
      data: makeMockEntityDetail({ name: "ACME Corp" }),
      isLoading: false,
      isError: false,
    });

    await renderEntityDetailPage();

    expect(screen.getByText("ACME Corp")).toBeInTheDocument();
    // BVI appears in both the badge and the info tab
    expect(screen.getAllByText("BVI").length).toBeGreaterThanOrEqual(1);
  });

  it("renders tabs: info, documents, renewals", async () => {
    mockUsePortalEntityDetail.mockReturnValue({
      data: makeMockEntityDetail(),
      isLoading: false,
      isError: false,
    });

    await renderEntityDetailPage();

    expect(
      screen.getByText("portal.entityDetail.tabs.info"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("portal.entityDetail.tabs.documents"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("portal.entityDetail.tabs.renewals"),
    ).toBeInTheDocument();
  });

  it("shows loading spinner while loading", async () => {
    mockUsePortalEntityDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    await renderEntityDetailPage();

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    mockUsePortalEntityDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    await renderEntityDetailPage();

    expect(screen.getByText("common.error")).toBeInTheDocument();
  });

  it("switches to documents tab and shows document table", async () => {
    const user = userEvent.setup();
    mockUsePortalEntityDetail.mockReturnValue({
      data: makeMockEntityDetail(),
      isLoading: false,
      isError: false,
    });

    await renderEntityDetailPage();

    await user.click(
      screen.getByText("portal.entityDetail.tabs.documents"),
    );

    expect(screen.getByText("passport.pdf")).toBeInTheDocument();
  });

  it("switches to renewals tab and shows renewal cards", async () => {
    const user = userEvent.setup();
    mockUsePortalEntityDetail.mockReturnValue({
      data: makeMockEntityDetail(),
      isLoading: false,
      isError: false,
    });

    await renderEntityDetailPage();

    await user.click(
      screen.getByText("portal.entityDetail.tabs.renewals"),
    );

    expect(screen.getByText("Annual Renewal")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PortalServiceTrackingPage Tests
// ---------------------------------------------------------------------------

describe("PortalServiceTrackingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderServicePage() {
    const mod = await import("../pages/portal-service-tracking-page");
    const PortalServiceTrackingPage = mod.default;
    return render(
      <Wrapper>
        <PortalServiceTrackingPage />
      </Wrapper>,
    );
  }

  it("renders page title", async () => {
    mockUsePortalServices.mockReturnValue({
      data: { results: [] },
      isLoading: false,
      isError: false,
    });

    await renderServicePage();

    expect(screen.getByText("portal.services.title")).toBeInTheDocument();
  });

  it("renders service request table with data", async () => {
    const services = [
      makeMockService({ id: "s1", service_type: "Incorporation" }),
      makeMockService({ id: "s2", service_type: "Annual Renewal" }),
    ];
    mockUsePortalServices.mockReturnValue({
      data: { results: services },
      isLoading: false,
      isError: false,
    });

    await renderServicePage();

    expect(screen.getByText("Incorporation")).toBeInTheDocument();
    expect(screen.getByText("Annual Renewal")).toBeInTheDocument();
  });

  it("shows loading spinner while loading", async () => {
    mockUsePortalServices.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    await renderServicePage();

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("shows empty message when no services exist", async () => {
    mockUsePortalServices.mockReturnValue({
      data: { results: [] },
      isLoading: false,
      isError: false,
    });

    await renderServicePage();

    expect(screen.getByText("portal.services.empty")).toBeInTheDocument();
  });

  it("shows error state on query error", async () => {
    mockUsePortalServices.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    await renderServicePage();

    expect(screen.getByText("common.error")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PortalNotificationsPage Tests
// ---------------------------------------------------------------------------

describe("PortalNotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderNotificationsPage() {
    const mod = await import("../pages/portal-notifications-page");
    const PortalNotificationsPage = mod.default;
    return render(
      <Wrapper>
        <PortalNotificationsPage />
      </Wrapper>,
    );
  }

  it("renders page title and description", async () => {
    mockUsePortalNotifications.mockReturnValue({
      data: { results: [] },
      isLoading: false,
      isError: false,
    });
    mockUseMarkNotificationRead.mockReturnValue(mockMutation());
    mockUseMarkAllNotificationsRead.mockReturnValue(mockMutation());

    await renderNotificationsPage();

    expect(
      screen.getByText("portal.notifications.title"),
    ).toBeInTheDocument();
  });

  it("renders notification cards", async () => {
    const notifications = [
      makeMockNotification({
        id: "n1",
        title: "KYC Approved",
        is_read: false,
      }),
      makeMockNotification({
        id: "n2",
        title: "Document Uploaded",
        category: "document",
        is_read: true,
      }),
    ];
    mockUsePortalNotifications.mockReturnValue({
      data: { results: notifications },
      isLoading: false,
      isError: false,
    });
    mockUseMarkNotificationRead.mockReturnValue(mockMutation());
    mockUseMarkAllNotificationsRead.mockReturnValue(mockMutation());

    await renderNotificationsPage();

    expect(screen.getByText("KYC Approved")).toBeInTheDocument();
    expect(screen.getByText("Document Uploaded")).toBeInTheDocument();
  });

  it("shows Mark All Read button when unread notifications exist", async () => {
    const notifications = [
      makeMockNotification({ id: "n1", is_read: false }),
    ];
    mockUsePortalNotifications.mockReturnValue({
      data: { results: notifications },
      isLoading: false,
      isError: false,
    });
    mockUseMarkNotificationRead.mockReturnValue(mockMutation());
    mockUseMarkAllNotificationsRead.mockReturnValue(mockMutation());

    await renderNotificationsPage();

    expect(
      screen.getByText("portal.notifications.markAllRead"),
    ).toBeInTheDocument();
  });

  it("calls markAllRead mutation when Mark All Read is clicked", async () => {
    const user = userEvent.setup();
    const markAllMutate = vi.fn();
    const notifications = [
      makeMockNotification({ id: "n1", is_read: false }),
    ];
    mockUsePortalNotifications.mockReturnValue({
      data: { results: notifications },
      isLoading: false,
      isError: false,
    });
    mockUseMarkNotificationRead.mockReturnValue(mockMutation());
    mockUseMarkAllNotificationsRead.mockReturnValue(
      mockMutation({ mutate: markAllMutate }),
    );

    await renderNotificationsPage();

    await user.click(screen.getByText("portal.notifications.markAllRead"));
    expect(markAllMutate).toHaveBeenCalledTimes(1);
  });

  it("calls markRead when clicking an unread notification card", async () => {
    const user = userEvent.setup();
    const markReadMutate = vi.fn();
    const notifications = [
      makeMockNotification({
        id: "n1",
        title: "Unread Notice",
        is_read: false,
      }),
    ];
    mockUsePortalNotifications.mockReturnValue({
      data: { results: notifications },
      isLoading: false,
      isError: false,
    });
    mockUseMarkNotificationRead.mockReturnValue(
      mockMutation({ mutate: markReadMutate }),
    );
    mockUseMarkAllNotificationsRead.mockReturnValue(mockMutation());

    await renderNotificationsPage();

    await user.click(screen.getByText("Unread Notice"));
    expect(markReadMutate).toHaveBeenCalledWith("n1");
  });

  it("shows empty state when no notifications exist", async () => {
    mockUsePortalNotifications.mockReturnValue({
      data: { results: [] },
      isLoading: false,
      isError: false,
    });
    mockUseMarkNotificationRead.mockReturnValue(mockMutation());
    mockUseMarkAllNotificationsRead.mockReturnValue(mockMutation());

    await renderNotificationsPage();

    expect(
      screen.getByText("portal.notifications.empty"),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PortalProfilePage Tests
// ---------------------------------------------------------------------------

describe("PortalProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderProfilePage() {
    const mod = await import("../pages/portal-profile-page");
    const PortalProfilePage = mod.default;
    return render(
      <Wrapper>
        <PortalProfilePage />
      </Wrapper>,
    );
  }

  it("renders profile page title", async () => {
    mockUsePortalProfile.mockReturnValue({
      data: makeMockProfile(),
      isLoading: false,
      isError: false,
    });
    mockUseUpdatePortalProfile.mockReturnValue(mockMutation());
    mockUseChangePortalPassword.mockReturnValue(mockMutation());
    mockUseUpdateNotificationPreferences.mockReturnValue(mockMutation());

    await renderProfilePage();

    expect(screen.getByText("portal.profile.title")).toBeInTheDocument();
  });

  it("renders profile info form fields with user data", async () => {
    const profile = makeMockProfile({
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      phone: "+507 6000-0000",
    });
    mockUsePortalProfile.mockReturnValue({
      data: profile,
      isLoading: false,
      isError: false,
    });
    mockUseUpdatePortalProfile.mockReturnValue(mockMutation());
    mockUseChangePortalPassword.mockReturnValue(mockMutation());
    mockUseUpdateNotificationPreferences.mockReturnValue(mockMutation());

    await renderProfilePage();

    // Check that form fields are populated
    const inputs = screen.getAllByRole("textbox");
    const firstNameInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "Jane",
    );
    expect(firstNameInput).toBeDefined();
  });

  it("renders change password section", async () => {
    mockUsePortalProfile.mockReturnValue({
      data: makeMockProfile(),
      isLoading: false,
      isError: false,
    });
    mockUseUpdatePortalProfile.mockReturnValue(mockMutation());
    mockUseChangePortalPassword.mockReturnValue(mockMutation());
    mockUseUpdateNotificationPreferences.mockReturnValue(mockMutation());

    await renderProfilePage();

    expect(
      screen.getByText("portal.profile.password.title"),
    ).toBeInTheDocument();
  });

  it("renders notification preferences section with checkboxes", async () => {
    mockUsePortalProfile.mockReturnValue({
      data: makeMockProfile(),
      isLoading: false,
      isError: false,
    });
    mockUseUpdatePortalProfile.mockReturnValue(mockMutation());
    mockUseChangePortalPassword.mockReturnValue(mockMutation());
    mockUseUpdateNotificationPreferences.mockReturnValue(mockMutation());

    await renderProfilePage();

    expect(
      screen.getByText("portal.profile.notificationPreferences.title"),
    ).toBeInTheDocument();

    // Should have checkboxes for each category (6 categories x 2 channels = 12 + declaration checkbox)
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThanOrEqual(12);
  });

  it("shows loading state while profile is loading", async () => {
    mockUsePortalProfile.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    await renderProfilePage();

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("shows error state when profile fails to load", async () => {
    mockUsePortalProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    await renderProfilePage();

    expect(screen.getByText("common.error")).toBeInTheDocument();
  });

  it("disables email field (read-only)", async () => {
    mockUsePortalProfile.mockReturnValue({
      data: makeMockProfile({ email: "jane@example.com" }),
      isLoading: false,
      isError: false,
    });
    mockUseUpdatePortalProfile.mockReturnValue(mockMutation());
    mockUseChangePortalPassword.mockReturnValue(mockMutation());
    mockUseUpdateNotificationPreferences.mockReturnValue(mockMutation());

    await renderProfilePage();

    const inputs = screen.getAllByRole("textbox");
    const emailInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "jane@example.com",
    );
    expect(emailInput).toBeDefined();
    expect(emailInput).toBeDisabled();
  });
});
