# Frost UI Tables

[![CI](https://github.com/frost-js/ui-tables/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/frost-js/ui-tables/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/frost-js/ui-tables/branch/main/graph/badge.svg)](https://codecov.io/gh/frost-js/ui-tables)
[![npm version](https://img.shields.io/npm/v/%40fr0st%2Fui-tables?style=flat-square)](https://www.npmjs.com/package/@fr0st/ui-tables)
[![npm downloads](https://img.shields.io/npm/dm/%40fr0st%2Fui-tables?style=flat-square)](https://www.npmjs.com/package/@fr0st/ui-tables)
[![JS gzip size](https://img.badgesize.io/frost-js/ui-tables/main/dist/frost-ui-tables.min.js?compression=gzip&label=JS%20gzip%20size&style=flat-square)](https://github.com/frost-js/ui-tables/blob/main/dist/frost-ui-tables.min.js)
[![CSS gzip size](https://img.badgesize.io/frost-js/ui-tables/main/dist/frost-ui-tables.min.css?compression=gzip&label=CSS%20gzip%20size&style=flat-square)](https://github.com/frost-js/ui-tables/blob/main/dist/frost-ui-tables.min.css)
[![license](https://img.shields.io/github/license/frost-js/ui-tables?style=flat-square)](./LICENSE)

Sortable, searchable tables for Frost UI, with pagination, remote data, and CSV, Excel, and print exports.

## Highlights

- Native table markup, array rows, or object rows with nested column paths
- Case-insensitive searching, typed multi-column sorting, pagination, and a column visibility picker
- Separate display, sort, filter, and export values, with custom comparisons
- Column filters, numeric/date ranges, and custom local row predicates
- Bulk local updates and scoped access to page, filtered, or all rows
- Stable row IDs, keyed row updates, and single/multiple selection
- Responsive column priorities and accessible detail rows
- Serializable view snapshots and atomic state restoration
- Debounced remote requests, optional cancellation, and stale-response protection
- Row/cell/header/footer callbacks and custom layouts/buttons
- CSV, XLSX, and print exports of the displayed results
- Keyboard sorting, accessible controls, filled/outline inputs, and RTL support
- Native `Table` class and `table` fQuery plugin
- Existing-instance reuse with frozen resolved options
- Prebuilt ESM and UMD bundles with source maps
- Expanded and minified component CSS with source maps
- JSDoc-powered IntelliSense

Explore [the demo](./demo/index.html) for interactive examples.

## Installation

### Browser projects / bundlers

```bash
npm i @fr0st/ui-tables
```

Frost UI Tables's package entry point is ESM-only and requires a browser DOM. Import the default `Table` export and the stylesheets in browser projects and bundlers.

```js
import '@fr0st/ui/dist/frost-ui.min.css';
import '@fr0st/ui-tables/dist/frost-ui-tables.min.css';
import Table from '@fr0st/ui-tables';
```

`@fr0st/ui` and `@fr0st/query` are peer dependencies so the component shares the application's instances.

### Browser (ESM)

The ESM bundle imports `@fr0st/ui` and `@fr0st/query`. fQuery also imports `@fr0st/core`, so map all three dependencies when loading the bundle directly in a browser:

```html
<link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/@fr0st/ui@latest/dist/frost-ui.min.css">
<link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/@fr0st/ui-tables@latest/dist/frost-ui-tables.min.css">
<script type="importmap">
{
    "imports": {
        "@fr0st/core": "https://cdn.jsdelivr.net/npm/@fr0st/core@latest/dist/frost-core.esm.min.js",
        "@fr0st/query": "https://cdn.jsdelivr.net/npm/@fr0st/query@latest/dist/fquery.esm.min.js",
        "@fr0st/ui": "https://cdn.jsdelivr.net/npm/@fr0st/ui@latest/dist/frost-ui.esm.min.js"
    }
}
</script>
<script type="module">
    import Table from 'https://cdn.jsdelivr.net/npm/@fr0st/ui-tables@latest/dist/frost-ui-tables.esm.min.js';
</script>
```

### Browser (UMD)

Load the bundles from your own copy or a CDN:

```html
<link
    rel="stylesheet"
    href="/path/to/dist/frost-ui.min.css">
<link
    rel="stylesheet"
    href="/path/to/dist/frost-ui-tables.min.css">
<script src="/path/to/dist/frost-ui-bundle.min.js"></script>
<script src="/path/to/dist/frost-ui-tables.min.js"></script>
<!-- or -->
<link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/@fr0st/ui@latest/dist/frost-ui.min.css">
<link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/@fr0st/ui-tables@latest/dist/frost-ui-tables.min.css">
<script src="https://cdn.jsdelivr.net/npm/@fr0st/ui@latest/dist/frost-ui-bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@fr0st/ui-tables@latest/dist/frost-ui-tables.min.js"></script>
<script>
    const { Table } = globalThis.UI;
</script>
```

The UMD bundle adds `Table` to the existing `globalThis.UI` object. Load Frost UI's all-in-one bundle first; it supplies the `UI` and `fQuery` globals.

The package root resolves to the prebuilt ESM bundle. Published files under `dist/` and `src/` are also available through matching package subpaths.

## Usage

Start with a captioned table and a single header row without row/column spans:

```html
<table id="scores">
    <caption>Team scores</caption>
    <thead><tr><th>Name</th><th>Score</th></tr></thead>
    <tbody>
        <tr><td>Alice</td><td>30</td></tr>
        <tr><td>Bob</td><td>20</td></tr>
    </tbody>
</table>
```

```js
const table = Table.init(document.querySelector('#scores'), {
    order: [[1, 'desc']],
    inputStyle: 'outline',
    buttons: [{ type: 'csv' }, { type: 'excel' }, { type: 'print' }],
});
```

Original classes and the caption are preserved; disposal restores the original children and their listeners, not the edited data currently displayed.

## Options

Options are resolved in this order:

1. Component defaults
2. The element's `data-ui-*` attributes
3. Options passed to `Table.init()`

Resolved `instance.options` are shallow-frozen.

Use methods to update active instances. Set `Table.defaults` and `Table.classes` before initialization for application-wide defaults and matching custom structural/state classes.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `buttons` | `array` | `[]` | Export/custom button configurations. |
| `columns` | `array \| null` | `null` | Column definitions, one per heading; see below. |
| `createdRow` | `function \| null` | `null` | Customize each inserted row. |
| `data` | `array \| null` | `null` | Local rows; otherwise read `<tbody>` cell HTML. |
| `debounce` | `number` | `250` | Local input-search / remote-request delay in milliseconds. |
| `drawCallback` | `function \| null` | `null` | After inserting the displayed rows. |
| `footerCallback` | `function \| null` | `null` | Customize the cloned original footer. |
| `getResults` | `function \| null` | `null` | Remote loader; takes precedence over local data. |
| `headerCallback` | `function \| null` | `null` | Customize the heading row. |
| `icons` | `object` | See below | Trusted HTML for pagination icons. |
| `info` | `boolean` | `true` | Render the result-count status. |
| `infoCallback` | `function \| null` | `null` | Return the result-count text. |
| `inputStyle` | `'filled' \| 'outline'` | `'filled'` | Search and length control style. |
| `lang` | `object` | See below | Interface and accessibility labels. |
| `layout` | `object` | See below | Top/bottom control layouts. |
| `length` | `number` | `10` | Positive integer page length. |
| `lengthChange` | `boolean` | `true` | Render the length control when paging is enabled. |
| `lengths` | `number[]` | `[10, 25, 50, 100]` | Available positive page lengths. |
| `order` | `array` | `[[0, 'asc']]` | Priority-ordered column/direction pairs; `[]` preserves input order. |
| `ordering` | `boolean` | `true` | Enable sorting. |
| `paging` | `boolean` | `true` | Enable pagination; `false` displays all loaded rows. |
| `preDrawCallback` | `function \| null` | `null` | Before drawing; return `false` to retain current DOM. |
| `renderDetails` | `function \| null` | `null` | Return custom responsive detail HTML from `(row, { rowIndex, columns })`. |
| `responsive` | `boolean` | `false` | Collapse lower-priority columns into detail rows when the container narrows. |
| `rowCallback` | `function \| null` | `null` | Customize each row before insertion. |
| `rowId` | `string \| number \| function \| null` | `null` | Stable identity accessor: a data key/dot path, array key, or pure callback. |
| `sanitize` | `function` | `(html) => $.sanitize(html)` | Sanitize heading, cell, and custom detail HTML, including formatted values. |
| `searching` | `boolean` | `true` | Enable global search, column filters, and local row predicates. |
| `selection` | `false \| 'single' \| 'multiple'` | `false` | Enable row controls and selection APIs; requires `rowId`. |

`order`, `lengths`, and `buttons` replace their default arrays, including when empty. Nested object options merge with defaults. Default labels and icon keys:

```js
Table.defaults.lang = {
    info: 'Showing results {start} to {end} of {total}',
    infoFiltered: 'Showing results {start} to {end} of {filtered} (filtered from {total} total)',
    noData: 'No data available', noResults: 'No results to show',
    page: 'Page', perPage: 'Per Page', search: 'Search', loading: 'Loading results',
    responsive: { details: 'Details', show: 'Show details for row {row}', hide: 'Hide details for row {row}' },
    selection: { clear: 'Clear selection', count: '{count} selected', page: 'Select all rows on this page', row: 'Select row {id}' },
    column: 'Column {column}',
    paginate: { first: 'First', last: 'Last', next: 'Next', previous: 'Previous' },
    buttons: { columns: 'Columns', csv: 'CSV', excel: 'Excel', print: 'Print' },
    aria: {
        sortAscending: ': activate to sort column ascending',
        sortDescending: ': activate to sort column descending',
    },
};
Table.defaults.icons = { first: '&laquo;', last: '&raquo;', next: '&gt;', previous: '&lt;' };
```

### Columns and local data

Rows must be arrays or plain objects. `columns` must match existing headings. When no header exists, explicit columns generate headings from `name` or `data`.

```js
Table.init(document.querySelector('#scores'), {
    data: [
        { person: { name: 'Alice' }, score: 30 },
        { person: { name: 'Bob' }, score: 20 },
    ],
    columns: [
        { data: 'person.name', name: 'Name' },
        { data: 'score', class: 'text-end', format: (value) => `<strong>${Number(value)}</strong>` },
    ],
});
```

| Column option | Default | Description |
| --- | --- | --- |
| `data` | Column index | Numeric array key or object dot path. |
| `name` | `null` | Remote column name; also supplies generated heading text. |
| `class` | `null` | Classes applied to each cell. |
| `dir` | `'asc'` | Initial sort direction when this heading is activated. |
| `orderData` | `null` | Alternate array of column indexes used to sort this column. |
| `orderable` | `true` | Allow sorting on this heading. |
| `responsivePriority` | `1000` | Nonnegative safe integer; lower values remain visible longer. `null` prevents responsive collapse. |
| `searchable` | `true` | Include this column in local search. |
| `visible` | `true` | Display the column. Hidden columns can still participate in sorting/searching. |
| `format(value)` | `null` | Return cell HTML; runs with the instance as `this`. |
| `render(value, context)` | `null` | Resolve display, sort, filter, or export values; cannot be combined with `format`. |
| `type` | `'auto'` | Local sorting type: `auto`, `string`, `number`, or `date`. |
| `compare(a, b, context)` | `null` | Compare resolved sort values in ascending order; return a finite number. |
| `createdCell(cell, value, row, rowIndex, columnIndex)` | `null` | Customize the created cell; `rowIndex` is page-relative. |

Search matches a literal case-insensitive substring in resolved filter values, once per row. Sorting preserves source order for ties. Add keys to `order` for tie-breaking. Local changes rerun search, sorting, counts and page clamping. `search()` resets to page one.

### Cell values and sorting

Use `render` when one source value needs different representations:

```js
columns: [{
    data: 'salary',
    type: 'number',
    render(value, { purpose }) {
        return purpose === 'display' ? `$${value.toFixed(2)}` : value;
    },
}]
```

The renderer receives the raw value and `{ purpose, row, column, rowIndex }`. `purpose` is `display`, `sort`, `filter`, or `export`; `row` is the source row; `column` is the original column index. `rowIndex` addresses the loaded dataset, including for paginated displays and exports. For remote data it addresses the loaded response. Renderers run with the Table as `this` and should be pure: they may run multiple times, without a guaranteed invocation order. Raw getters continue returning source values.

Without a renderer, JavaScript data uses its raw values. Existing `format(value)` remains display-only. Display output is sanitized; filter values are converted to text; export values retain scalars such as `0` and `false`. Return strings, numbers, booleans, or nullish values for filtering and exports. Supplying both `format` and `render` throws `TypeError`.

Local sorting supports these explicit types:

| Type | Comparison |
| --- | --- |
| `auto` | Existing behavior: compare numerically when both values are numeric, otherwise as case-insensitive text. |
| `string` | Case-insensitive text, including numeric-looking strings. |
| `number` | Finite numbers and numeric strings. Currency symbols require an application renderer that returns a number. Booleans and objects are invalid. |
| `date` | Valid `Date` objects, epoch milliseconds, `YYYY-MM-DD`, or ISO timestamps with `Z` or an explicit `±HH:MM` offset. Timestamps support optional seconds and up to three fractional digits. Ambiguous dates and timestamps without an offset are invalid. |

For explicit types, nullish values, blank strings, and invalid conversions sort last in both directions. Equal keys retain source order unless another ordering key breaks the tie. `auto` keeps its existing empty-value behavior.

`compare(a, b, { column })` receives the resolved sort values before type conversion, with the Table as `this`. Return a finite negative number, zero, or a positive number for ascending order; Tables applies the requested direction. Explicit type validation and missing-value placement still apply before calling the comparator. Custom comparisons work with multi-column ordering and `orderData`. Remote sorting remains the loader's responsibility; renderers and comparator functions are not sent to the server.

### Values from HTML

DOM-backed tables retain cell HTML for display and raw getters. **Sorting, search, and exports now default to the cell's text content**, with entities decoded. For example, `<strong>Alice</strong>` exports `Alice` and does not match a search for `strong`.

Override individual operations with cell attributes:

```html
<td data-order="1234.5" data-search="Annual salary" data-export="1234.50">$1,234.50</td>
```

`data-order`, `data-search`, and `data-export` override sorting, filtering, and exports respectively. Missing attributes fall back to text content; empty attributes are explicit empty values. An explicit column renderer takes precedence over these inferred values.

Editing a cell clears its original attribute overrides; replacing a row clears that row's metadata. Replacement values follow the JavaScript data rules, so use a renderer when inserting HTML that also needs separate text values. Removing a row preserves the other rows' metadata. Disposal restores the original DOM.

### Bulk data and row scopes

Use `addRows()` to append a batch or `setData()` to replace the local dataset. Both validate and shallow-copy the full batch before changing data, then recalculate and draw once:

```js
table.addRows([['Morgan', 97], ['Noor', 94]]);
table.setData([['Alice', 80], ['Bob', 90]]);
table.setData(nextRows, { resetPage: false });

const page = table.getData();
const matches = table.getData({ scope: 'filtered' });
const all = table.getData({ scope: 'all' });
```

`addRows()` preserves the current page; an empty batch does nothing. `setData()` resets to page one by default. With `resetPage: false`, it retains the page and clamps it when the new results have fewer pages. Both preserve global search, column filters, the row predicate, ordering, visibility, and page length.

Invalid batches leave rows and the current view intact. Rows must be arrays or plain objects; sparse row collections are rejected. Copies isolate each row container, while nested objects remain shared, matching the existing single-row APIs. Initial `data` supplied through options is first cloned by Frost UI’s shared option handling; getters share nested values with that loaded copy. Validation and copying finish before rows are changed; renderer or predicate errors during the subsequent recalculation do not roll back an accepted dataset.

`setData([])` removes all rows while keeping search and filter state. Use `clear()` to clear those settings too. Replacing DOM-ingested rows discards their original cell metadata; replacement rows follow JavaScript data rules. Disposal still restores the original table markup.

| `getData()` scope | Local rows | Remote rows |
| --- | --- | --- |
| `page` (default) | Current page after filtering and sorting | Current loaded page |
| `filtered` | Every matching row across pages, in active order | Unsupported |
| `all` | Entire dataset in active order, ignoring all filters | Unsupported |

Returned rows contain raw source values and include hidden columns. The result array and its row containers are fresh shallow copies. With no active ordering, scopes retain input order. Reading data does not change search, counts, page, length, or visibility and does not draw or fetch rows. The `all` scope invokes sort renderers and comparators as needed; keep those callbacks pure and avoid recursively requesting the same scope. If a callback disposes the table or starts a newer draw during collection, the interrupted read returns `[]`.

Bulk mutators are local-only and throw `TypeError` when `getResults` is configured. Remote applications should save changes through their server and call `reload()`. Unsupported or unknown getter scopes throw `RangeError`; `getData()` never fetches other pages. Export buttons use the same scope rules and default to the current page.

### Stable row identity

Set `rowId` to a string data key/dot path, a nonnegative integer array key, or a pure callback receiving the source row with the Table as `this`. IDs are independent of visible columns and display renderers.

```js
const table = new Table(node, {
    data: employees,
    rowId: 'employee.id',
    columns: [{ data: 'name' }, { data: 'score' }],
});

const id = table.getRowId(0); // First displayed row.
const employee = table.getRowById('employee-42');

table.setRowById('employee-42', replacementEmployee);
table.removeRowById('employee-42');
```

Every loaded row must have a unique nonempty string or safe integer ID. Zero is valid; `42` and `'42'` are distinct. Missing, empty, boolean, object, fractional, and unsafe numeric IDs throw `TypeError`. IDs remain stable across ordering, filtering, paging, and reloads. Identity callbacks must be deterministic and must not modify data or the table.

Keyed getters return shallow row copies, or `null` when absent. Keyed mutations throw `RangeError` for absent rows. Identity methods require `rowId`; malformed IDs throw `TypeError`. `getRowId()` accepts the same positional options as `getRow()`. After disposal, the keyed getter and `getRowId()` return `null`, and keyed mutators do nothing.

Initial data, inserted batches, replacement datasets, and remote responses validate all IDs before installing data. Duplicate or invalid IDs leave the previous rows and selection intact. Existing positional `setRow()`, `setValue()`, and `setColumn()` methods also enforce identity: replacing a row or editing its values must retain its ID. This includes nested paths, parent-object replacement, and callback-derived IDs. Remove and insert a row to change its identity; `setData()` replaces the complete dataset and may introduce or remove IDs.

With identity enabled, value writes copy affected object/array branches before validation, so rejected nested writes do not change shared source objects. Unaffected nested values retain the existing shallow-copy behavior. Do not mutate shared nested objects outside table methods. DOM cell metadata for unchanged values remains available.

Remote keyed methods address only the loaded response. They neither fetch absent records nor persist server changes. The server owns ID uniqueness across pages; the table checks each accepted response. Invalid IDs use `error.ui.table` without partially installing rows or counts, and stale responses cannot replace the identity map.

DOM-backed tables can resolve IDs from ingested cell values or a callback. Existing `<tr id>` and `data-row-id` attributes are not inferred. Application IDs are never assigned as DOM element IDs.

### Row selection

Set `selection: 'single'` or `'multiple'` alongside `rowId`. The default is `false`. Selection adds a dedicated control cell without changing data column indexes, positional row indexes, exported fields, or the state schema.

```js
const table = new Table(node, {
    data: employees,
    rowId: 'id',
    selection: 'multiple',
    columns: [{ data: 'name' }, { data: 'score' }],
    layout: { top: 'selection,search|length', bottom: 'info,pagination' },
});

table.setSelectedIds(['employee-42', 'employee-87']);
table.selectRows({ scope: 'filtered' });
table.deselectRows({ scope: 'page' });

const selectedIds = table.getSelectedIds();

table.setSelectedIds([]); // Clear all selection, including unloaded remote IDs.
```

`setSelectedIds()` validates the entire array before replacing selection. Duplicate IDs are ignored. Local IDs must exist in the dataset; unknown IDs throw `RangeError`. `getSelectedIds()` returns an independent array in selection insertion order. Reordering an equivalent set does not change that order or emit an event. Getters return `[]` when disabled or disposed; selection mutators reject disabled selection and do nothing after disposal.

`selectRows()` adds IDs from a scope; `deselectRows()` removes scoped IDs while keeping other selections. Both default to `page` and share the `page`, `filtered`, and `all` data scope definitions. A single-selection operation whose final set contains more than one ID throws `RangeError`; choosing a radio through the UI replaces the previous selection.

Selection survives search, filters, ordering, page/length changes, and column visibility changes. Filtered-out rows remain selected. Local `setData()` retains IDs present in the replacement and prunes absent IDs; removing a row removes its selection. New rows are not automatically selected. `clear()` and disposal clear selection. `getState()` excludes selection, and `setState()` preserves it. Save and restore selected IDs separately when required.

Multiple selection uses native checkboxes. The header checkbox controls only the current page: checked for every page row, indeterminate for some, and disabled on an empty page. It does not represent selections on other pages. Single selection uses native radios in a table-specific group and has no header selection control. Row clicks and links do not select rows. Selection-only updates preserve focus and do not redraw rows, recalculate results, change the view, or load remote data.

If `preDrawCallback` cancels a draw, the header checkbox continues to control the rows still displayed, excluding IDs no longer present in the loaded data. The selection APIs continue to use the current data scopes.

The optional `selection` layout control shows the total selected count and a clear button. Hiding it does not disable selection. Labels are configured through `lang.selection`; `row` accepts `{id}` and `count` accepts `{count}`. Selection owns the `Table.classes.selectedRow` class (`table-active` by default); use a different callback class when styling rows independently. Utility cells are present in rendered header/body/footer DOM, so callbacks inspecting child positions must account for them. Their data and index arguments remain unchanged.

#### Remote selection

Remote selection retains IDs across pages and reloads without caching unloaded row objects. `setSelectedIds()` accepts valid unloaded IDs, and an absent record in one response does not prune selection. The application must reconcile server deletions and permission changes explicitly.

Only `page` is supported by remote `selectRows()` / `deselectRows()`; `filtered` and `all` throw `RangeError` before changing selection. Bulk actions should send `getSelectedIds()` to the application service. There is no query-wide remote selection, selected-data scope, or selected export scope.

#### Selection events

`selectionchange.ui.table` reports effective selection changes, including pruning after local replacement/removal. Its detail contains independent `{ selectedIds, addedIds, removedIds }` arrays. One bulk selection update emits one aggregate event; unchanged selections and data-only edits do not notify. Selection changes do not emit `statechange.ui.table`.

```js
$.addEvent(node, 'selectionchange.ui.table', (event) => {
    updateBulkActions(event.detail.selectedIds);
});
```

Selection is committed before notification. Listeners may change selection again, replace data, or dispose the table; older work stops when a newer data operation takes over. Data-driven pruning may notify before the new rows are drawn; use `draw.ui.table` for completed DOM updates.

### Responsive detail rows

Set `responsive: true` to collapse columns into an expandable detail row when the table's container is too narrow. It is disabled by default; horizontal scrolling remains available when retained columns cannot fit.

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
    buttons: [{ type: 'columns' }],
});
```

`responsivePriority` defaults to `1000`. Higher numbers collapse first; ties collapse from right to left in original column order. `null` keeps a column in the main row. Priorities must be nonnegative safe integers or `null`; invalid values throw `TypeError`. At least one configured-visible data column remains in the main row. The `responsive` option must be boolean.

The component measures existing headings, cells, and footer spans at their intrinsic width, including selection and disclosure controls. It observes container width, coalesces resize work, and remeasures after data draws and initial font loading. Tables initialized in hidden containers defer measurement until usable width is available. Layout-only updates do not recalculate results, emit draw/state events, or request remote data. Data-draw callbacks run before the responsive layout is finalized; `draw.ui.table` reports the completed draw including its detail rows.

Responsive collapse is separate from configured visibility. A checked picker entry may be in details, while a user-hidden column remains absent from both the main row and details. Collapse does not change `getState()`, search/order behavior, or default export columns. Explicit getters and exports continue to address original data columns. Headers, footers, empty-result cells, and detail-row spans track the rendered columns.

A compact chevron disclosure button appears in a separate utility cell when fields are collapsed. Enter/Space toggles a companion row with labels in original column order. Labels use heading text or the localized numbered fallback; values use the existing sanitized display renderer with the original source row and column context. Opening details does not rerun row/cell creation callbacks. Existing live controls are not cloned into details; stateful widgets and live DOM output are outside this feature.

The button exposes `aria-expanded` and a generated `aria-controls` ID. `lang.responsive.details` controls its tooltip and visually hidden text; `show` and `hide` accept `{row}`, using the stable ID when configured or the one-based page row number otherwise. When widening removes a focused disclosure or its detail content, focus moves to the owning data row. Selecting rows, clicking links, and toggling details remain separate interactions.

With `rowId`, expansion survives redraws and remote reloads only for IDs still present on the displayed page. It is discarded when a row leaves that page. Without `rowId`, every data redraw clears expansion so a positional index cannot transfer it to another record. Revealing all columns clears expansion in either mode. Expansion is transient and excluded from view snapshots.

Set `renderDetails` to replace the default labelled layout. The callback runs with the table as `this` and receives the source row plus `{ rowIndex, columns }`. `rowIndex` is the loaded-data index, independent of ordering and pagination. `columns` contains only configured-visible, collapsed columns in original order, each with `{ column, data, title, html }`: the original index, data key or dot path, plain-text heading (or localized fallback), and sanitized display HTML.

```js
const table = new Table(node, {
    data: employees,
    responsive: true,
    columns: [{ data: 'name', responsivePriority: null }, { data: 'team' }, { data: 'email' }],
    renderDetails(row, { columns }) {
        const items = columns.map(({ title, html }) => {
            const label = $.getHtml($.create('span', { text: title }));

            return `<li><strong>${label}:</strong> ${html}</li>`;
        });

        return `<ul class="mb-0">${items.join('')}</ul>`;
    },
});
```

Return an HTML string synchronously; an empty string produces an empty detail cell. Other return types, including DOM nodes and promises, throw `TypeError`. The returned HTML passes through `sanitize` before insertion. Encode plain text such as headings and raw row values when interpolating it into HTML; sanitization does not replace text escaping. `renderDetails` must be a function or `null`, with `null` preserving the default layout.

The callback runs when a row opens, when an open row is redrawn, and when its collapsed columns change. It does not run for closed rows, unchanged resize layouts, or when responsive behavior is disabled. Treat row data as read-only and avoid side effects; callbacks that dispose the table or trigger another draw abandon the obsolete detail render. Details still require at least one collapsed column and use the same keyboard controls, focus recovery, expansion lifetime, and export behavior. Custom widget mounting and cleanup hooks are not provided.

Detail rows do not contribute to counts, pagination, selected IDs, data getters, exports, or data-row callback arguments. Callbacks that inspect the rendered DOM should account for the additional utility cells and companion rows. Disposal disconnects observation, cancels queued layout work, and restores the original table markup.

### Column filters and row predicates

`setFilters()` replaces the complete set of column filters. All filters, global search, and the optional row predicate must match for a row to be included:

```js
const table = Table.init(document.querySelector('#scores'), {
    data: [
        { team: 'Engineering', score: 95, requiredScore: 90, active: true },
        { team: 'Design', score: 80, requiredScore: 85, active: false },
    ],
    columns: [{ data: 'team' }, { data: 'score', type: 'number' }],
});

table.setFilters([
    { column: 0, operator: 'equals', value: 'Engineering' },
    { column: 1, operator: 'gte', value: 90 },
]);
table.setRowFilter((row) => row.active && row.score >= row.requiredScore);

table.setFilters([]); // Keep global search and the row predicate.
table.setRowFilter(null); // Keep global search and column filters.
```

Filters use original column indexes and resolved `filter` values, including `render` output and DOM `data-search` attributes. Hidden columns remain filterable; columns with `searchable: false` reject filters.

| Operator | Behavior |
| --- | --- |
| `contains` | Literal case-insensitive substring, for every column type. |
| `equals` | Numeric/date equality for those explicit types; otherwise case-insensitive text equality. |
| `gt`, `gte`, `lt`, `lte` | Greater than, at least, less than, or at most; require `type: 'number'` or `type: 'date'`. |
| `between` | Inclusive `[lower, upper]` bounds; requires `number` or `date`. Reversed bounds are invalid. |

Text comparisons stringify values, treating nullish values as empty strings and retaining `0` and `false`. Numeric/date comparisons use the same conversions as typed sorting; missing or invalid cell values never match them. Filter bounds must be valid for the column type. `auto` uses text equality; select an explicit type for numeric equality or ranges. Custom sort comparators do not change filter semantics.

Descriptors accept JSON scalars (`string`, finite `number`, `boolean`, or `null`), with a two-value array for `between`. Use ISO strings or epoch milliseconds for date bounds; `Date` objects, functions, nested objects, and nonfinite numbers are rejected. For example, `{ column: 2, operator: 'between', value: ['2026-01-01', '2026-01-31'] }` filters a date column. The entire array is validated before any state changes, and descriptors and bounds are copied. Invalid input preserves existing filters, page, and pending requests.

Row predicates run with the Table as `this`, receive the original source row, and must return a boolean. Keep predicates pure; they may be called again after search, ordering, or data changes. Predicates are local-only and are not serializable. Passing a function to `setRowFilter()` in remote mode throws `TypeError`.

Each successful setter resets to page one, emits `filter.ui.table`, and recalculates/draws once locally or schedules one remote request. Other search state remains active. `clear()` removes all rows and clears global search, column filters, and the predicate. Empty filtered results use `lang.noResults`, including when the global search is empty. Both setters do nothing when `searching` is disabled; hiding the search control does not disable filtering.

### Table state

Use `getState()` to capture a view and `setState()` to restore it:

```js
const saved = table.getState();
// Store or encode this snapshot using your application's preferred mechanism.
table.setState(JSON.parse(JSON.stringify(saved)));
```

A snapshot contains only view configuration:

```js
{
    version: 1,
    search: 'Engineering',
    filters: [{ column: 1, operator: 'gte', value: 90 }],
    order: [[1, 'desc']],
    length: 25,
    page: 2,
    columns: [
        { data: 'team', name: null, visible: true },
        { data: 'score', name: null, visible: true },
    ],
}
```

`getState()` returns fresh objects and nested arrays, including filter bounds. It excludes rows, renderers, comparators, the local row predicate, DOM nodes, requests, loading state, and errors. With paging disabled, `length` is `null` and `page` is `1`; with ordering disabled, `order` is empty. It returns `null` after disposal.

`setState()` requires a complete version-1 snapshot. Column count, order, data accessors, and names must match the current schema exactly; visibility must be boolean. Search must be a string, filters and ordering must be valid, and page/length must be positive safe integers with a safely representable offset. Numeric strings are not accepted for these state fields. Restoring ordering on a nonorderable column or state requiring disabled search, ordering, or paging is rejected. Hiding a control or disabling `lengthChange` does not disable the underlying feature.

Validation and copying finish before any state or pending work changes. Invalid snapshots throw `TypeError` or `RangeError` and leave the current view intact. Valid snapshots are applied together, synchronize the search and length controls, and perform one local recalculation/draw or one debounced remote load. The existing local predicate remains active. Local pages clamp against the resulting filtered data. Remote restoration requests the saved page without clamping against old counts; the response may trigger one corrective request under the usual paging rules. Callback errors during recalculation do not roll back an accepted snapshot.

`statechange.ui.table` exposes a fresh snapshot as `event.detail.state`. It reports changes to the serialized view, including visibility and page clamping after data edits. Equivalent normalized snapshots do not emit duplicate notifications; `setState()` still recalculates or reloads. Initial setup does not emit a notification unless an initialization callback changes the view. Changes only to rows, counts, or the excluded predicate do not notify unless a serialized field also changes.

For local data, the event reflects the final page after filtering and clamping. For remote data, it fires when the view is requested, before the response; a corrective page request emits the corrected state. Use `draw.ui.table` and `error.ui.table` to observe request completion. State restoration emits one aggregate notification when the view changes, without individual search/order/page/filter events. Listeners may dispose the table or restore another view; interrupted work stops.

```js
$.addEvent('#scores', 'statechange.ui.table', (event) => {
    const snapshot = event.detail.state;
    // Persist the snapshot or synchronize your application's URL here.
});
```

Automatic browser storage and URL updates are not included. Applications own storage keys, expiration, schema migrations, and any predicate functions they need to reattach.

### Remote data

The loader handles filtering, sorting, and paging. Return a result object, promise, or thenable:

```js
Table.init(document.querySelector('#scores'), {
    getResults(request) {
        const controller = new AbortController();
        const pending = fetch('/api/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
            signal: controller.signal,
        }).then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        });
        pending.cancel = () => controller.abort();
        return pending;
    },
});
```

A typical request and response:

```js
// Request: order and columns are numeric-keyed records, not arrays.
const request = {
    term: 'ali',                           // omitted when empty
    offset: 0, limit: 10,                   // omitted when paging is disabled
    order: { 0: { column: 0, dir: 'asc' } }, // omitted when ordering is disabled
    columns: {
        0: { data: 0, orderable: true, searchable: true },
        1: { data: 1, orderable: true, searchable: true },
    },
};
// Response: counts describe the complete server dataset and matching subset.
const response = { results: [['Alice', 30]], total: 200, filtered: 1 };
```

`name` is included for named columns. Counts must be nonnegative safe integers with `total >= filtered >= results.length`; a paged response must not exceed `limit`. Return `[]` for no matches. If counts shrink past the requested page, Tables clamps the offset and requests that page again.

Active column filters add a copied `filters` array to the request, using the same `{ column, operator, value }` descriptors passed to `setFilters()`. The field is omitted when filters are empty. Accessors and names remain in `request.columns`. The server must apply equivalent conversions and filter semantics to the full dataset and return matching counts; Tables does not filter the loaded page again. Renderers, comparators, and predicates are never sent to the server. Filter changes reuse request debouncing, cancellation, and stale-response protection.

A new request cancels the debounce and invokes optional `cancel()` on the original pending object. Generation checks reject stale successes/failures even when cancellation cannot stop the work. Disposal cancels owned work. Throws, rejections, and invalid responses clear loading and emit `error.ui.table`; previously rendered rows remain available. Call `reload()` to retry. There is no built-in error banner: use the error event to present one, as the demo does.

Remote mutation methods edit the loaded page and counts in memory; they do not save to the server or load other pages. Persist on your server and reload for authoritative results. `reload()` is not awaitable; observe `draw.ui.table` or `error.ui.table`.

### Rendering, callbacks, and sanitization

Resolved display values and formatter results become strings and pass through `sanitize`; nullish cell values become empty strings. Headings are sanitized too. Use a suitable custom sanitizer when allowing additional safe markup. Returned DOM nodes are not a renderer or formatter contract. Direct callback DOM changes bypass sanitization; prefer `textContent` for untrusted text.

Every callback below runs with the Table as `this`:

| Callback | Arguments |
| --- | --- |
| `preDrawCallback` | None; return `false` to skip the DOM draw. |
| `headerCallback` | `(theadRow, loadedData, start, end, indexes)` |
| `infoCallback` | `(displayStart, end, total, filtered, defaultText)`; return text. |
| `rowCallback` | `(tr, rowData, pageRowIndex, offsetRowIndex, dataRowIndex)` |
| `createdRow` | `(tr, rowData, pageRowIndex)` |
| `drawCallback` | None. |
| `footerCallback` | `(tfoot, loadedData, start, end, indexes)`; requires an original footer. |

`start` is zero-based and `end` exclusive. `displayStart` is one-based, or zero when empty. `indexes` contains loaded-data indexes for displayed rows; remote indexes address the loaded page. Rows/callback data are live; use mutation methods for updates so indexes and counts are recalculated. `createdCell` runs before the row callbacks. Returning `false` from pre-draw cancels rendering, not the preceding data update. Callback-triggered disposal or a newer draw stops the interrupted draw.

### Layouts and buttons

The default layout is `{ top: 'search,buttons|length', bottom: 'info,pagination' }`. Commas separate layout columns; pipes stack controls within a column. Built-ins are `search`, `buttons`, `length`, `info`, `pagination`, and `selection`. An empty string omits a row. Omitting a control does not disable its API feature.

```js
Table.layout.summary = function (container) {
    container.textContent = 'Team results';
};
const table = Table.init(document.querySelector('#scores'), {
    layout: { top: 'summary,search', bottom: 'info,pagination' },
});
```

Custom layout functions receive a destination container and the Table as `this`. They run during initialization, before the first data draw. Use public methods and callbacks instead of private internals.

```js
Table.init(document.querySelector('#scores'), {
    buttons: [
        { type: 'columns' },
        { type: 'csv', scope: 'filtered', title: 'Matching scores', columns: [1, 0] },
        { type: 'excel', scope: 'all', title: 'All scores' },
        { type: 'print', scope: 'page', title: 'Team scores' },
        { text: 'Show all', callback() { this.length(100); } },
    ],
});
```

Button options are `type`, `text`, `title`, `scope`, `columns`, `callback`, and CSV's `escapeFormulae`. `text` overrides the translated type label; `title` defaults to the document title. `callback()` overrides the registered handler and receives the Table as `this`. Register reusable handlers through `Table.buttons.yourType = function (options, button) { ... }`.

#### Column visibility picker

Add `{ type: 'columns' }` to `buttons` to render a Frost UI dropdown with native checkboxes. Its optional `columns` array chooses and orders entries by original data-column index; omitted or `null` includes every data column, including initially hidden columns. An empty array produces an empty picker. Duplicate or out-of-range indexes throw `RangeError`; nonarray input throws `TypeError` when the picker is created. Selection control cells never appear in the list.

```js
buttons: [
    { type: 'columns', text: 'Choose fields', columns: [2, 0, 1] },
    { type: 'csv', scope: 'filtered' },
]
```

Labels use sanitized heading text, with `lang.column` (`'Column {column}'`) as a one-based numbered fallback for blank headings. `lang.buttons.columns` defaults to `'Columns'`; the button's `text` overrides it. Checkbox styling follows Frost UI's native check controls. The picker is a labelled group, without menu roles.

Click the trigger or activate it with Enter/Space to open it. Arrow Up/Down opens it and focuses the first checkbox; Tab moves between controls and Space toggles a column. The picker stays open while toggling, preserving checkbox focus across table redraws. Escape closes it and returns focus to the trigger; outside clicks and tabbing out dismiss it using Frost UI's dropdown behavior.

Each toggle uses `showColumn()` / `hideColumn()` and performs one redraw with the existing state notification. It preserves search, ordering, and pagination without loading remote data. API visibility changes and `setState()` synchronize all pickers, including during a pending remote restore. Opening or closing the picker does not change table state or draw rows.

All data columns may be hidden; the toolbar remains available to restore them. Footer cells track their original column ranges, adjusting spans or hiding cells with no visible columns. Original footer markup is restored on disposal. Footer callbacks still run after visibility synchronization and may customize the rendered footer.

Configured visibility continues to control default exports and is already included in saved state. Explicit export column lists can still include hidden columns. A custom `callback` on a `columns` button takes precedence and creates a regular callback button instead of a picker. Dropdown instances, positioning work, and owned listeners are released on disposal.

#### Exports

Built-in exports use resolved export values and visible columns. `columns` explicitly selects/reorders columns, including hidden ones. Heading markup becomes text. Display formatters are not used. JavaScript rows default to raw values; DOM rows default to text or `data-export`. A renderer can provide an export value independently of the display, and CSV formula escaping applies to resolved strings. Internal sort conversions do not replace export values.

| Export scope | Local rows | Remote rows |
| --- | --- | --- |
| `page` (default) | Current page | Current loaded page |
| `filtered` | All rows matching global search, column filters, and the row predicate | Unsupported |
| `all` | Entire dataset, ignoring filters | Unsupported |

Each local scope uses active ordering; an empty order retains input order. Exports do not change pagination, search, filters, or visibility and do not redraw the table. Remote `filtered` and `all` scopes throw `RangeError` before downloading or opening a print view. Use a custom button callback to call your server's export endpoint when a remote export needs more than the loaded page.

Collect the same values without starting an export using `getExportData()`:

```js
const data = table.getExportData({ scope: 'filtered', columns: [1, 0] });
// { headings: ['Score', 'Name'], rows: [[90, 'Alice'], ...] }
```

The default scope is `page`, and omitted or null `columns` selects visible columns. The returned headings array, rows array, and each row array are fresh. Values are resolved with `purpose: 'export'`, and `rowIndex` addresses the loaded dataset even for rows outside the current page. Formula escaping and spreadsheet conversion happen later in the export handlers, so collected values remain available for other formats.

Unknown scopes or out-of-range column indexes throw `RangeError`; a nonarray column selection throws `TypeError`. An empty match set returns headings and `rows: []`. If a renderer or comparator disposes the table or starts a newer draw during collection, `getExportData()` returns `null` and built-in buttons cancel that export. It also returns `null` when called after disposal.

- CSV quotes commas, quotes and line breaks. Formula-like strings are prefixed with an apostrophe by default; `escapeFormulae: false` opts out. Numeric negatives remain numbers.
- XLSX preserves zero, booleans, Unicode and string formulas as text. Recognized `YYYY-MM-DD`, `DD/MM/YYYY`, optional ` HH:mm:ss`, `HH:mm:ss`, numeric and percentage values receive spreadsheet values/styles. Dates use Excel's 1900 system. Invalid date-like strings remain text.
- Print uses text titles/values, copies table direction/classes and document styles, waits for styles/fonts, and closes after printing. Blocked popups are ignored. Browser print dialogs and settings remain browser-owned.

## Data attributes

Use kebab-case `data-ui-*` attributes for serializable options. Arrays and objects use JSON. Supply callbacks and DOM nodes through JavaScript.

```html
<table id="scores" data-ui-toggle="table" data-ui-length="5"
    data-ui-lengths='[5,10,25]' data-ui-order='[[1,"desc"]]'
    data-ui-input-style="outline" data-ui-searching="true">
    <!-- caption, thead, and tbody as in Usage -->
</table>
```

Other examples include `data-ui-paging="false"`, `data-ui-ordering="false"`, `data-ui-info="false"`, `data-ui-length-change="false"`, `data-ui-debounce="300"`, and JSON `data-ui-columns`, `data-ui-layout`, `data-ui-lang` or `data-ui-buttons`. Supply functions through JavaScript.

```js
import $ from '@fr0st/query';
import '@fr0st/ui-tables';

$('[data-ui-toggle="table"]').table();
```

Data attributes configure options; they do not initialize Tables by themselves. Initialize the component through the class or fQuery plugin. Changing an option's data attribute after initialization does not reconfigure the existing instance.

## Methods

| Method | Returns | Description |
| --- | --- | --- |
| `Table.init(node, options?)` | `Table` | Return the existing instance for an element or create one. |
| `addRow(row)` | `void` | Append a copied row and refresh local results/counts. |
| `addRows(rows)` | `void` | Append a copied local batch with one recalculation and draw. |
| `clear()` | `void` | Clear loaded rows/counts, selection, search, filters, predicate, paging and pending work. |
| `deselectRows({ scope = 'page' }?)` | `void` | Deselect scoped IDs; remote tables support only `page`. |
| `dispose()` | `void` | Restore the original DOM and attributes, cancel owned work, and remove registered state. |
| `getColumn(key, { modified = true }?)` | `array` | Return column values for the displayed rows or loaded dataset. |
| `getData({ scope = 'page' }?)` | `array` | Return shallow row copies for `page`, `filtered`, or `all`, in active order. |
| `getExportData({ scope = 'page', columns = null }?)` | `object \| null` | Return text headings and resolved export rows; return `null` if collection is interrupted. |
| `getRow(index, { modified = true }?)` | `array \| object` | Return a shallow copy of a row. |
| `getRowById(id)` | `array \| object \| null` | Return a copied loaded row by stable ID, or `null` when absent. |
| `getRowId(index, { modified = true }?)` | `string \| number \| null` | Return a positional row's ID, or `null` after disposal. |
| `getSelectedIds()` | `array` | Return an independent array of selected IDs, including unloaded remote IDs. |
| `getState()` | `object \| null` | Return an independent versioned view snapshot, or `null` after disposal. |
| `getValue(index, key, { modified = true }?)` | `any` | Read an array key or object dot path. |
| `hideColumn(index)` | `void` | Hide a data column and redraw. |
| `info()` | `object` | Return `{ start, end, total, filtered }` with a zero-based start and exclusive end. |
| `length(length)` | `void` | Change page length; also synchronize the select. |
| `loading({ show = true }?)` | `void` | Set loading indicator and `aria-busy`; emit processing/processed. |
| `order(pairs)` | `void` | Set sorting, for example `[[0, 'asc'], [1, 'desc']]`. |
| `page(number)` | `void` | Select a one-based page, clamped to the valid range. |
| `refresh()` | `void` | Redraw current results without fetching/recalculating data. |
| `reload({ reset = false }?)` | `void` | Recalculate local results or request remote data; optionally reset offset. |
| `removeRow(index, { modified = true }?)` | `void` | Remove a row and refresh counts/results. |
| `removeRowById(id)` | `void` | Remove a loaded row by stable ID. |
| `search(term)` | `void` | Set a string search, synchronize input, and reset offset. |
| `selectRows({ scope = 'page' }?)` | `void` | Add scoped IDs to selection; remote tables support only `page`. |
| `setColumn(key, values, { modified = true }?)` | `void` | Replace one column for targeted rows; array length must match. |
| `setData(rows, { resetPage = true }?)` | `void` | Replace the local dataset with one redraw, preserving search and filters. |
| `setFilters(filters)` | `void` | Replace structured column filters and reset to page one. Pass `[]` to clear them. |
| `setRow(index, row, { modified = true }?)` | `void` | Replace a row with a shallow copy. |
| `setRowById(id, row)` | `void` | Replace a loaded row, retaining its ID. |
| `setRowFilter(predicate)` | `void` | Set a local row predicate and reset to page one. Pass `null` to clear it. |
| `setSelectedIds(ids)` | `void` | Replace selection atomically; `[]` clears it. |
| `setState(state)` | `void` | Validate and restore a complete view in one recalculation or remote load. |
| `setValue(index, key, value, { modified = true }?)` | `void` | Update one array key or object dot path. |
| `showColumn(index)` | `void` | Reveal a data column and redraw. |

Row indexes are zero-based. `modified: true` addresses the displayed page after filtering/sorting; `false` addresses the loaded dataset. Column visibility, sort and export indexes always address the original column definitions. Value keys address row data, not visible column positions. Each mutation may reorder or remove rows from the displayed page, so obtain fresh indexes before the next edit.

Invalid row/column indexes and nonpositive/noninteger page lengths throw `RangeError`. Invalid order structures/directions throw `TypeError`; invalid sort column indexes throw `RangeError`. `page()` requires a safe integer. `length()`/`page()` do nothing when paging is disabled; `order()`/`search()` do nothing when their feature is disabled. Local `reload()` uses the loaded dataset, not a fresh parse of edited table markup.

## Lifecycle

Calling `Table.init()` again for the same element returns its existing instance. Dispose the current instance before reinitializing with different options.

An instance exposes its original element as `instance.node` and its shallow-frozen resolved configuration as `instance.options`. Both become `null` after disposal.

`dispose()` releases resources owned by the component and removes its registered instance. It removes component-added classes while preserving unrelated application classes. Repeated disposal is safe and does not affect a new instance initialized on the same element. Use a new instance before calling other methods after disposal.

## Events

Events originate on the original table:

| Event | Description |
| --- | --- |
| `init.ui.table` | Registered and rendered controls, before the initial data load. |
| `length.ui.table` | After setting page length, before loading results. |
| `order.ui.table` | After setting sorting, before loading results. |
| `page.ui.table` | After setting offset, before loading results. |
| `search.ui.table` | After setting the search, before loading results. |
| `filter.ui.table` | After setting column filters or the row predicate, before loading results. |
| `selectionchange.ui.table` | Selection changed; detail includes `selectedIds`, `addedIds`, and `removedIds`. |
| `statechange.ui.table` | Serialized view changed; the snapshot is in `event.detail.state`. Remote results may still be pending. |
| `processing.ui.table` | Loading shown. |
| `processed.ui.table` | Loading hidden; also emitted for request errors. |
| `preDraw.ui.table` | Before `preDrawCallback` and DOM rendering. |
| `draw.ui.table` | After row rendering and all draw/footer callbacks. |
| `error.ui.table` | Current remote request failed; `event.detail.error` is the error. |

```js
import $ from '@fr0st/query';

$.addEvent('#scores', 'draw.ui.table', (event) => {
    console.log(Table.init(event.currentTarget).info());
});
$.addEvent('#scores', 'error.ui.table', (event) => {
    console.error(event.detail.error);
});
```

Attach listeners before initialization to observe `init` and the first draw. Successful loading emits `processing → processed → preDraw → draw`; callbacks run pre-draw, header, info, row/created-row pairs, draw callback, then footer. Events are notifications, not cancellation hooks; use `preDrawCallback` to suppress drawing. Disposal interrupts remaining callbacks/events. fQuery exposes namespaces on `event.namespace`; underlying native event types are `draw`, `search`, etc.

## fQuery API

Importing Tables registers `table` on `fQuery.QuerySet`:

```js
import $ from '@fr0st/query';
import '@fr0st/ui-tables';

const table = $('#scores').table({ length: 5 });
$('#scores').table('search', 'Alice');
const score = $('#scores').table('getValue', 0, 1);
$('#scores').table('setValue', 0, 1, 40);
$('#scores').table('dispose');
```

Pass an options object to initialize every matched element, or pass a public method name followed by its arguments. The first component or method result is returned.

Calling the plugin on an uninitialized table initializes it first. Mutators return `void` rather than a chainable QuerySet.

## Accessibility

- Provide a caption, `aria-label`, or `aria-labelledby` to name the table.
- Sortable headings support click, Enter, and Space. Shift adds a sort key, reverses it, then removes it on the third activation.
- `aria-sort` and translated heading labels describe sorting. Hidden columns do not change the indexes used by keyboard sorting.
- Search, length, pagination and loading controls have accessible names; disabled pages use native disabled buttons and the current page has `aria-current="page"`.
- The result-count region uses `role="status"`; its ID is added to existing `aria-describedby` references. Busy state is exposed with `aria-busy`.
- Disposing restores original descriptions and busy state along with the original DOM nodes.

## Customization

Tables consumes `--ui-primary`, `--ui-secondary-color`, `--ui-border-color-translucent` and `--ui-border-width`. Its `.btn-table` class supplies UI 4 button state/focus tokens. Configure `inputStyle`, column `class`, or `Table.classes` for markup styling.

`$table-sort-offset` controls the sort arrows’ distance from the logical inline end of the heading. See [Custom Sass builds](#custom-sass-builds) for configuration.

### Custom Sass builds

Install Sass and create an application stylesheet to customize the component:

```bash
npm i -D sass
```

`src/styles.scss`

```scss
@use "@fr0st/ui-tables/src/scss/tables" with (
    $table-sort-size: .4rem,
    $table-sort-offset: .75rem,
    $btn-table-color: var(--ui-primary)
);
```

Compile the entry point with npm package resolution enabled:

```bash
npx sass --load-path=node_modules src/styles.scss dist/styles.css
```

The `tables` module forwards the [component variables](./src/scss/_vars.scss), all of which have `!default` values. Include Frost UI CSS separately. Build tools that already resolve Sass modules from npm packages do not need the explicit load path.

## Themes and RTL

Frost UI follows the user's preferred color scheme by default. Set `data-ui-theme="light"` or `data-ui-theme="dark"` on the document or an ancestor to select a theme explicitly.

Load UI CSS first, then Tables CSS. UI supplies table and control styling. Set `dir="rtl"` on the document or a containing element so both the table and generated controls inherit direction. Sort arrows use logical positioning.

## Development

Install dependencies with `npm ci`, then install Playwright browsers with `npx playwright install --with-deps`.

```bash
npm test
npm run lint
npm run build
```

`npm test` rebuilds the bundles, runs the ZIP/workbook unit tests once, then runs the browser suite in Chromium, Firefox, and WebKit. Both suites use Playwright. `npm run test:unit` runs without a browser or web server. `npm run test:browser` runs against the existing bundles, so rebuild after changing source files.

After building, `npm run test:coverage` runs Chromium tests and writes coverage reports to `coverage/`.

`npm run test:headed` and `npm run test:ui` also use the existing bundles and open headed browsers or the Playwright UI.

To view the demo, open `demo/index.html` in your browser after building.

## License

Frost UI Tables is released under the [MIT License](./LICENSE).
