# Proposal: Row identity, selection, and table controls

Status: Items 1–4 are implemented; the new responsive tests await CI validation. See the [README](./README.md#stable-row-identity) for the supported APIs.

## Recommendation

Build the remaining functionality in this order:

| Priority | Feature | Purpose |
| --- | --- | --- |
| 1 | Stable row IDs | Address the same record across ordering, filtering, pagination, and data replacement. |
| 2 | Row selection | Support bulk actions with explicit selection scope and predictable remote behavior. |
| 3 | Column visibility picker | Let users choose displayed columns through the existing button and visibility APIs. |
| 4 | Responsive detail rows | Keep wide tables usable in narrow containers while retaining access to collapsed fields. |

Keep each feature opt-in and preserve native table markup, original column indexes, existing positional row methods, and non-chainable mutation methods. Build on the current value resolution, filtering, data scopes, and state APIs rather than introducing separate pipelines.

## 1. Stable row IDs

### Implemented API

Add a `rowId` option, defaulting to `null`. Accept a string data key or dot path, a numeric array key, or a pure callback receiving the source row with the table as `this`.

```js
const table = new Table(node, {
    data: employees,
    rowId: 'employee.id',
    columns: [
        { data: 'name' },
        { data: 'team' },
    ],
});

const id = table.getRowId(0);
const employee = table.getRowById('employee-42');

table.setRowById('employee-42', replacementEmployee);
table.removeRowById('employee-42');
```

| Method | Contract |
| --- | --- |
| `getRowId(index, { modified = true } = {})` | Return the configured identity for a positional row, using the existing page/dataset index rules. |
| `getRowById(id)` | Return a shallow copy of the matching loaded row, or `null` when it is absent. |
| `setRowById(id, row)` | Replace a loaded row once, preserving its identity and using the existing mutation pipeline. |
| `removeRowById(id)` | Remove a loaded row once and update counts, selection, and results. |

Identity methods require `rowId`; reject their use without it. Reject malformed IDs with `TypeError`; keyed mutations targeting an absent row throw `RangeError`. Remote keyed methods address only the loaded response and retain the existing single-row mutation behavior. They do not persist changes to a server or fetch an absent record.

### Identity rules

- Accept nonempty strings and safe integers, including zero. Preserve their types: `42` and `'42'` are different IDs. Reject nullish values, empty strings, booleans, objects, and other numbers.
- Require every row to have a valid, unique ID when identity is enabled. Do not fall back to a positional index or generate an ID that changes on reload.
- Resolve identity from source data, independently of display renderers and visible columns. The ID need not be a displayed column.
- Maintain an ID-to-loaded-index map. Sorting, filtering, and pagination change the view, not identity. Update the map after insertions, removals, and replacements.
- Validate all incoming identities before committing an initial dataset, insertion batch, replacement dataset, or remote response. An insertion must also check for collisions with existing rows. Invalid batches leave existing data, selection, and the identity map intact.
- Replacing an existing row through either positional or keyed methods must retain its ID. Reject `setValue()` changes that alter the resolved ID as well, including changes to a parent object containing the ID. Removing and inserting a record is the explicit way to change identity.
- Treat `setData()` as replacement of the complete local dataset. Reusing an ID means the replacement row represents the same record, even if its other fields differ.
- Identity callbacks must be pure and deterministic. As with other row data, callers must use mutation methods rather than changing shared nested objects behind the table's back.

Keep application IDs separate from DOM `id` attributes. Any IDs needed for labels and disclosure controls should be generated per table instance; application IDs may contain characters unsuitable for selectors or be shared across tables.

DOM-backed tables can use a source cell key or a callback over the ingested row. Automatic adoption of existing `<tr id>` or `data-row-id` attributes is deferred; do not silently infer a new identity contract from existing markup.

### Remote behavior

Validate uniqueness within each accepted response. The application/server owns uniqueness and stability across pages because the table cannot inspect unloaded records. A repeated ID on a later page or reload refers to the same record.

Invalid identity data follows the existing remote error lifecycle without partially installing rows or changing selection. Cancelled and stale responses must not update identity maps. Clear loaded identity metadata on `clear()` and disposal.

### Acceptance criteria

- A keyed read/update still targets the correct record after ordering, filtering, paging, and removal of preceding rows.
- Duplicate IDs, including a duplicate at the end of a batch, reject the whole update.
- Zero, numeric/string distinctions, nested keys, array rows, and callback IDs behave consistently.
- Replacement preserves identities; single-row mutations cannot silently change them.
- Invalid or stale remote responses cannot replace the active identity map.

## 2. Row selection

### Implemented API

Add `selection: false | 'single' | 'multiple'`, defaulting to `false`. Selection requires `rowId`; reject enabled selection without configured identity.

```js
const table = new Table(node, {
    data: employees,
    rowId: 'id',
    selection: 'multiple',
});

table.setSelectedIds(['employee-42', 'employee-87']);
table.selectRows({ scope: 'filtered' });
table.deselectRows({ scope: 'page' });

const ids = table.getSelectedIds();

table.setSelectedIds([]);
```

| Method | Contract |
| --- | --- |
| `getSelectedIds()` | Return an independent array of selected IDs in selection insertion order. |
| `setSelectedIds(ids)` | Validate and replace the complete selection atomically; an empty array clears it. |
| `selectRows({ scope = 'page' } = {})` | Add IDs from the requested data scope to the current selection. |
| `deselectRows({ scope = 'page' } = {})` | Remove IDs from the requested data scope while retaining other selections. |

Use the existing `page`, `filtered`, and `all` scope definitions. Deduplicate repeated input IDs while preserving their first occurrence. In local mode, reject IDs absent from the dataset. In single mode, reject any operation whose resulting selection contains more than one ID; choosing a row through the UI replaces the previous selection.

Keep `getSelectedIds()` as the authoritative bulk-action input. A separate selected-data scope or selected export mode can follow later; callers must not mistake loaded remote row data for every selected record.

### Selection lifetime

- Preserve selection across ordering, search, filters, page changes, page-length changes, and column visibility changes. Filtered-out selections remain selected.
- On local `setData()`, retain selected IDs present in the replacement and remove missing IDs. Inserting rows does not automatically select them; removing a row removes its ID from selection.
- Preserve selection when a row is replaced with the same ID. A data-only edit does not emit a selection event.
- `clear()` clears selection. Disposal releases all selection state and listeners.
- Keep selection separate from the version-1 view snapshot. `setState()` does not change it. Applications can save and restore the ID array explicitly; automatic selection persistence is outside this feature.

Emit `selectionchange.ui.table` after an effective selection change, with fresh arrays in `event.detail`: `{ selectedIds, addedIds, removedIds }`. Equivalent selections do not notify; changing only the input ID order should not count as a selection change. One bulk operation emits one aggregate notification after committing its result. Data replacement/removal should report any pruned selection through the same event.

Selection changes must not recalculate filtering or sorting, change pagination, or request remote data. Update mounted controls and row styles together. Listeners may change selection again or dispose the table; obsolete work must stop using the existing callback guards.

### Controls and accessibility

Render a dedicated selection control cell without adding a data column. Original column indexes, getters, sorting, exports, and state schemas remain unchanged. Use native checkboxes for multiple selection and radios for single selection, with localized accessible labels and a table-specific radio group.

For multiple selection, the header checkbox selects or deselects the current page only. It is checked when all page rows are selected, indeterminate when some are selected, and disabled on an empty page. Selections on other pages do not alter its page-specific meaning. Label it explicitly, for example, “Select all rows on this page.” Omit the header selection control in single mode.

Use the controls as the initial interaction model. Avoid whole-row click handlers that compete with links, editable fields, or responsive disclosure buttons. Preserve visible focus and native keyboard behavior, and show selection through both the checked control and a row class. Keep the table's native semantics rather than changing it into an ARIA grid.

Provide a localized selected-count layout control, for example `selection`, with a clear-selection button. Place it above the table in the existing demo so selections hidden by paging or filters remain apparent. Hiding this control through `layout` must not disable selection.

### Remote behavior

Retain selected IDs across accepted page loads and reloads. Absence from one response is not evidence that a record was deleted. Allow `setSelectedIds()` to include valid IDs not currently loaded, so applications can restore or reconcile a selection explicitly.

`selectRows()` and `deselectRows()` support only `page` for remote tables. Reject `filtered` and `all` before changing anything. Do not implement “select all matching remote records” by fetching every page or assuming the currently loaded IDs represent all matches. Query-wide selection with exclusion lists requires a separate server contract.

Remote bulk actions receive IDs, not cached row objects. The application must handle deleted records or changed permissions and explicitly reconcile the resulting selection. The table does not retain stale copies of every selected row.

### Acceptance criteria

- Selection survives local view changes and remote page changes without selecting the wrong record.
- Header checkbox state reflects the current page, including empty and partially selected pages.
- Local replacement prunes missing IDs once; remote replacement preserves unloaded IDs.
- Invalid IDs, invalid single-selection results, and unsupported remote scopes leave selection unchanged.
- Bulk operations emit one independent event payload; unchanged selections emit none.
- Keyboard interaction, nested row controls, callback re-entry, and disposal remain safe.

## 3. Column visibility picker

### Implemented API

Add a built-in `columns` button using the existing button registry and Frost UI controls:

```js
buttons: [
    { type: 'columns', text: 'Columns', columns: [0, 1, 2] },
    { type: 'csv', scope: 'filtered' },
]
```

The optional `columns` list selects and orders entries in the picker using original column indexes. Without it, include every data column, including initially hidden columns. Validate indexes and reject duplicate entries. Generated selection/disclosure cells are not data columns and never appear in the picker.

Use heading text for labels, with a localized numbered fallback for blank headings. Do not insert raw heading HTML into control labels. Respect the existing button label, `lang`, classes, and input styling conventions.

### Behavior

- Present a labelled popover or dropdown containing native checkboxes. Use a disclosure button with an expanded state; do not apply menu roles without implementing their keyboard contract.
- Each checkbox reflects the column's configured visibility. Toggle through the existing `showColumn()` / `hideColumn()` behavior and produce the normal state notification.
- Keep the picker synchronized when visibility changes through API methods or `setState()`, including while it is open. Opening the picker must not redraw or fetch rows.
- Keep it open while toggling multiple columns. Preserve focus on the active checkbox after a table redraw. Escape closes it and returns focus to the trigger; outside interaction dismisses it using the existing Frost UI conventions.
- Preserve current support for hiding all data columns. Keep the picker reachable in the toolbar so users can restore them, and handle empty-row/footer spans correctly. Do not add a restriction that conflicts with existing visibility methods or saved state.
- Column visibility continues to affect default export columns. Explicit export column lists may still include hidden columns.

With responsive behavior enabled, checkboxes represent user visibility, not whether a column currently fits. A checked column may appear in a detail row. Responsive width changes must not toggle picker checkboxes or emit view-state changes.

No additional persistence mechanism is needed: existing column visibility already belongs to `getState()` / `setState()`.

### Acceptance criteria

- Initial hidden columns, custom column subsets/order, blank headings, and text-safe labels render correctly.
- API changes and state restoration synchronize an open picker without losing focus.
- Each toggle performs one visibility redraw, without resetting search, order, or page and without remote loading.
- Hiding all data columns remains recoverable; generated utility cells do not alter data indexes.
- Keyboard dismissal, disposal, and multiple table instances do not leave orphaned controls or listeners.

## 4. Responsive detail rows

### Implemented API

Add `responsive: true`, defaulting to `false`, and a `columns.responsivePriority` option. Smaller numbers have higher priority to remain in the main row. Use a default priority of `1000`; `null` means the column must remain in the main row.

```js
const table = new Table(node, {
    data: employees,
    rowId: 'id',
    responsive: true,
    columns: [
        { data: 'name', responsivePriority: null },
        { data: 'team', responsivePriority: 1 },
        { data: 'email', responsivePriority: 2 },
        { data: 'notes', responsivePriority: 3 },
    ],
});
```

Accept nonnegative safe integers or `null` for priorities. Collapse lower-priority columns first; for equal priorities, collapse from right to left in original column order. Retain at least one user-visible data column in the main row when any exist. If required columns and utility controls still cannot fit, retain horizontal scrolling.

### Visibility and layout

Maintain two distinct concepts:

- **Configured visibility:** the existing `columns.visible` setting, controlled by APIs, the picker, and saved state.
- **Responsive collapse:** a temporary layout decision based on available container width.

Only configured-visible columns may collapse into details. User-hidden columns must not reappear there. Sorting, searching, data access, and export collection continue to operate on the existing data/visibility rules; a narrow viewport must not remove fields from a default export or modify `getState()`.

Measure the table's container rather than the window. Observe container resizing, account for selection/disclosure control widths, and re-evaluate after data draws, visibility changes, and initial font loading. Coalesce resize work and avoid a measurement cycle that alternately hides and reveals the same column. A table initialized in a hidden container should defer measurement until it has usable width.

Update headings, body cells, footers, and spans consistently. Width-only changes must not rerun filtering, reset paging, or issue remote requests. Preserve existing horizontal scrolling when responsive behavior is disabled.

### Detail content and disclosure

Add a dedicated disclosure button only when a row has responsive-collapsed fields. Keep this utility cell separate from data column indexes and the selection control. Opening details inserts one companion `<tr>` immediately after its data row, with a cell spanning the rendered columns and utility cells.

The initial detail renderer should produce labelled values in original column order, using heading text and the existing sanitized display-value pipeline. Resolve values with the same source row and original column context as main cells. Do not use export values, clone live interactive controls, or call row/cell creation callbacks as though the companion row were another data record. Stateful widgets and custom detail-renderer callbacks are deferred.

- Use a native button with `aria-expanded`, `aria-controls`, and a localized accessible label. Generate unique DOM IDs independently of application row IDs.
- Support Enter/Space through native button behavior and keep focus on the disclosure button when toggling. If a resize removes the focused disclosure control, move focus to the owning data row using a temporary programmatic focus target.
- Do not make the entire row clickable. Selection, links, and other controls retain their own behavior.
- Detail rows do not affect row counts, pagination, selected IDs, exports, positional getters, or data-row callbacks.
- If resizing reveals every collapsed column, remove the detail row and disclosure control and clear its expansion state.

Responsive behavior should work without stable IDs. Without `rowId`, clear expansion on each data redraw to avoid associating details with a different positional row. With identity enabled, retain expansion for IDs still present on the displayed page during redraw, and discard it when a row leaves that page. Do not accumulate remote expansion history or persist it in the view-state snapshot.

### Lifecycle and acceptance criteria

Disconnect observers, cancel queued resize work, remove generated detail content/listeners, and restore the original table markup on disposal. Respect existing draw-version guards when display callbacks dispose the table or trigger another update.

Acceptance examples:

- A narrow container collapses lower-priority fields and exposes their labelled values through keyboard-operable details.
- Resizing a parent layout updates the table without a window resize or remote request.
- Hidden columns remain absent from both main and detail rows; responsive collapse leaves saved visibility and default exports unchanged.
- Ordering, filtering, paging, replacement, and selection never attach an open detail row to the wrong record.
- Empty results, all user-hidden columns, long unbreakable content, RTL layouts, hidden initialization, and multiple tables remain usable.
- Header/body/footer spans remain correct with selection and responsive controls enabled together.

## Delivery and validation

Implement stable identity before selection. The visibility picker can then build directly on existing visibility state, followed by responsive details once the interaction between controls is established.

For each feature:

1. Add small normalization helpers and keep state/lifecycle ownership in `Table`. Follow existing ordering, grouping, and blank-line conventions; avoid a separate framework for these additions.
2. Document options, methods, events, remote limitations, and state behavior in JSDoc and the README.
3. Extend the existing relevant demo, keeping controls beside or above the table they affect and preserving the sibling-project demo style.
4. Add focused component coverage for validation, atomic updates, events, accessibility, remote cancellation, callback re-entry, and disposal. Include combined selection/picker/responsive cases where utility cells and visibility interact.
5. Rebuild tracked bundles and maps with implementation changes. Keep the demo-specific test suite removed. Do not run tests locally; test execution remains for CI under the current instruction.

Selection events and temporary responsive layout must remain separate from `statechange.ui.table`. Keep the current state schema unchanged unless a later proposal explicitly adds persistence for these features.

## Deferred work

Query-wide remote selection, selected-row export scopes, automatic browser storage, custom detail renderers, and persistent detail expansion can follow concrete integration needs. Sticky headers/columns, complex headers, grouping, editing, and virtualization remain outside this proposal.
