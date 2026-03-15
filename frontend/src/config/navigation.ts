import {
  HomeIcon,
  BuildingOfficeIcon,
  BuildingLibraryIcon,
  UsersIcon,
  TicketIcon,
  IdentificationIcon,
  ShieldCheckIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  DocumentChartBarIcon,
  Cog6ToothIcon,
  CurrencyDollarIcon,
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon,
  ArchiveBoxIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { ROUTES } from "@/config/routes";

export interface NavItem {
  labelKey: string;
  href: string;
  icon: typeof HomeIcon;
  roles?: string[];
}

export const navItems: NavItem[] = [
  { labelKey: "nav.dashboard", href: ROUTES.DASHBOARD, icon: HomeIcon },
  { labelKey: "nav.clients", href: ROUTES.CLIENTS, icon: BuildingOfficeIcon },
  { labelKey: "nav.entities", href: ROUTES.ENTITIES, icon: BuildingLibraryIcon },
  { labelKey: "nav.people", href: ROUTES.PEOPLE, icon: UsersIcon },
  { labelKey: "nav.tickets", href: ROUTES.TICKETS, icon: TicketIcon },
  { labelKey: "nav.kyc", href: ROUTES.KYC, icon: IdentificationIcon },
  { labelKey: "nav.economicSubstance", href: ROUTES.ECONOMIC_SUBSTANCE, icon: DocumentChartBarIcon },
  { labelKey: "nav.compliance", href: ROUTES.COMPLIANCE, icon: ShieldCheckIcon },
  { labelKey: "nav.documents", href: ROUTES.DOCUMENTS, icon: DocumentDuplicateIcon },
  { labelKey: "nav.registrosContables", href: ROUTES.REGISTROS_CONTABLES, icon: DocumentTextIcon },
  { labelKey: "nav.services", href: ROUTES.SERVICE_REQUESTS, icon: CurrencyDollarIcon },
  { labelKey: "nav.incorporation", href: ROUTES.INC_DASHBOARD, icon: BuildingStorefrontIcon },
  { labelKey: "nav.gestora", href: ROUTES.GESTORA_DASHBOARD, icon: ClipboardDocumentListIcon, roles: ["gestora", "director", "coordinator"] },
  { labelKey: "nav.reports", href: ROUTES.REPORTS, icon: ChartBarIcon, roles: ["director", "coordinator"] },
  { labelKey: "nav.archive", href: ROUTES.COURIER_ARCHIVE, icon: ArchiveBoxIcon, roles: ["coordinator", "gestora", "director"] },
  { labelKey: "nav.admin", href: ROUTES.ADMIN, icon: Cog6ToothIcon, roles: ["director"] },
];
