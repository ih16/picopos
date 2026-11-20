# picopos design system

picopos uses a cool gray canvas with translucent work surfaces, charcoal actions, and a compact order journey. The visual reference is [Customer Journey CRM Dashboard by Jack R. for RonDesignLab](https://dribbble.com/shots/24659454-Customer-Journey-CRM-Dashboard).

## Foundations

| Foundation | Implementation                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas     | Cool gray gradient with a blue-gray order board. Use `--canvas`, `--canvas-start`, and the board surface tokens.                                                                       |
| Surfaces   | Layered translucent panels use `--glass-surface`, `--glass-raised`, `--glass-soft`, `--glass-border`, and `--glass-shadow`. Keep solid `--surface*` fallbacks.                         |
| Actions    | Charcoal `--action` with white text for primary and selected controls. Use bordered white for secondary actions.                                                                       |
| Type       | DM Sans with a system fallback. Use the shared type scale for 20 px page titles, 18 px section headings, and 16 px subheadings. Use monospace for SKU values.                          |
| Spacing    | Use the 4, 8, 12, 16, 24, 32, and 48 px steps in `src/styles/tokens.css`.                                                                                                              |
| Shape      | 12 px inputs, 18 px cards, 25 px panels, and pill buttons.                                                                                                                             |
| Status     | Gray for draft, blue for in progress, lavender for shipped, sage for completed, amber for attention, and rose for cancellation or errors. Keep status text visible alongside the tint. |

## Theme

The top-right sun/moon toggle switches day and night mode. Theme colors live in `src/styles/tokens.css`; use semantic tokens for surfaces, text, borders, focus, and status colors. The initial theme follows the system preference unless `picopos.theme` is saved in local storage. The head script applies it before rendering to avoid a light flash.

## Components

- **Shell.** Keep the wordmark at the left, primary page navigation in the center, and workbook identity at the right. Use round utility buttons for workbook actions. At 760 px and below, pin the navigation icons to the bottom of the viewport. Keep the workspace shell and list filters stationary. Scroll the records or form fields inside their available space, with clearance inside the scroller for overlapping floating actions. Dialogs scroll their fields between the header and footer.
- **Journey.** Group the four main order stages into equal cards with genuine order previews and counts. Stage controls filter the order list. Order previews open the existing detail view. The board uses two columns at intermediate widths. On phones the order list and its status filter take priority, so the board is hidden.
- **Panels and tables.** Use a heading, optional filters, and aligned columns within a rounded panel. Align quantities right. Keep wide tables scrollable within their panel and wrap long customer or product names.
- **Metric cards.** Put the metric name above the value. Use a small semantic color dot and tabular digits. Calculate totals from the current workbook.
- **Forms.** Give each field a visible label and keep primary and secondary actions distinct. Use an inline message for errors. Disable writes while a save is in progress.
- **Input sizes.** Use `controlSize="sm"` (38 px) for compact filters and `controlSize="md"` (44 px, default) for forms on `Input`, `Textarea`, `SelectField`, and `MultiSelect`. Both presets share typography, horizontal padding, and radius from `src/styles/tokens.css`; textareas can grow vertically. On phones both presets have a 44 px minimum target and 16 px text. Do not add page-specific input height or padding overrides. Use `input-with-icon` for centered leading icons and reserve `--focus-clearance` inside scrollable toolbars so focus rings remain visible.
- **Badges.** Use the shared status palette and a short text label. Reserve status badges for values that describe the record.

## Accessibility and review

- All navigation, utility actions, journey previews, and filters can be operated by keyboard. Verify visible focus on white and gray surfaces and accessible names on icon buttons. For common actions, pass an icon and label to the shared Button. Keep both visible on phones wherever space allows. Use mobileIconOnly for crowded controls. A long press reveals the icon’s label.
- Pair status colors with text and verify WCAG AA text contrast before changing a token.
- Confirm the page fits at small widths and that wide tables scroll inside their panels.
- Use direct labels such as “New order”, “Sync now”, and “Add stock entry”. Keep helper text tied to the user’s next action.
- Reuse tokens and component classes when migrating a view. Avoid decorative controls, fictional data in connected workbooks, and color as the only status cue.
- Check the setup, orders, catalog, and inventory screens. Exercise order creation, filtering, and workbook actions after layout changes.

## Shared controls

Use the shared components in `src/shared/ui/controls.tsx`. Dialogs, disclosures, and expandable form sections use native HTML elements. The searchable combobox supports single and multiple selection. Keep native inputs and form selects inside the shared styled components where native validation, numeric keyboards, platform pickers, or FormData are useful. Keep structured data in semantic tables and labeled record lists.

On phones, use actions and input targets at least 44 px tall. At 680 px and below, show stacked records for the catalog, order lists and details, and stock balances and history. Keep long labels and SKUs wrapped inside the card. Editors open as bottom sheets, and the order form keeps its total and primary action visible at the bottom.

## Workflow design rationale

| Workflow        | Friction found                                                                                                                            | Change                                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product catalog | Edit actions opened a form above the results, and variant actions were off screen in wide tables. Search also missed variant option text. | Open a focused editor from the selected card. Search by name, SKU, or option, filter by category and active state, and show each variant's price, status, and edit action in a phone-sized record. |
| Order entry     | Optional fields pushed the items down, the variant menu was hard to scan, and the total was far from the items.                           | Start with customer name and items, tuck optional fields into disclosures, search by SKU or product, and offer quantity buttons, live line totals, and a sticky order summary.                     |
| Inventory       | Quantities and stock history were spread across wide tables, and users had to reselect the SKU when recording a change.                   | Show all four balances on phone cards, start a stock entry from its SKU, preview the resulting balance, and use an add or remove selector for adjustments. Search also filters the stock history.  |

For regression checks, edit a variant from a filtered catalog, build and confirm a two-unit order, and change stock from a SKU card. Check the same data at desktop widths and at 320 and 390 px. Test Select and Combobox with the keyboard and confirm Escape closes an open dialog.

For a simple product, show SKU and price. Reveal one field per option name when the user chooses **Add options**, then show the matching labels on the variant. Keep the optional product picture with the product details and show its thumbnail beside the catalog title.

## Dashboard and large lists

Dashboard charts use the same status and theme tokens as the order views. Keep metric definitions aligned with [the workflow guide](docs/workflows.md#dashboard): fulfilled order value is not a cash-received or profit metric. Charts need accessible labels and visible values or legends.

Large record lists use `src/shared/ui/paged-rows.tsx` to render measured pages selected by scroll offset. Preserve the scroll container and measurement behavior when changing row layouts. Review long names, expanded rows, filters, and scroll position at both desktop and phone widths.

Treat the accessibility items above as review requirements, not a claim that every browser and assistive technology has been certified. Recheck both themes after changing surface or focus tokens.
