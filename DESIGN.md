# SupplyKey Design System

This document is the canonical design guide for SupplyKey UI. It applies to pages, shared UI, forms, tables, filters, overlays, action bars, and visual refinement. It is for product dashboard work, not for inventing a new visual language.

Primary priority order:

1. UX clarity
2. Clean, simple, minimal UI
3. Consistency with the existing component system
4. Visual polish

Prefer removing friction over adding flair. A good Kleos screen should feel obvious to use within a few seconds.

## Core Rules

- Start from current repo patterns before making design decisions.
- Use shadcn-vue components as the primitive layer. Prefer composition over bespoke wrappers.
- Treat the shared UI primitive layer as project-owned source. If a primitive needs adjustment, modify it instead of bypassing it with ad hoc markup.
- Preserve the dashboard shell: sidebar, header, breadcrumb, content area, and card-based sections.
- Respect route-owned component boundaries. Shared components belong in `app/components`; route-specific pieces belong under the route `_lib/` folder.
- Use absolute imports based on existing project conventions.
- Keep dark and light themes working. Prefer semantic tokens and utility classes over hard-coded colors.
- Keep interactions utilitarian and calm. This product is an admin dashboard, not a marketing site.
- Start with the smallest UI that solves the problem. Add visual complexity only when it improves comprehension.
- If a choice improves aesthetics but weakens clarity, keep the clearer option.

## UX Priority

Optimize for operator speed and comprehension:

- Make the primary task obvious from the first screenful.
- Keep actions near the data or form they affect.
- Reduce competing emphasis; only one primary action per local area.
- Use progressive disclosure for secondary controls.
- Minimize context switching between page, modal, and nested actions.
- Preserve user progress during refetches, validation, and filtering.
- Make destructive actions deliberate and harder to trigger accidentally.

## Visual Language

The current system is a restrained, operational dashboard:

- Color: warm neutral surfaces with a gold primary accent. Use `primary` for emphasis, not everywhere.
- Surfaces: cards, panels, tables, popovers, and sidebar use tokenized background, border, and muted values.
- Density: compact but readable. Favor clear grouping over large decorative spacing.
- Radius: moderate rounding centered around the global `--radius` token.
- Typography: straightforward hierarchy with strong section titles, subdued descriptions, and compact table/filter text.
- Icons: use Lucide sparingly to support hierarchy, section headers, status, and affordances.
- Motion: subtle transitions only. Use motion to clarify state changes, not to decorate.

Avoid gradient-heavy hero treatments, glassmorphism, floating marketing cards, decorative icon use, hard-coded colors, exaggerated radius, strong shadows, and large branded color fills behind ordinary admin content.

## Design Tokens

The implemented token source is `app/assets/css/main.css`. `DESIGN.md` documents intent and usage; if a token value changes, update CSS first and then update this section. Tailwind v4 maps these CSS variables through `@theme inline`, so component code should use token utilities such as `bg-background`, `text-foreground`, `border-border`, `bg-primary`, `text-muted-foreground`, and `ring-ring`.

### Type

- Sans: `Plus Jakarta Sans`, `Avenir Next`, `Segoe UI`, `sans-serif`.
- Display: `Sora`, `Plus Jakarta Sans`, `Avenir Next`, `sans-serif`.
- Heading elements use the display stack.
- Body text uses the sans stack.

### Radius And Depth

- Base radius: `--radius: 1rem`.
- Tailwind radius mapping:
  - `rounded-sm`: `calc(var(--radius) - 4px)`.
  - `rounded-md`: `calc(var(--radius) - 2px)`.
  - `rounded-lg`: `var(--radius)`.
  - `rounded-xl`: `calc(var(--radius) + 4px)`.
- `--shell-shadow` and `--panel-shadow` are reserved for the app shell and elevated panels. Do not add strong one-off shadows for normal cards.

### Light Theme Colors

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `oklch(95% 0.018 77)` | Page background |
| `--foreground` | `oklch(16% 0.025 65)` | Primary text |
| `--card` | `oklch(98% 0.012 80)` | Cards and panels |
| `--card-foreground` | `oklch(16% 0.025 65)` | Text on cards |
| `--popover` | `oklch(98.5% 0.010 82)` | Popovers, menus, floating UI |
| `--popover-foreground` | `oklch(16% 0.025 65)` | Text on popovers |
| `--primary` | `oklch(63% 0.16 64)` | Primary actions, active emphasis |
| `--primary-foreground` | `oklch(98.5% 0.014 82)` | Text on primary |
| `--secondary` | `oklch(90% 0.028 72)` | Secondary controls |
| `--secondary-foreground` | `oklch(30% 0.030 62)` | Text on secondary |
| `--muted` | `oklch(91% 0.022 74)` | Quiet surfaces |
| `--muted-foreground` | `oklch(47% 0.024 62)` | Secondary text |
| `--accent` | `oklch(88% 0.042 76)` | Subtle highlighted surfaces |
| `--accent-foreground` | `oklch(20% 0.030 60)` | Text on accent |
| `--destructive` | `oklch(50% 0.20 28)` | Destructive actions |
| `--destructive-foreground` | `oklch(98% 0.008 22)` | Text on destructive |
| `--border` | `oklch(84% 0.030 72)` | Structural borders |
| `--input` | `oklch(87% 0.034 74)` | Inputs and control borders |
| `--ring` | `oklch(70% 0.14 68)` | Focus rings |

### Dark Theme Colors

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `oklch(11% 0.016 60)` | Page background |
| `--foreground` | `oklch(93% 0.018 77)` | Primary text |
| `--card` | `oklch(15% 0.018 62)` | Cards and panels |
| `--card-foreground` | `oklch(93% 0.018 77)` | Text on cards |
| `--popover` | `oklch(13% 0.016 62)` | Popovers, menus, floating UI |
| `--popover-foreground` | `oklch(93% 0.018 77)` | Text on popovers |
| `--primary` | `oklch(71% 0.15 66)` | Primary actions, active emphasis |
| `--primary-foreground` | `oklch(12% 0.028 58)` | Text on primary |
| `--secondary` | `oklch(18% 0.016 64)` | Secondary controls |
| `--secondary-foreground` | `oklch(85% 0.028 72)` | Text on secondary |
| `--muted` | `oklch(18% 0.016 64)` | Quiet surfaces |
| `--muted-foreground` | `oklch(59% 0.024 65)` | Secondary text |
| `--accent` | `oklch(20% 0.026 60)` | Subtle highlighted surfaces |
| `--accent-foreground` | `oklch(95% 0.018 78)` | Text on accent |
| `--destructive` | `oklch(53% 0.20 28)` | Destructive actions |
| `--destructive-foreground` | `oklch(98% 0.006 22)` | Text on destructive |
| `--border` | `oklch(26% 0.020 62)` | Structural borders |
| `--input` | `oklch(22% 0.018 62)` | Inputs and control borders |
| `--ring` | `oklch(71% 0.15 66)` | Focus rings |

### Status Colors

Use status tokens for operational state, not raw `green`, `yellow`, or `red` utilities.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--success` | `oklch(52% 0.13 155)` | `oklch(68% 0.12 167)` | Confirmed, connected, completed |
| `--success-foreground` | `oklch(98.5% 0.018 155)` | `oklch(13% 0.042 165)` | Text on success |
| `--success-background` | `oklch(93% 0.040 155)` | `oklch(24% 0.062 165)` | Success alert surfaces |
| `--warning` | `oklch(62% 0.15 58)` | `oklch(70% 0.14 62)` | Needs attention, pending risk |
| `--warning-foreground` | `oklch(98% 0.014 82)` | `oklch(12% 0.028 52)` | Text on warning |
| `--warning-background` | `oklch(95% 0.040 80)` | `oklch(22% 0.042 52)` | Warning alert surfaces |
| `--error` | `oklch(54% 0.22 34)` | `oklch(55% 0.22 34)` | Errors and failed states |
| `--error-foreground` | `oklch(98% 0.008 22)` | `oklch(98% 0.006 22)` | Text on error |
| `--error-background` | `oklch(93% 0.042 22)` | `oklch(18% 0.058 28)` | Error alert surfaces |

### Chart Colors

Use chart tokens for data visualizations and keep the order stable across related charts.

| Token | Light | Dark |
| --- | --- | --- |
| `--chart-1` | `oklch(68% 0.14 72)` | `oklch(74% 0.13 74)` |
| `--chart-2` | `oklch(53% 0.12 168)` | `oklch(67% 0.12 168)` |
| `--chart-3` | `oklch(58% 0.17 38)` | `oklch(68% 0.14 44)` |
| `--chart-4` | `oklch(60% 0.17 277)` | `oklch(67% 0.17 277)` |
| `--chart-5` | `oklch(57% 0.18 300)` | `oklch(68% 0.17 300)` |

### Sidebar Colors

The sidebar is intentionally darker than the page shell in both themes.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--sidebar` | `oklch(14% 0.018 62)` | `oklch(8% 0.012 60)` | Sidebar background |
| `--sidebar-foreground` | `oklch(93% 0.022 78)` | `oklch(90% 0.028 74)` | Sidebar text |
| `--sidebar-primary` | `oklch(74% 0.14 70)` | `oklch(71% 0.15 66)` | Active/primary sidebar emphasis |
| `--sidebar-primary-foreground` | `oklch(16% 0.028 58)` | `oklch(10% 0.028 55)` | Text on sidebar primary |
| `--sidebar-accent` | `oklch(19% 0.016 64)` | `oklch(16% 0.014 62)` | Hover and active surfaces |
| `--sidebar-accent-foreground` | `oklch(98.5% 0.014 82)` | `oklch(93% 0.018 77)` | Text on sidebar accent |
| `--sidebar-border` | `oklch(24% 0.016 62)` | `oklch(22% 0.018 62)` | Sidebar separators |
| `--sidebar-ring` | `oklch(74% 0.14 70)` | `oklch(71% 0.15 66)` | Sidebar focus rings |

## Anti-Patterns

Avoid common dashboard design mistakes by checking these pairs before shipping UI.

### Clarity Over Decoration

Avoid:

- Oversized hero-like page headers.
- Multiple competing primary buttons in the same section.
- Decorative icons without structural meaning.
- Large branded color fills behind ordinary admin content.

Prefer:

- Compact task-oriented headers.
- One clear primary action per local area.
- Icons only when they clarify section type, state, or affordance.
- Neutral surfaces with targeted emphasis.

### System Primitives Over Custom Wrappers

Avoid:

- Ad hoc field wrappers that bypass `Field*`.
- Custom table layouts for standard list screens.
- One-off button variants for routine actions.
- Bespoke overlays where `Dialog` or `Sheet` is enough.

Prefer:

- `Field`, `FieldLabel`, `FieldDescription`, and `FieldError`.
- The shared datatable system.
- Existing action variants.
- Standard overlays first.

### Tokenized Styling Over Hard-Coded Visuals

Avoid:

- Raw hex colors for common UI states.
- Adding borders to every region.
- Exaggerated border radius on regular dashboard surfaces.
- Strong shadows to manufacture hierarchy.

Prefer:

- Semantic tokens.
- Spacing and typography before extra chrome.
- The existing radius scale.
- Subtle structural separation.

### Simple State Models

Avoid:

- Local filter state that diverges from `route.query`.
- Wiping the screen during background refetches.
- Hiding validation away from the relevant field.
- Using toasts for everything, including core page errors.

Prefer:

- Query-param-driven filters and pagination.
- Persistent visible content during refetches.
- Inline field validation.
- Inline `Alert` for page-level failures.

## Layout Patterns

Match the existing dashboard composition:

- Use the established dashboard shell.
- Keep breadcrumb and top actions in the header area.
- Settings and detail pages usually use `container mx-auto max-w-4xl space-y-6`.
- Data-heavy pages usually use wider full-width sections.
- Use a compact heading row plus a purposeful description before dense content.
- Use cards to segment settings and operational blocks when they improve grouping.
- Keep mobile behavior intact; stack controls vertically before forcing cramped horizontal layouts.

Page headers should be direct and operational. Do not use marketing-style hero sections, large gradient backgrounds, hero illustrations, or centered landing-page layouts in dashboard pages. Keep alert messages below the header, not mixed into the title row.

## Component Selection

Prefer these components and patterns first:

- Actions: `Button`
- Sections: `Card`, `CardHeader`, `CardContent`, `CardFooter`
- Feedback: `Alert`, toast, `Badge`, `Skeleton`
- Inputs: `Input`, `Select`, `Checkbox`, `Field*`
- Navigation: `Sidebar*`, `Breadcrumb`, `Tabs`
- Overlays: `Dialog`, `Sheet`, `Popover`, `DropdownMenu`
- Data views: `Table` through the shared datatable system

If shadcn-vue already provides a suitable primitive, do not replace it with a custom one just for styling freedom.

## Token Usage

Use semantic tokens deliberately:

- `primary`: primary actions, active emphasis, key status accents
- `accent`: subtle highlighted surfaces or contextual emphasis
- `muted`: secondary surfaces, empty states, quiet containers, helper regions
- `border`: default structural separation
- `destructive`: destructive actions, destructive alerts, critical validation

Do not use `primary` as a general background color for large page sections. Prefer `muted` or default surfaces for supporting content. Use borders lightly; if spacing already separates content clearly, skip the extra line. Keep radius consistent with the existing scale.

## Forms

Forms in this repo follow a specific composition:

- Use `@tanstack/vue-form`.
- Use generated Zod schemas when available.
- Use shadcn `Field`, `FieldSet`, `FieldGroup`, `FieldLabel`, `FieldDescription`, and `FieldError`.
- Use shadcn inputs such as `Input`, `Select`, and `Checkbox`.
- Keep validation inline under the field.
- Use Pinia Colada mutations for submit flows.
- Disable or show pending state on submit buttons while saving.
- Use toast for success/failure unless the failure is entirely field-level.

Preferred structure:

1. Start with a `Card`.
2. Add `CardHeader` with `CardTitle` and `CardDescription`.
3. Group related controls with `FieldSet` and `FieldGroup`.
4. Render each field through `form.Field`.
5. Keep validation errors directly below the control.
6. Put submit/reset actions at the bottom with clear pending state.

Avoid custom field wrappers unless multiple pages need the same behavior. Do not turn settings forms into wizard-like flows unless requested.

## Datatables And Filters

Datatables are a core product pattern. Reuse the shared datatable system:

- `DataTable`
- `DataTableToolbar`
- `DataTableSearch`
- `DataTableFacetedFilter`
- `DataTableDateRangeFilter`
- `DataTablePagination`
- `DataTableViewOptions`
- `DataTableColumnHeader`

Route query params are the source of truth for search, filters, sorting, and pagination:

- Search: `q`
- Page index: `page`
- Page size: `pageSize`
- Sort: `sort`
- Multi-select filters: use a stable string format already established on the page, typically comma-separated values
- Filter changes reset page to `1`

Implementation shape:

1. Read values from `route.query`.
2. Parse into typed filter state.
3. Update query through one centralized helper.
4. Drive data fetches or client filtering from parsed state.
5. Render controls through the shared datatable components.

Do not keep a second source of truth for table filters in local component state unless the interaction requires a temporary draft state. Search and filters belong in the toolbar. Column visibility belongs in view options. Loading, empty, and error states stay inside the table region.

## Cards

Use cards when they improve grouping, scannability, or action clarity:

- Settings and detail groups: card-friendly.
- KPI summaries: compact cards or stat panels.
- Dense multi-section pages: mix cards with open sections to avoid card overload.
- Quick action cards: one action-oriented title, one sentence of explanation at most, one primary action.

Do not wrap every nested subsection in another card. If every section is a card, re-evaluate whether some groups can be simplified into spacing plus headings.

## Overlays

Use overlays only when they reduce friction more than they add complexity:

- `Dialog`: short focused tasks, confirmations, destructive actions.
- `Sheet`: create/edit flows or contextual detail that should preserve page context.
- `Collapsible` or inline expansion: secondary detail within a page section.

Do not put large multi-section page architecture inside a dialog. Do not use overlays for content that should simply live on the page. Destructive overlays should say exactly what will happen. Footer actions should stay simple: cancel plus one clear primary action.

## State UX

Follow the repo's existing state behavior:

- Initial page or table load: skeletons.
- Background refetch: keep current content visible and show a subtle loading cue.
- Empty states: icon, concise message, clear next action.
- Page-level errors: inline `Alert`.
- Field-level failures: inline under the field.
- Transient action feedback: toast.
- Success/error banners should feel product-like, not celebratory.

Pending actions should disable the primary action while pending. Show a spinner only where it clarifies the active action, and keep button labels readable while loading.

## Action Bars

Action placement should feel obvious and low-noise:

- Keep one primary action per section or toolbar.
- Group secondary actions together.
- Push destructive actions away from the primary submit path.
- Keep save/reset/cancel patterns consistent across pages.
- Keep action labels direct and specific.

For table or list toolbars, search and filters come first, view controls second, and bulk or contextual actions last. Keep the toolbar responsive; stack instead of compressing everything into a cramped row.

## Content Tone

UI copy should feel operational and direct:

- Prefer sentence case.
- Keep labels short.
- Use plain language over product marketing language.
- Success messages should be calm and matter-of-fact.
- Error messages should state what failed and what to do next.
- Button labels should describe the action, not the emotion.

Examples:

- Prefer `Save changes` over `Update now`.
- Prefer `Could not save store settings` over `Oops! Something went wrong`.
- Prefer `No invoices found` over `Nothing here yet!`.

## Accessibility

Apply system-level accessibility rules by default:

- Every meaningful input needs a visible label unless the pattern clearly calls for an accessible alternate.
- Icon-only buttons need accessible text.
- Focus states must remain visible.
- Error text must remain close to the field or action that caused it.
- Destructive actions should be explicit in both label and visual treatment.
- Tables with row actions should keep those actions reachable by keyboard and understandable out of visual context.

## Decision Tree

Choose the simplest pattern that fits the task:

1. If the task edits a single record or settings group, use a form section or form card.
2. If the task compares or filters many records, use the datatable system.
3. If the task summarizes a small set of metrics, use compact dashboard cards.
4. If the task needs quick confirmation, use a dialog.
5. If the task needs create/edit detail without full navigation, use a sheet.
6. If the task is secondary metadata, use subdued text, badges, or description rows instead of a whole new panel.

## Workflow

When doing frontend UI work, follow this order:

1. Read this document.
2. Inspect the nearest existing page or component that solves a similar dashboard problem.
3. Identify the smallest set of shadcn primitives needed.
4. Preserve route-query, form, and mutation patterns before changing visuals.
5. Apply styling through semantic tokens and existing utility patterns.
6. Verify light mode, dark mode, mobile layout, loading state, empty state, and error state.

During review, also check that the main action is obvious, the screen is not over-carded, the copy is concise, the component choice matches the task type, and no state is hidden behind unnecessary indirection.

## Final Review Checklist

- Uses existing primitives before custom wrappers.
- Keeps the primary task obvious.
- Stays clean, simple, and minimal rather than decorative.
- Works in light and dark themes.
- Works on mobile without cramped control rows.
- Covers loading, empty, success, and error states.
- Keeps filters and pagination in query params where applicable.
- Avoids hard-coded colors when tokens already exist.
- Keeps destructive actions explicit and separated.
- Uses direct, operational copy.
