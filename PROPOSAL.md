# Proposal: Essential table functionality

Status: Items 1–4 are implemented; the new export tests await CI validation. Item 5 remains proposed. See the [README](./README.md#cell-values-and-sorting) for the implemented API.

## Recommendation

Extend the existing table component with the capabilities needed to handle ordinary application data reliably:

1. Separate display, sort, filter, and export values, with explicit sorting rules.
2. Support column filters and a custom local row predicate.
3. Add bulk data replacement and insertion with one recalculation and draw.
4. Allow exports of the current page, all matching rows, or all local rows.
5. Expose a small, serializable state API for application-controlled restoration.

The first four are core functionality. The state API is the next priority because it enables URL synchronization, saved views, and persistence without applications reading generated controls or private fields. Automatic browser storage can follow separately.

Keep the existing strengths: native table markup, nested object data, stable multi-column ordering, pagination, remote loading with cancellation and stale-response protection, column visibility, sanitized display HTML, accessible controls, and CSV/XLSX/print output.

This proposal targets a capable table component. Spreadsheet editing, virtual scrolling, grouping, and a complete replication of DataTables are outside its initial scope.

## Original limitations

| Area | Current behavior | Consequence |
| --- | --- | --- |
| Cell values | `format()` affects display. Sorting, searching, and exporting read raw values. | Applications cannot independently choose human-readable text, sortable values, and export values. |
| DOM ingestion | `getDomData()` reads each cell's HTML. | Markup can influence sorting/searching and appear literally in exports. |
| Sorting | Values compare numerically when both are numeric; otherwise they compare as strings. | Currency strings and non-ISO dates need application workarounds. There is no custom comparator. |
| Filtering | One literal, case-insensitive substring is matched against individual searchable cells. | No independent column terms, exact matches, ranges, or custom predicates. |
| Data updates | Each `addRow()`, `setRow()`, or `setValue()` recalculates and redraws. | Replacing or inserting many rows performs repeated work. There is no dataset replacement method. |
| Exports | Built-in buttons collect the displayed page. | A local table cannot directly export every matching record across pages. |
| State | Search, order, page, and length methods are setters. `info()` provides counts and offsets. | Applications cannot obtain and restore a complete view through public methods. |

Relevant implementation: [table component](./src/js/table.js), [DOM and column helpers](./src/js/helpers.js), [export handlers](./src/js/buttons.js), and [public API](./README.md#methods).

## 1. Cell values and sorting

### Implemented API

Keep `columns.data` as the source accessor and retain `columns.format(value)` for existing configurations. Add an alternative renderer that can resolve a value for a particular operation:

```js
columns: [{
    data: 'salary',
    type: 'number',
    render(value, { purpose, row, column, rowIndex }) {
        if (purpose === 'display') {
            return new Intl.NumberFormat('en-AU', {
                style: 'currency', currency: 'AUD',
            }).format(value);
        }

        return value;
    },
}]
```

`purpose` is `display`, `sort`, `filter`, or `export`. `row` is the source row, `column` is the original column index, and `rowIndex` addresses the loaded dataset, not the current page. In remote mode it addresses the loaded response. Callbacks run with the table as `this`.

Recommended contracts:

- Existing `format()` behavior stays available. Supplying both `format` and `render` for one column is a configuration error, avoiding ambiguous precedence.
- Without `render`, JavaScript data keeps its existing raw values for non-display operations. `format()` remains display-only.
- Display output remains string-based and goes through the existing sanitizer. DOM-node rendering is a separate future feature.
- Filter values may be strings, numbers, booleans, or nullish values. Text search uses their string representation; typed filter operators use the column's conversion rules.
- Export values preserve scalar types where possible, including numeric zero and booleans. Export processing must not generate downloads or redraw the table while resolving values.
- Renderers should be pure. Document that they may run multiple times and must not depend on a particular invocation order.

### Sorting rules

Add `columns.type`, initially supporting `auto`, `string`, `number`, and `date`, plus an optional `columns.compare(a, b, context)` callback.

`auto` preserves the existing numeric-or-string comparison. An explicitly typed column normalizes resolved sort values before comparison. Date handling accepts valid `Date` values, epoch milliseconds, strict ISO dates, and ISO timestamps with an explicit offset. Dates such as `03/04/2026` require an application renderer that supplies an unambiguous value. Currency parsing is likewise explicit: store a number or resolve the formatted value to one.

The custom comparator receives resolved sort values and supplies an ascending comparison; the table applies the requested direction. It must return a finite number. Preserve source order when comparison keys are equal, including with multiple sort columns and `orderData`.

For explicitly typed columns, nullish, empty, and unparseable values form a missing-value group placed last in either direction. Equal missing values retain source order. Keep `auto` behavior compatible rather than silently imposing these new rules on existing tables.

### DOM-backed tables

Retain original HTML for display and existing raw getters, but store separate internal cell metadata for non-display operations:

- Default sort/filter/export values use text content, with entities decoded and markup removed.
- Optional cell attributes `data-order`, `data-search`, and `data-export` override the corresponding value. An absent attribute falls back to text content; an empty attribute is an explicit empty value.
- Explicit column renderers take precedence over inferred cell metadata.
- Row/cell mutation methods invalidate affected metadata and derive new operation values from the replacement data. Deleted rows must not leave metadata attached to shifted indexes.
- Disposal continues restoring the original DOM and listeners.

This intentionally changes DOM-backed search and export behavior. For example, `<strong>Alice</strong>` displays as before, matches `Alice`, and exports `Alice`. Searching for `strong` should no longer match that cell solely because of its markup. Document this correction prominently when released.

Acceptance examples: numeric salaries sort numerically while displaying currency; application-parsed dates sort chronologically; HTML tags do not leak into default DOM exports; custom sort values work with multi-column ordering; existing `format()` configurations still work.

## 2. Column filters and custom filtering

### Implemented API

Keep `search(term)` for global text search. Add an atomic replacement method for structured filters:

```js
table.setFilters([
    { column: 1, operator: 'equals', value: 'Engineering' },
    { column: 2, operator: 'gte', value: 90 },
]);

table.setFilters([]); // Remove structured filters.
```

Initial operators: `contains`, `equals`, `gt`, `gte`, `lt`, `lte`, and inclusive `between`. A `between` filter takes a two-element value array; reversed bounds are invalid. Filter descriptors must contain JSON-compatible values. Validate column indexes, operators, and values before changing active filters.

Combine the global search, every structured filter, and the optional local predicate with AND. Global search continues matching any searchable column. Text operators retain case-insensitive matching; numeric/date operators use the column's explicit type and resolved filter value. Document coercion, missing-value behavior, and invalid range handling consistently with sorting.

Use original column indexes, matching the existing ordering and visibility APIs. Hidden columns remain filterable when `searchable` is true. Reject filters targeting non-searchable columns. As with `search()`, filter setters do nothing when `searching` is disabled; hiding the search control through `layout` does not disable filtering.

Provide one local predicate for application rules that structured filters cannot express:

```js
table.setRowFilter((row) => row.active && row.score >= row.requiredScore);
table.setRowFilter(null);
```

Predicates receive source rows and return booleans. They are application-owned functions, excluded from serializable state. Filtering changes reset the page, update counts, and perform one recalculation/draw. Invalid structured filter input leaves the previous filters intact. A nonempty dataset with no matching rows uses the translated `noResults` message even when the global search term is empty.

### Remote behavior

Extend the existing request with a `filters` array only when structured filters are active. Keep `term`, numeric-keyed `order` and `columns`, `offset`, and `limit` compatible. Each filter identifies the original column; its accessor and optional name remain available in `request.columns`.

The server applies the same filter semantics to the full dataset and returns matching counts. Reject local predicates in remote mode: filtering only a loaded page would produce misleading counts and pagination. Do not send functions or assume that the server can execute a renderer or comparator. Applications must implement equivalent server-side conversion and filtering rules.

Reuse existing debouncing, cancellation, response validation, and stale-result protection. A filter change during an outstanding request must invalidate that response.

Acceptance examples: exact team plus numeric threshold; inclusive date range; clearing column filters while retaining global search; correct counts and page reset; identical structured filters in remote requests; stale filtered responses ignored.

## 3. Bulk data APIs

### Implemented API

```js
table.addRows(newRows);
table.setData(replacementRows);
table.setData(replacementRows, { resetPage: false });

const matchingRows = table.getData({ scope: 'filtered' });
```

| Method | Contract |
| --- | --- |
| `addRows(rows)` | Validate and shallow-copy the entire input, append it, then recalculate and draw once. Preserve the active view and clamp its page if needed. |
| `setData(rows, { resetPage = true } = {})` | Replace the local dataset atomically. Preserve active search, filters, ordering, and visibility. Reset to page one by default; otherwise retain and clamp the current page. |
| `getData({ scope = 'page' } = {})` | Return shallow row copies for the displayed page, all filtered rows, or all local rows. Use the same scope and ordering rules as exports. |

Mutators return `void`, following the existing API. Empty `addRows([])` is a no-op. `setData([])` produces an empty dataset while preserving the view configuration. Existing `clear()` retains its documented behavior of clearing rows and search state; it should also clear the new structured filters and local predicate.

Validate all incoming rows before mutating the dataset. Invalid input must not leave a partially inserted batch. Shallow-copy semantics should match `addRow()` and `getRow()`; nested data is not deep-cloned.

Make the new bulk mutators local-only initially and reject their use with `getResults`. Remote applications persist changes through their own service and call `reload()`. Existing single-row remote mutation behavior remains as documented.

General-purpose `batch(callback)` transactions are deferred. Bulk replacement and insertion solve the immediate need without introducing rollback semantics, deferred exceptions, or a new async transaction lifecycle.

Acceptance examples: inserting 1,000 rows causes one recalculation and draw; a malformed final row inserts nothing; replacement preserves filters and ordering; retaining a page clamps correctly when the dataset shrinks; returned arrays cannot directly change the table's row containers.

## 4. Export scopes and reusable export data

### Implemented API

```js
buttons: [
    { type: 'csv', scope: 'filtered', title: 'Matching scores' },
    { type: 'excel', scope: 'all', title: 'All scores' },
    { type: 'print', scope: 'page', title: 'Current page' },
]

const exportData = table.getExportData({
    scope: 'filtered',
    columns: [0, 2],
});
```

| Scope | Local rows | Remote rows |
| --- | --- | --- |
| `page` | Current displayed page | Current loaded page |
| `filtered` | All rows matching global search, structured filters, and the local predicate, across pages | Unsupported by built-in collection |
| `all` | Entire local dataset, ignoring filters | Unsupported by built-in collection |

Preserve `page` as the default. Apply active ordering for each local scope; an empty order preserves input order. Visibility and explicit `columns` selection behave as they do today. `getExportData()` returns fresh `{ headings, rows }` arrays using resolved export values.

Exporting must not change the current page, length, search, filters, or visible columns. Share the row-selection pipeline with `getData()` instead of temporarily disabling pagination or making hidden calls to `length()`.

Remote `filtered` and `all` requests must fail clearly rather than silently exporting only the loaded page. Use the existing custom button callback to call an application-owned export endpoint. A standardized server export hook can be designed later if real integrations need it.

Keep current CSV escaping and formula handling, XLSX type preservation, and print behavior. Correct DOM text extraction and any explicit export renderer run before format-specific encoding. Typed sorting should not automatically replace useful original export values with internal sort keys.

Acceptance examples: export all 37 matches from a five-row page without altering the view; export all local rows while a filter is active; preserve custom column order; retain zero/false/Unicode values; refuse unsupported remote scopes; retain formula escaping for resolved export strings.

## 5. Readable and restorable state

### Proposed API

```js
const state = table.getState();
table.setState(state);
```

The state snapshot should be versioned and contain:

- Global search text and structured filters.
- Active order, page length, and one-based page.
- Column identity and visibility.

Exclude data rows, functions, local predicates, DOM nodes, pending requests, loading indicators, and transient errors. Return fresh nested arrays/objects so callers cannot mutate live table state through the snapshot.

Column identity should include the existing data accessor and optional name. The first implementation should require a matching column schema and reject incompatible snapshots. Supporting renamed, inserted, or reordered columns across saved-state versions is a later extension.

Validate the complete snapshot before applying anything. Restore its values together, synchronize controls, and perform one local recalculation/draw or one remote load. Remote page clamping may require the existing corrective request. Reject state requiring disabled features rather than partially restoring it. An existing local predicate remains application-owned and active; restoring state does not recreate or clear it.

Expose a `statechange.ui.table` notification with a fresh snapshot after a committed view change. It describes view configuration, not remote request completion. Existing `draw.ui.table` and `error.ui.table` remain the completion signals. Suppress duplicate notifications when a compound operation applies an unchanged or equivalent state.

Automatic `localStorage`/`sessionStorage` persistence is deferred. Applications can choose their own storage, URL mapping, expiration, and account-specific keys using the state API. Storage failure should not become a prerequisite for basic table operation.

Acceptance examples: round-trip search/order/page/visibility/filters; reject malformed or incompatible snapshots without partial changes; clamp a restored page after data shrinks; return an independent snapshot; restore remote state without intermediate requests for every individual setting.

## Internal changes and compatibility

The key structural change is to retain the complete ordered filtered index set separately from the paginated index set. The current local pipeline discards the full matching index list after slicing. Keeping both makes filtered getters, exports, counts, and page clamping share one source of truth.

Introduce small helpers for operation-specific value resolution, typed comparison, and structured filter evaluation. Keep orchestration and lifecycle ownership in `Table`. Invalidate derived values after data mutations and avoid caches whose correctness depends on applications never changing nested objects.

Preserve cancellation, callback re-entry protection, disposal, and source-order tie-breaking throughout the refactor. New user callbacks must not allow an obsolete operation to draw after disposal or a newer state change.

Most additions are opt-in. Preserve existing method signatures, non-chainable returns, default export scope, local substring search, and the current remote request shape when new filters are absent. State belongs in separate runtime fields rather than mutations of the shallow-frozen `instance.options`.

The intentional compatibility change is DOM-backed non-display values becoming text rather than HTML. Review this against the release status before shipping: include it in the next major release if an already published contract requires preserving the old behavior. No package version bump is part of this proposal.

## Delivery plan

| Phase | Deliverable | Completion criteria |
| --- | --- | --- |
| 1 | Shared value resolution, DOM text handling, explicit sorting, and full filtered indexes | Existing basic behaviors remain compatible; formatted and DOM-backed data have predictable operation values. |
| 2 | Bulk data APIs and scoped data retrieval | Data can be replaced or appended in one update; complete matching rows are publicly accessible. |
| 3 | Structured filters and local predicates | Local filtering composes correctly; remote requests carry serializable filters with cancellation preserved. |
| 4 | Export scopes and public export-data collection | Local full-result exports work without view changes; unsupported remote scopes are explicit. |
| 5 | State snapshots and restoration | Applications can persist or synchronize views using only public APIs. |

For each phase, update JSDoc, the README, and the existing relevant demo. Keep examples consolidated rather than adding a separate table for each option. Update generated bundles and maps with implementation changes.

Add focused component coverage to the existing local-data, rendering, remote-data, and export suites. Use deterministic assertions such as draw counts and unchanged state instead of timing-based performance thresholds. Do not recreate a demo-specific test suite. The current request is documentation-only, and the instruction not to run tests locally remains in effect; implementation validation can run in CI.

## Follow-up features

| Feature | Recommendation |
| --- | --- |
| Stable row IDs | First follow-up for application integration. Define identity and duplicate-ID handling before selection persistence or keyed updates. |
| Row selection | Add when bulk actions are required, built on stable IDs. Define current-page versus all-filtered selection, especially for remote data. |
| Column visibility picker | A small UI addition after visibility state is readable. Reuse the existing hide/show methods and Frost UI controls. |
| Responsive detail rows | Useful for wide mobile tables. Define column priority, disclosure accessibility, and interaction with hidden columns before implementing. |
| Automatic state persistence | Build on the state API with explicit storage keys, schema versions, and expiration rules. |
| Sticky headers/columns, complex headers, grouping, editing, virtualization | Evaluate from concrete use cases after the core work. These should not delay the initial improvements. |

## Reference behavior

These DataTables references establish comparable capabilities; the proposed API remains consistent with Frost UI Tables:

- [Separate values for display, ordering, and filtering](https://datatables.net/manual/core/data/orthogonal-data).
- [Column search and custom predicates](https://datatables.net/ref/core/api/column().search()).
- [Bulk row addition with deferred drawing](https://datatables.net/ref/core/api/rows.add()).
- [Export row selection and value formatting](https://datatables.net/ref/core/api/buttons.exportData()).
- [State saving and restoration](https://datatables.net/ref/core/option/stateSave).
- [Row identity](https://datatables.net/ref/core/option/rowId), [selection](https://datatables.net/manual/extensions/select/), [column visibility controls](https://datatables.net/ref/core/button/colvis), and [responsive detail rows](https://datatables.net/manual/extensions/responsive/).
