# ARIFA Platform -- Component Mapping (Task 1.9.2)

> **Date:** 2026-03-14
> **Purpose:** Map old/raw HTML patterns to the ARIFA design system components. All components follow the project's Tailwind config (primary #6200EE, 8px grid, MD3 breakpoints).

---

## UI Components (`frontend/src/components/ui/`)

| Old Pattern | New Component | Location | Key Props | Notes |
|---|---|---|---|---|
| Raw `<button>` | **Button** | `components/ui/button.tsx` | `variant` (primary/secondary/danger/ghost), `size` (sm/md/lg), `loading`, `disabled` | Uses `forwardRef`. Loading state shows `Spinner` inline. Focus ring + ring-offset. Disabled opacity 50%. |
| Raw `<input>` | **Input** | `components/ui/input.tsx` | `label`, `error`, `helperText` + all native `<input>` props | Uses `forwardRef`. Auto-generates `id` from label. `aria-invalid`, `aria-describedby` wired for a11y. Error state uses `border-error`. |
| Raw `<select>` | **Select** | `components/ui/select.tsx` | `label`, `error`, `options: {value, label}[]`, `placeholder` | Uses `forwardRef`. Options rendered from array. Placeholder option has `disabled` attribute. |
| Raw `<textarea>` | **Textarea** | `components/ui/textarea.tsx` | `label`, `error`, `helperText`, `rows` (default 3) | Uses `forwardRef`. Same styling pattern as Input. |
| Raw `<input type="checkbox">` | **Checkbox** | `components/ui/checkbox.tsx` | `label` (required), `description`, `error` | Uses `forwardRef`. Renders as `flex items-start gap-2` with label beside checkbox. Supports description text below label. |
| Raw radio buttons | **RadioGroup** | `components/ui/radio-group.tsx` | `label`, `error`, `options: {value, label, description?}[]`, `value`, `onChange`, `disabled` | Built on Headless UI `RadioGroup`. Custom radio circle rendering with `data-[checked]` styles. |
| Raw `<input type="date">` | **DatePicker** | `components/ui/date-picker.tsx` | `label`, `error`, `helperText` + all native `<input>` props (except `type`) | Uses `forwardRef`. Renders as `type="date"`. Same styling as Input. |
| Inline status labels / `<span>` tags | **Badge** | `components/ui/badge.tsx` | `color` (gray/green/yellow/red/blue/primary), `children` | Renders as `<span>` with `rounded-full px-2.5 py-0.5 text-xs font-medium`. Color maps to bg + text combos. |
| Custom loading spinners / raw SVG | **Spinner** | `components/ui/spinner.tsx` | `size` (sm: 16px, md: 24px, lg: 40px) | SVG-based with `animate-spin`. Uses `role="status"` and `aria-label="Loading"` for a11y. |
| Raw `<div>` card wrappers | **Card** / **CardHeader** / **CardTitle** | `components/ui/card.tsx` | `children`, `className` | Card: `rounded-lg border border-surface-border bg-white p-6 shadow-sm`. CardHeader: `mb-4 flex items-center justify-between`. CardTitle: `text-lg font-semibold`. Also re-exported from `components/layout/card.tsx` for backward compatibility. |
| Custom type-ahead / `<select>` with search | **SearchableSelect** | `components/ui/searchable-select.tsx` | `label`, `error`, `options: {value, label}[]`, `value`, `onChange`, `placeholder`, `disabled` | Built on Headless UI `Combobox`. Type-to-filter with memoized filtering. Includes empty/clear option. Shows checkmark for selected. |
| Multi-select checkboxes / custom multi-select | **SearchableMultiSelect** | `components/ui/searchable-multi-select.tsx` | `label`, `error`, `options: {value, label}[]`, `value: string[]`, `onChange`, `placeholder`, `disabled` | Built on Headless UI `Combobox` with `multiple`. Selected items shown as removable chips (primary/10 bg). Type-to-filter. |

---

## Data Display Components (`frontend/src/components/data-display/`)

| Old Pattern | New Component | Location | Key Props | Notes |
|---|---|---|---|---|
| Raw `<table>` markup | **DataTable** | `components/data-display/data-table.tsx` | `columns: {key, header, render?}[]`, `data: T[]`, `onRowClick`, `loading`, `emptyMessage`, `keyExtractor`, `stickyHeader` | Generic component (`<T extends object>`). Loading state shows centered Spinner. Empty state uses EmptyState component. Clickable rows have `cursor-pointer`, `tabIndex`, keyboard Enter/Space support. `overflow-x-auto` wrapper. |
| Custom pagination / "Load more" | **Pagination** | `components/data-display/pagination.tsx` | `currentPage`, `totalPages`, `onPageChange` | Smart page number algorithm with ellipsis (shows 7 page buttons max). Previous/Next arrows with disabled states. Uses `aria-label` and `aria-current="page"`. Returns `null` if `totalPages <= 1`. Uses `useTranslation()`. |
| Inline metric displays | **StatCard** | `components/data-display/stat-card.tsx` | `label`, `value`, `trend?: {value, direction}`, `icon` | Wraps in Card component. Optional trend indicator with up/down arrow icons (green/red). Icon slot renders in primary/10 rounded container. |
| "No results" / empty placeholders | **EmptyState** | `components/data-display/empty-state.tsx` | `icon`, `title`, `description`, `action?: {label, onClick}` | Centered layout with `py-12`. Optional icon in gray circle. Optional CTA renders as Button. |
| React Flow org chart | **OrgChart** | `components/data-display/org-chart.tsx` | `nodes`, `edges`, `onNodeClick`, `onEdgeClick`, `onNodesChange`, `onEdgesChange` | Shell component. Requires `reactflow` npm package. Custom node types: EntityNode (blue), PersonNode (green). Custom OwnershipEdge with percentage labels. Includes Controls, MiniMap, Background. |

---

## Feedback Components (`frontend/src/components/feedback/`)

| Old Pattern | New Component | Location | Key Props | Notes |
|---|---|---|---|---|
| Inline alert boxes / banners | **Alert** | `components/feedback/alert.tsx` | `variant` (info/success/warning/error), `title`, `children`, `dismissible` | Color-coded with left border accent. Auto-selects icon per variant (InformationCircle, CheckCircle, ExclamationTriangle, ExclamationCircle). Uses `role="alert"`. Dismissible via local state. |
| Custom skeleton/placeholder loaders | **LoadingSkeleton** | `components/feedback/loading-skeleton.tsx` | `variant` (text/circle/rect), `width`, `height`, `lines` (text only, default 3) | Uses `animate-pulse bg-gray-200`. Text variant: multiple lines with last line at 75% width. Circle: rounded-full. Rect: configurable dimensions. |
| Floating help/support buttons | **HelpButton** | `components/feedback/help-button.tsx` | `module`, `entityId`, `currentPage` | Fixed-position FAB (bottom-right). Opens Modal with module display, entity context, and message Textarea. Posts to `/compliance/help-request/`. Handles 429 rate limiting. |

---

## Overlay Components (`frontend/src/components/overlay/`)

| Old Pattern | New Component | Location | Key Props | Notes |
|---|---|---|---|---|
| Custom modal / dialog markup | **Modal** | `components/overlay/modal.tsx` | `isOpen`, `onClose`, `title`, `children`, `size` (sm/md/lg/xl/full), `closeOnOverlayClick` (default true) | Built on Headless UI `Dialog` + `Transition`. Animated entrance (opacity + scale). Backdrop `bg-black/30`. Title renders with close X button. |
| `window.confirm()` / inline confirm buttons | **ConfirmDialog** | `components/overlay/confirm-dialog.tsx` | `isOpen`, `title`, `message`, `onConfirm`, `onCancel`, `confirmLabel`, `cancelLabel`, `variant` (danger/primary), `loading` | Wraps Modal. Two-button footer (ghost cancel + variant confirm). Loading state on confirm button. |
| Custom toast / snackbar | **Toast** / **ToastContainer** / **useToast** | `components/overlay/toast.tsx` | Toast: `message`, `type`, `onClose`. Hook: `success(msg)`, `error(msg)`, `info(msg)`, `warning(msg)` | Fixed position `right-4 top-4 z-[100]`. Color-coded with left border + icon. Backed by `useToastStore` (Zustand). `useToast()` hook provides typed dispatch methods. Auto-dismiss managed by store. |

---

## Navigation Components (`frontend/src/components/navigation/`)

| Old Pattern | New Component | Location | Key Props | Notes |
|---|---|---|---|---|
| Custom sidebar / nav drawer | **Sidebar** | `components/navigation/sidebar.tsx` | `navItems`, `user`, `collapsed`, `mobileSidebarOpen`, `language`, callbacks for toggle/logout/language/close | Desktop: `hidden md:flex`, `w-60`/`w-16` with transition. Mobile: Headless UI `Dialog` slide-in from left with backdrop. Nav items use `NavLink` with active state highlighting (`bg-primary text-white`). Bottom section: language toggle, user info, logout. |
| Raw breadcrumb links | **Breadcrumbs** | `components/navigation/breadcrumbs.tsx` | `items: {label, href?}[]` | Uses `react-router-dom` `Link`. Chevron separator icons. Last item is bold (current page), no link. Returns `null` for empty array. `aria-label="Breadcrumb"`. |
| Custom tab bars | **Tabs** | `components/navigation/tabs.tsx` | `tabs: {key, label}[]`, `activeTab`, `onChange` | Horizontal tab bar with `border-b-2` indicator. Active tab: `border-primary text-primary`. Inactive: `border-transparent`. Uses `aria-current="page"` for active. |
| Step progress indicators | **Stepper** | `components/navigation/stepper.tsx` | `steps: {label, description?}[]`, `currentStep`, `completedSteps: number[]` | Horizontal stepper with numbered circles. Completed: `bg-primary text-white` with CheckIcon. Current: `border-2 border-primary`. Pending: `border-2 border-gray-300`. Connector lines between steps. `aria-label="Progress"`. |
| Page header with breadcrumbs + actions | **TopBar** | `components/navigation/top-bar.tsx` | `title`, `breadcrumbs?: BreadcrumbItem[]`, `actions?: ReactNode` | Wrapper: `border-b bg-white px-6 py-4`. Responsive: `sm:flex-row sm:items-center sm:justify-between`. Renders Breadcrumbs above title. Actions slot on right. |

---

## Layout Components (`frontend/src/components/layout/`)

| Old Pattern | New Component | Location | Key Props | Notes |
|---|---|---|---|---|
| Page wrapper with sidebar | **PageLayout** | `components/layout/page-layout.tsx` | None (renders `<Outlet />`) | Minimal wrapper: `flex h-screen overflow-hidden bg-background`. Main content uses Suspense with Spinner fallback. Note: the full app shell with sidebar is in `features/shell/app-layout.tsx`. |
| Print-specific wrappers | **PrintLayout** | `components/layout/print-layout.tsx` | `header`, `footer`, `children` | Injects `@media print` CSS (hides nav, aside, `.no-print`). Content: `max-w-4xl mx-auto bg-white p-6`. Header/footer separated by borders. |
| Content sections with title | **Section** | `components/layout/section.tsx` | `title`, `description`, `action?: ReactNode`, `children` | Section header with title/description on left, optional action slot on right. `flex items-start justify-between`. |
| Route guards | **ProtectedRoute** | `components/layout/protected-route.tsx` | N/A | Exported from `components/layout/index.ts`. Handles auth-gated routes. |

---

## Form Components (`frontend/src/components/forms/`)

| Old Pattern | New Component | Location | Key Props | Notes |
|---|---|---|---|---|
| File input / upload | **FileDropzone** | `components/forms/file-dropzone.tsx` | `onDrop`, `accept?: Accept`, `maxSize`, `label`, `multiple` | Built on `react-dropzone`. Dashed border zone. Drag active: `border-primary bg-primary/5`. Drag reject: `border-error bg-red-50`. Shows ArrowUpTrayIcon. Displays max size in MB. |
| Generic form field wrapper with label + error | **FormField** | `components/forms/form-field.tsx` | `label`, `error`, `required`, `children`, `htmlFor` | Wrapper: renders label with optional red asterisk for required, children slot, error message below. Useful for wrapping non-standard inputs. |

---

## AI Components (`frontend/src/components/ai/`)

| Old Pattern | New Component | Location | Key Props | Notes |
|---|---|---|---|---|
| Collapsible AI panel | **AIAssistantShell** | `components/ai/ai-assistant-shell.tsx` | `title`, `loading`, `children`, `defaultOpen` | Collapsible panel styled with `border-primary/20 bg-primary/5`. Toggle button with SparklesIcon. Loading state with Spinner. Expand/collapse with Chevron icons. Uses `useTranslation()`. |

---

## Re-export Index Files

| File | Exports |
|---|---|
| `components/ui/index.ts` | Button, Input, Textarea, Select, Checkbox, RadioGroup, DatePicker, Badge, Spinner, Card, CardHeader, CardTitle, SearchableSelect, SearchableMultiSelect |
| `components/layout/index.ts` | Card, CardHeader, CardTitle (re-exported from ui/card for backward compat), ProtectedRoute |

---

## Migration Guide

When updating existing pages from raw HTML to design system components:

1. **Replace raw `<button>`** with `<Button variant="..." size="...">`. Use `loading` prop instead of manual spinner logic.
2. **Replace raw `<input>`** with `<Input label="..." error={errors.field}>`. Remove manual `<label>` tags -- they are built in.
3. **Replace raw `<select>`** with either `<Select>` (simple) or `<SearchableSelect>` (type-to-filter). For multi-value, use `<SearchableMultiSelect>`.
4. **Replace `<textarea>`** with `<Textarea>`. Props are identical to Input.
5. **Replace status spans** with `<Badge color="...">`. Use color semantics: green=success, red=danger, yellow=warning, blue=info, primary=brand.
6. **Replace raw `<table>`** with `<DataTable columns={...} data={...}>`. Define columns with `render` functions for custom cell content.
7. **Replace custom modals** with `<Modal>`. Size with `size` prop. Use `<ConfirmDialog>` for confirm/cancel patterns.
8. **Replace `window.confirm()`** with `<ConfirmDialog>` for consistent UI.
9. **Replace custom toast logic** with `useToast()` hook: `toast.success("Saved!")`.
10. **Wrap page sections** with `<Section title="..." action={<Button>}>` for consistent headings.
11. **Use `<Card>` + `<CardHeader>` + `<CardTitle>`** for card-based layouts.
12. **Use `<Pagination>`** instead of custom page controls.
13. **Use `<EmptyState>`** for "no data" displays instead of raw text.
14. **Use `<LoadingSkeleton>`** instead of custom shimmer effects.
15. **Use `<FileDropzone>`** instead of raw `<input type="file">`.

All components respect the Tailwind theme (primary color, border radius, spacing) and include accessibility attributes (aria labels, roles, keyboard navigation).
