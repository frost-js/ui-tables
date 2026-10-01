# Frost UI Tables

[![CI](https://github.com/elusivecodes/FrostUI-Tables/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/elusivecodes/FrostUI-Tables/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/elusivecodes/FrostUI-Tables/branch/main/graph/badge.svg)](https://codecov.io/gh/elusivecodes/FrostUI-Tables)
[![npm version](https://img.shields.io/npm/v/%40fr0st%2Fui-tables?style=flat-square)](https://www.npmjs.com/package/@fr0st/ui-tables)
[![npm downloads](https://img.shields.io/npm/dm/%40fr0st%2Fui-tables?style=flat-square)](https://www.npmjs.com/package/@fr0st/ui-tables)
[![CSS gzip size](https://img.badgesize.io/elusivecodes/FrostUI-Tables/main/dist/frost-ui-tables.min.css?compression=gzip&label=CSS%20gzip%20size&style=flat-square)](./dist/frost-ui-tables.min.css)
[![JS gzip size](https://img.badgesize.io/elusivecodes/FrostUI-Tables/main/dist/frost-ui-tables.min.js?compression=gzip&label=JS%20gzip%20size&style=flat-square)](./dist/frost-ui-tables.min.js)
[![license](https://img.shields.io/github/license/elusivecodes/FrostUI-Tables?style=flat-square)](./LICENSE)

Sortable, searchable tables for Frost UI, with pagination, remote data, and CSV, Excel, and print exports. Try the [interactive demo](./demo/index.html).

## Highlights

- Native table markup, array rows, or object rows with nested column paths
- Case-insensitive searching, stable multi-column sorting, pagination, and column visibility
- Debounced remote requests, optional cancellation, and stale-response protection
- Row/cell/header/footer callbacks and custom layouts/buttons
- CSV, XLSX, and print exports of the displayed results
- Keyboard sorting, accessible controls, filled/outline inputs, and RTL support
- UI 4 theme tokens, configurable Sass, ESM/UMD bundles, and source maps
- Native `Table` class, fQuery plugin, private internals, and JSDoc IntelliSense

## Installation

### Browser projects / bundlers

Install Tables with its UI 4 and query 5 peers:

```bash
npm i @fr0st/ui-tables@^3 @fr0st/ui@^4 @fr0st/query@^5
```

```js
import '@fr0st/ui/dist/frost-ui.min.css';
import '@fr0st/ui-tables/dist/frost-ui-tables.min.css';
import Table from '@fr0st/ui-tables';

const table = Table.init(document.querySelector('#scores'), { length: 10 });
```

The package root resolves to compiled ESM. `dist/*` and `src/*` are exported too. UI and query stay external so Tables shares the application's component and query instances. A browser DOM is required; load Tables on the client in server-rendered applications.

### Browser (ESM)

Include the table from [Usage](#usage) before initializing. Direct browser imports need an import map for core, query, and UI:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fr0st/ui@4/dist/frost-ui.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fr0st/ui-tables@3/dist/frost-ui-tables.min.css">
<script type="importmap">
{
    "imports": {
        "@fr0st/core": "https://cdn.jsdelivr.net/npm/@fr0st/core@4/dist/frost-core.esm.min.js",
        "@fr0st/query": "https://cdn.jsdelivr.net/npm/@fr0st/query@5/dist/fquery.esm.min.js",
        "@fr0st/ui": "https://cdn.jsdelivr.net/npm/@fr0st/ui@4/dist/frost-ui.esm.min.js"
    }
}
</script>
<script type="module">
    import Table from 'https://cdn.jsdelivr.net/npm/@fr0st/ui-tables@3/dist/frost-ui-tables.esm.min.js';
    Table.init(document.querySelector('#scores'));
</script>
```

### Browser (UMD)

Load UI's all-in-one bundle before Tables. It supplies both `UI` and `fQuery`; do not also load a separate query script.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fr0st/ui@4/dist/frost-ui.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fr0st/ui-tables@3/dist/frost-ui-tables.min.css">
<script src="https://cdn.jsdelivr.net/npm/@fr0st/ui@4/dist/frost-ui-bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@fr0st/ui-tables@3/dist/frost-ui-tables.min.js"></script>
<script>
    const table = UI.Table.init(document.querySelector('#scores'));
</script>
```

UMD adds `Table` to the existing `UI` global. With UI's non-bundled script, load core, query, UI, then Tables. UMD is a browser script; this ESM package does not advertise a CommonJS `require()` entry. The `@3` CDN URLs require the 3.0 release; this checkout's demo uses local Tables bundles.

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

`Table.init()` reuses an existing instance. Dispose it before changing initialization options. Original classes and the caption are preserved; disposal restores the original children and their listeners, not the edited data currently displayed.

## Options

Options resolve from `Table.defaults`, then `data-ui-*` attributes, then explicit options. `instance.options` is frozen at the top level. Use methods to update active instances. Set `Table.defaults` and `Table.classes` before initialization for application-wide defaults and matching custom structural/state classes.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `array` | Not set | Local rows; otherwise read `<tbody>` cell HTML. |
| `getResults` | `function` | Not set | Remote loader; takes precedence over local data. |
| `columns` | `array \| null` | `null` | Column definitions, one per heading; see below. |
| `order` | `array` | `[[0, 'asc']]` | Priority-ordered column/direction pairs; `[]` preserves input order. |
| `ordering` | `boolean` | `true` | Enable sorting. |
| `searching` | `boolean` | `true` | Enable local/remote searching. |
| `paging` | `boolean` | `true` | Enable pagination; `false` displays all loaded rows. |
| `length` | `number` | `10` | Positive integer page length. |
| `lengths` | `number[]` | `[10, 25, 50, 100]` | Available positive page lengths. |
| `lengthChange` | `boolean` | `true` | Render the length control when paging is enabled. |
| `info` | `boolean` | `true` | Render the result-count status. |
| `debounce` | `number` | `250` | Local input-search / remote-request delay in milliseconds. |
| `inputStyle` | `'filled' \| 'outline'` | `'filled'` | Search and length control style. |
| `buttons` | `array` | `[]` | Export/custom button configurations. |
| `layout` | `object` | See below | Top/bottom control layouts. |
| `lang` | `object` | See below | Interface and accessibility labels. |
| `icons` | `object` | See below | Trusted HTML for pagination icons. |
| `sanitize` | `function` | `(html) => $.sanitize(html)` | Sanitize heading and cell HTML, including formatted values. |
| `preDrawCallback` | `function \| null` | `null` | Before drawing; return `false` to retain current DOM. |
| `headerCallback` | `function \| null` | `null` | Customize the heading row. |
| `infoCallback` | `function \| null` | `null` | Return the result-count text. |
| `rowCallback` | `function \| null` | `null` | Customize each row before insertion. |
| `createdRow` | `function \| null` | `null` | Customize each inserted row. |
| `drawCallback` | `function \| null` | `null` | After inserting the displayed rows. |
| `footerCallback` | `function \| null` | `null` | Customize the cloned original footer. |

`order`, `lengths`, and `buttons` replace their default arrays, including when empty. Nested object options merge with defaults. Default labels and icon keys:

```js
Table.defaults.lang = {
    info: 'Showing results {start} to {end} of {total}',
    infoFiltered: 'Showing results {start} to {end} of {filtered} (filtered from {total} total)',
    noData: 'No data available', noResults: 'No results to show',
    page: 'Page', perPage: 'Per Page', search: 'Search', loading: 'Loading results',
    paginate: { first: 'First', last: 'Last', next: 'Next', previous: 'Previous' },
    buttons: { csv: 'CSV', excel: 'Excel', print: 'Print' },
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
| `searchable` | `true` | Include this column in local search. |
| `visible` | `true` | Display the column. Hidden columns can still participate in sorting/searching. |
| `format(value)` | `null` | Return cell HTML; runs with the instance as `this`. |
| `createdCell(cell, value, row, rowIndex, columnIndex)` | `null` | Customize the created cell; `rowIndex` is page-relative. |

Search matches a literal case-insensitive substring in raw searchable values, once per row. Sorting uses raw values too, compares numeric values numerically, and preserves source order for ties. Add keys to `order` for tie-breaking. Local changes rerun search, sorting, counts and page clamping. `search()` resets to page one.

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

A new request cancels the debounce and invokes optional `cancel()` on the original pending object. Generation checks reject stale successes/failures even when cancellation cannot stop the work. Disposal cancels owned work. Throws, rejections, and invalid responses clear loading and emit `error.ui.table`; previously rendered rows remain available. Call `reload()` to retry. There is no built-in error banner: use the error event to present one, as the demo does.

Remote mutation methods edit the loaded page and counts in memory; they do not save to the server or load other pages. Persist on your server and reload for authoritative results. `reload()` is not awaitable; observe `draw.ui.table` or `error.ui.table`.

### Rendering, callbacks, and sanitization

Raw cell values and formatter results become strings and pass through `sanitize`; nullish cell values become empty strings. Headings are sanitized too. Use a suitable custom sanitizer when allowing additional safe markup. Returned DOM nodes are not a formatter contract. Direct callback DOM changes bypass sanitization; prefer `textContent` for untrusted text.

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

The default layout is `{ top: 'search,buttons|length', bottom: 'info,pagination' }`. Commas separate layout columns; pipes stack controls within a column. Built-ins are `search`, `buttons`, `length`, `info`, and `pagination`. An empty string omits a row. Omitting a control does not disable its API feature.

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
        { type: 'csv', title: 'Scores', columns: [1, 0] },
        { type: 'excel', title: 'Scores' },
        { type: 'print', title: 'Team scores' },
        { text: 'Show all', callback() { this.length(100); } },
    ],
});
```

Button options are `type`, `text`, `title`, `columns`, `callback`, and CSV's `escapeFormulae`. `text` overrides the translated type label; `title` defaults to the document title. `callback()` overrides the registered handler and receives the Table as `this`. Register reusable handlers through `Table.buttons.yourType = function (options) { ... }`.

Built-in exports include **current displayed rows**, raw values, and visible columns. `columns` explicitly selects/reorders columns, including hidden ones. Heading markup becomes text. Display formatters are not used, and remote exports never fetch other pages.

- CSV quotes commas, quotes and line breaks. Formula-like strings are prefixed with an apostrophe by default; `escapeFormulae: false` opts out. Numeric negatives remain numbers.
- XLSX preserves zero, booleans, Unicode and string formulas as text. Recognized `YYYY-MM-DD`, `DD/MM/YYYY`, optional ` HH:mm:ss`, `HH:mm:ss`, numeric and percentage values receive spreadsheet values/styles. Dates use Excel's 1900 system. Invalid date-like strings remain text.
- Print uses text titles/values, copies table direction/classes and document styles, waits for styles/fonts, and closes after printing. Blocked popups are ignored. Browser print dialogs and settings remain browser-owned.

## Data attributes

Serializable options accept kebab-case `data-ui-*` attributes; arrays and objects accept JSON:

```html
<table id="scores" data-ui-toggle="table" data-ui-length="5"
    data-ui-lengths='[5,10,25]' data-ui-order='[[1,"desc"]]'
    data-ui-input-style="outline" data-ui-searching="true">
    <!-- caption, thead, and tbody as in Usage -->
</table>
```

Other examples include `data-ui-paging="false"`, `data-ui-ordering="false"`, `data-ui-info="false"`, `data-ui-length-change="false"`, `data-ui-debounce="300"`, and JSON `data-ui-columns`, `data-ui-layout`, `data-ui-lang` or `data-ui-buttons`. Supply functions through JavaScript.

`data-ui-toggle="table"` is an initialization selector, not automatic initialization:

```js
$('[data-ui-toggle="table"]').table();
```

## Methods

| Method | Returns | Description |
| --- | --- | --- |
| `Table.init(node, options?)` | `Table` | Initialize a table or return its existing instance. |
| `addRow(row)` | `void` | Append a copied row and refresh local results/counts. |
| `clear()` | `void` | Clear loaded rows/counts, search, paging and pending work. |
| `dispose()` | `void` | Restore original DOM/attributes and cancel work; safe to repeat. |
| `getColumn(key, { modified = true }?)` | `array` | Values for the displayed rows or loaded dataset. |
| `getRow(index, { modified = true }?)` | `array \| object` | Shallow copy of a row. |
| `getValue(index, key, { modified = true }?)` | `any` | Read an array key or object dot path. |
| `hideColumn(index)` | `void` | Hide a data column and redraw. |
| `info()` | `object` | `{ start, end, total, filtered }`; zero-based start, exclusive end. |
| `length(length)` | `void` | Change page length; also synchronize the select. |
| `loading({ show = true }?)` | `void` | Set loading indicator and `aria-busy`; emit processing/processed. |
| `order(pairs)` | `void` | Set sorting, for example `[[0, 'asc'], [1, 'desc']]`. |
| `page(number)` | `void` | Select a one-based page, clamped to the valid range. |
| `refresh()` | `void` | Redraw current results without fetching/recalculating data. |
| `reload({ reset = false }?)` | `void` | Recalculate local results or request remote data; optionally reset offset. |
| `removeRow(index, { modified = true }?)` | `void` | Remove a row and refresh counts/results. |
| `search(term)` | `void` | Set a string search, synchronize input, and reset offset. |
| `setColumn(key, values, { modified = true }?)` | `void` | Replace one column for targeted rows; array length must match. |
| `setRow(index, row, { modified = true }?)` | `void` | Replace a row with a shallow copy. |
| `setValue(index, key, value, { modified = true }?)` | `void` | Update one array key or object dot path. |
| `showColumn(index)` | `void` | Reveal a data column and redraw. |

`instance.node` is the original table; `instance.options` is its resolved configuration. Both become `null` after disposal. Apart from repeat disposal, use a newly initialized instance after disposal.

Row indexes are zero-based. `modified: true` addresses the displayed page after filtering/sorting; `false` addresses the loaded dataset. Column visibility, sort and export indexes always address the original column definitions. Value keys address row data, not visible column positions. Each mutation may reorder or remove rows from the displayed page, so obtain fresh indexes before the next edit.

Invalid row/column indexes and nonpositive/noninteger page lengths throw `RangeError`. Invalid order structures/directions throw `TypeError`; invalid sort column indexes throw `RangeError`. `page()` requires a safe integer. `length()`/`page()` do nothing when paging is disabled; `order()`/`search()` do nothing when their feature is disabled. Local `reload()` uses the loaded dataset, not a fresh parse of edited table markup.

## Events

Events originate on the original table:

| Event | Timing |
| --- | --- |
| `init.ui.table` | Registered and rendered controls, before the initial data load. |
| `length.ui.table` | After setting page length, before loading results. |
| `order.ui.table` | After setting sorting, before loading results. |
| `page.ui.table` | After setting offset, before loading results. |
| `search.ui.table` | After setting the search, before loading results. |
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

Importing Tables registers `.table()` on `fQuery.QuerySet`:

```js
import $ from '@fr0st/query';
import '@fr0st/ui-tables';
const table = $('#scores').table({ length: 5 });
$('#scores').table('search', 'Alice');
const score = $('#scores').table('getValue', 0, 1);
$('#scores').table('setValue', 0, 1, 40);
$('#scores').table('dispose');
```

An options object initializes every matched table. A method name invokes that public method with the following arguments. The first instance or method result is returned; mutators return `void` rather than a chainable QuerySet. Calling the plugin on an uninitialized table initializes it first.

## Accessibility

- Provide a caption, `aria-label`, or `aria-labelledby` to name the table.
- Sortable headings support click, Enter, and Space. Shift adds a sort key, reverses it, then removes it on the third activation.
- `aria-sort` and translated heading labels describe sorting. Hidden columns do not change the indexes used by keyboard sorting.
- Search, length, pagination and loading controls have accessible names; disabled pages use native disabled buttons and the current page has `aria-current="page"`.
- The result-count region uses `role="status"`; its ID is added to existing `aria-describedby` references. Busy state is exposed with `aria-busy`.
- Disposing restores original descriptions and busy state along with the original DOM nodes.

## Styling and customization

Load UI CSS first, then Tables CSS. UI supplies table/control styling and system/light/dark themes. Set `data-ui-theme="light"` or `"dark"` on the document or an ancestor to override the system theme. Set `dir="rtl"` on the document or a containing element so both the table and generated controls inherit direction. Sort arrows use logical positioning.

Tables consumes `--ui-primary`, `--ui-secondary-color`, `--ui-border-color-translucent` and `--ui-border-width`. Its `.btn-table` class supplies UI 4 button state/focus tokens. Configure `inputStyle`, column `class`, or `Table.classes` for markup styling.

For a custom Sass build:

```scss
@use '@fr0st/ui-tables/src/scss/tables' with (
    $table-sort-size: .4rem,
    $table-sort-right: .75rem,
    $btn-table-color: var(--ui-primary)
);
```

```bash
npx sass --load-path=node_modules src/styles.scss dist/styles.css
```

The module forwards [all component variables](./src/scss/_vars.scss), each configurable with `!default`. `$table-sort-right` retains its existing name but now means the logical inline end. Include UI CSS separately.

## Migrating from 2.x

- Install the UI 4/query 5 peers. Import the compiled default ESM entry or load the UMD bundle after UI's bundle.
- Old underscore fields/prototype modules are private. Extend `Table.layout`, `Table.buttons`, callbacks, or public methods instead.
- Configuration arrays replace defaults. Empty ordering is supported. Validation rejects malformed indexes, lengths, orders and remote responses.
- Formatted HTML is sanitized by default. Configure `sanitize` deliberately if additional markup is required.
- CSV formula-like strings are escaped by default. Export scope stays the displayed page and raw values.
- Sass uses `@use`/`@forward`, UI 4 tokens, and `_vars.scss`. Remove obsolete ripple-line styling.
- Search and edits now recalculate results/counts correctly; disposal restores the original table nodes, including their listeners.

The former light/dark demo pages are consolidated into [one showcase](./demo/index.html). Its theme selector covers both modes. Old `default.html` and `query.html` map to `#basic`; `data.html`/`objects.html` to `#data`; `empty.html` to `#empty`; all `disable-*.html` pages to `#controls`; `column-format.html`, `created-cell.html`, `row-callback.html`, and `footer-callback.html` to `#callbacks`; `layout.html` to `#layout`; `buttons.html`/`buttons-custom.html` to `#exports`; `demo/methods.html` and `demo/events.html` to `#methods-events`. Remote examples are at `#remote`.

## Development

Use Node `^20.19.0 || ^22.13.0 || >=24`:

```bash
npm ci
npx playwright install --with-deps
npm run lint
npm test
npm run test:coverage
npm run lint:sass:unused
```

`npm test` rebuilds JS/CSS and runs Chromium, Firefox and WebKit. `test:browser`, `test:coverage`, `test:headed` and `test:ui` use existing bundles; rebuild after source changes. Coverage HTML and LCOV are written to `coverage/`, including workbook/ZIP sources. Keep `dist/` and the lockfile committed. The npm release-age policy applies when resolving dependencies.

Serve the repository root (for example `python3 -m http.server 8000`) and open `/demo/`. The demo loads UI 4 from jsDelivr and this checkout's Tables build. Its remote data is simulated locally. Automated demo tests use installed UI assets and require no CDN access.

CI follows UI's Node 20/22/24 Chromium matrix plus Node 24 Firefox/WebKit. It lints, builds, tests, checks tracked bundles, validates package contents, and uploads Chromium LCOV through Codecov OIDC. See [release setup](./.github/RELEASE.md) for Codecov activation and npm trusted publishing. Publishing is triggered by a GitHub release; creating these workflow files does not publish a version.

## License

Frost UI Tables is released under the [MIT License](./LICENSE).
