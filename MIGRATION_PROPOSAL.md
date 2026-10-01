# Frost UI Tables 3.0 migration proposal

Prepared 1 October 2026. Proposed release: `@fr0st/ui-tables@3.0.0`, upgrading from `2.0.5`.

This document records the migration plan and original audit. Implementation progress is recorded below. The work includes dependency compatibility, packaging, component architecture, styles, testing, CI, documentation, demos, and the defects identified below.

## Implementation progress

Delivery steps **1 and 2 were committed as `fe56c36`** (`Modernize package builds and component architecture`). They established the following foundation:

- Added `.npmrc`, expanded `.gitignore`, upgraded the package to `3.0.0` with declared UI 4/query 5 peers, ran `npx sort-package-json`, and regenerated the lockfile. Retained PostCSS CLI 11 for Node 20 compatibility; the release-age policy selected Sass Embedded 1.105.0 and Monocart 2.13.1.
- Replaced Rollup/Terser scripts with Vite, renamed the browser entry, and generated expanded/minified ESM and UMD bundles with source maps. Retained the Sass/PostCSS CSS build pipeline.
- Folded the prototype modules into `Table`, moved configuration into class statics, adopted private state/methods and the current BaseComponent API, updated `getHtml` calls, and added option/data/callback JSDoc. Workbook/ZIP internals also use private fields; intentional cross-class length access uses getters.
- Preserved custom layout/button receivers and supplied explicit data to the built-in export helpers. Added the reference Playwright fixtures/server, class/QuerySet initialization/disposal tests, initial API/data/extension tests, ESM/minified bundle checks, and local source coverage reporting.
- Fixed compatibility/refactor blockers with regressions: `infoCallback`'s invalid variable, the undefined header callback node, hidden-column export selection, the invalid unpaged limit, repeat disposal, and original class/description restoration.

Validation completed on Node 24: clean `npm ci`, JS/CSS lint, build, unused Sass variable check, package dry-run, **81 passing browser tests** (27 each in Chromium, Firefox, and WebKit), and **27 passing coverage tests**. Initial source line coverage is **41.60%**, including untested workbook/ZIP sources; this is the initial harness baseline, not completion of the final 95% coverage objective. Independent smoke checks passed for three DEFLATE round trips and workbook ZIP CRCs/XML/Unicode/numeric output.

Additional issues found during steps 1 and 2: Git tracked `Workbook`/`Zip` and several filenames with uppercase spelling while imports used lowercase, which would break a Linux checkout. Explicit case-only renames now make those paths consistent. Updated lint also exposed an undeclared loop variable in the compressor and lexical declarations without switch-case scopes; those were corrected.

### Steps 3 and 4

Implemented the data/lifecycle and export/style work:

- Replaced the bucket/index pipeline with filter-once, stable multi-column sorting, page clamping, and slicing. Local edits rerun the complete pipeline, including counts. Fixed empty ordering, `orderData`, prototype-like sort values, duplicate search matches, stale mutation indexes, empty-page counts, and hidden-column sorting.
- Validated initialization, page lengths, order definitions, row/column indexes, and remote responses. Configuration arrays replace defaults exactly, including empty order and custom lengths. Omitted controls work independently of enabled features, and programmatic search/length changes synchronize their controls.
- Implemented pre-draw cancellation and guarded rendering against disposal and callback-triggered redraws. Disposal cancels search/request timers, restores original DOM nodes and their listeners, classes, IDs and accessibility attributes, and supports reinitialization from request cancellation hooks. The caption remains visible while enhanced.
- Preserved original remote cancellation handles, caught synchronous and asynchronous failures, added `error.ui.table`, rejected stale resolutions/rejections, handled zero rows, and refetched a valid page after the server count shrinks.
- Corrected CSV quoting, added configurable formula escaping, and revoked download URLs. Print uses text content, handles blocked popups, copies direction, and awaits stylesheet/font readiness before printing and closing.
- Corrected XLSX column letters, repeated XML entities/control characters, zero/boolean cells, date/time serials, shared-string counts/deduplication, repeated workbook creation, worksheet names, ragged-row widths and style counts. ZIP output now has explicit little-endian fields, UTF-8 flags and valid DOS timestamps; corrected the compressor's match-length search bounds.
- Migrated Sass to modules and configurable `!default` variables, UI 4 color/focus/button tokens, and logical RTL arrow positioning. Removed obsolete filled-input ripple markup and overflowing negative control-row margins. Added labeled search/loading controls, native disabled pagination buttons and current-page state.
- Added locator-based API, interaction, lifecycle, remote, export and style regressions. CSV downloads are parsed; XLSX downloads are independently inflated, CRC-checked and XML-parsed. Print tests verify loaded stylesheets/fonts at print time; style tests cover owned tokens, focus, RTL and narrow layouts.

Validation on Node 24: **333 passing browser tests** (111 each in Chromium, Firefox and WebKit), JS/CSS lint, production builds, unused Sass variables, Sass consumer `@use ... with (...)` configuration, package dry-run, and source-map/source consistency checks. Additional independent DEFLATE round trips covered empty, single-byte, repeated, pseudorandom and Unicode payloads up to 280,000 bytes. Date probes checked serials 1/59/60/61 at the 1900 boundary and the documented 2011-07-05 serial 40729; column 16,384 resolves to XFD. See the [Excel date system reference](https://support.microsoft.com/en-us/excel/date-systems-in-excel) and [ZIP specification](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT).

All **111 coverage tests pass**, with no skips or retries. Monocart reports **93.11% source line coverage**, **92.77% statements**, **83.57% branches**, and **96.59% functions**, including workbook/ZIP sources. The generated LCOV executable-line totals are **1,358/1,464 (92.76%)**; this differs from Monocart's V8 source-line accounting. The final 95% coverage objective and Codecov integration remain part of step 6; no implementation sources were excluded to raise coverage.

Additional confirmed issues fixed during these steps: captions disappeared while the table was active; negative control-row margins overflowed narrow viewports in Firefox/WebKit; the footer callback received a clone collection instead of the footer element; shared-string counts survived repeat workbook creation; worksheet names and comma-joined sheet elements could yield malformed multi-sheet XML; ZIP month/year/time and UTF-8 flags were incorrect; the longest-match search used the candidate-list length instead of the input length. Regression checks also exposed the cancellation-hook reinitialization case, which now restores the DOM before invoking user cancellation.

### Behavior decisions for the 3.0 migration

- `modified: true` indexes address displayed rows; `modified: false` addresses the loaded dataset. Remote mutation methods edit the currently loaded rows and counts in memory; they do not persist changes on the server. `reload()` restores the server's authoritative results.
- `info()` retains a zero-based start and exclusive end. UI result text uses one-based nonempty ranges and `0 to 0` for an empty dataset. Page numbers are one-based integers and clamp to available pages. Page lengths must be positive safe integers. Invalid rows, order definitions, column indexes and row indexes throw instead of failing partway through rendering. `setColumn()` requires one value per targeted row.
- DOM headings support one row without spans. A supplied `columns` array must match existing headings; it can generate headings when no header exists. Array options replace defaults, and `order: []` preserves source order. Local search is a case-insensitive literal substring match across searchable columns and counts each matching row once.
- `preDrawCallback` may return `false` to retain the existing DOM. Other lifecycle events remain notifications. Successful local loading emits `processing`, `processed`, `preDraw`, then `draw`; callbacks run as pre-draw, header, info, row/created-row pairs, draw callback, then footer. Guards stop subsequent work if a callback disposes or starts another draw.
- A failed current remote request clears loading and emits `error.ui.table` with `event.detail.error`, retaining previously rendered rows for retry. Superseded failures are ignored. Optional cancellation is best effort; generation checks also protect against uncancellable responses. Request columns/order retain numeric-keyed record shapes.
- Cells, headings and formatter HTML use query's sanitizer by default. `sanitize(html)` is the explicit customization hook. This may remove markup accepted by 2.x; applications needing additional safe markup should supply an appropriate sanitizer.
- All built-in exports use current displayed rows, raw data values, and visible columns by default. `columns` overrides selection and order, including explicitly selected hidden columns. Exports do not invoke display formatters or fetch other server pages. CSV prefixes formula-like strings with an apostrophe by default (`escapeFormulae: false` opts out); numeric negatives remain numbers. XLSX stores formula-like strings as text, retains recognized ISO/day-first dates and times, and uses the Excel 1900 date convention. Print values and titles are text.

Steps **5 and 6 remain pending**: the README/demo rewrite, final coverage review, and CI/Codecov/publishing integration. The audit table below is historical: its code paths and findings describe the pre-migration implementation, while the progress above records their fixes. The former prototype functions now live in `src/js/table.js`.

## 1. Reference projects and alignment

Use [UI](../ui/package.json) as the primary authority for the component model, styling, tooling, and CI. Use [AuthCodeInput](../ui-authcodeinput/package.json) for a standalone component's public API and test organization, and [SelectMenu](../FrostUI-SelectMenu/package.json) for a standalone component with CSS, asynchronous data, and custom rendering.

The requested `../ui-selectmenu` directory is absent in this workspace. Its available counterpart is `../FrostUI-SelectMenu`, whose package is already `@fr0st/ui-selectmenu@4.0.0`.

| Area | Current Tables | Proposed alignment |
| --- | --- | --- |
| Runtime dependencies | Imports UI/query but declares neither | UI `^4.0.0` and query `^5.0.0` as peers and development dependencies |
| Package entry | Raw `src/js/index.js` | Compiled default ESM export; explicit `dist/*` and `src/*` exports |
| JavaScript build | Rollup plus separate Terser command | Vite 8 library build, ESM and UMD, expanded/minified with maps |
| Browser entry | `src/js/wrapper.js` | `src/js/browser.js`, exporting named `Table` into existing `UI` |
| Component implementation | Class assembled by prototype assignment in the entry module | Class-owned static configuration, private fields/methods, registration-only entry |
| Styles | Legacy Sass imports, UI 2-era input markup and RGB tokens | Sass modules and UI 4 input/button/theme conventions |
| Tests | None | Playwright Chromium/Firefox/WebKit, reference fixture/server layout |
| Coverage/CI | None | Monocart source coverage, Codecov, reference CI matrix and tracked bundle checks |
| Docs/demos | Minimal README, duplicated light/dark demos | Full API documentation and one interactive component showcase |

Relevant implementation references:

- [UI BaseComponent](../ui/src/js/base-component.js), [component registration](../ui/src/js/helpers/component.js), and [Alert class](../ui/src/js/alert/alert.js).
- [SelectMenu class](../FrostUI-SelectMenu/src/js/select-menu.js), [Vite configuration](../FrostUI-SelectMenu/vite.config.js), and [Sass entry](../FrostUI-SelectMenu/src/scss/selectmenu.scss).
- [UI component tests](../ui/test/browser/components/alert.test.js), [AuthCodeInput tests](../ui-authcodeinput/test/browser/auth-code-input.test.js), and [SelectMenu tests](../FrostUI-SelectMenu/test/browser/select-menu.test.js).
- [SelectMenu coverage fixture](../FrostUI-SelectMenu/test/support/test.js), [coverage configuration](../FrostUI-SelectMenu/playwright.coverage.config.js), and [CI](../FrostUI-SelectMenu/.github/workflows/ci.yml).
- [fQuery API](../fquery/src/fquery.js) and [core utilities](../core/src/index.js), checked to distinguish actual API removals from functions that remain supported.

## 2. Dependencies, package metadata, and repository files

### Version targets and the meaning of “latest”

Public npm registry `latest` metadata was checked on 1 October 2026. The following are verified registry versions, rather than assumed versions copied from sibling manifests. Recheck them when implementing and retain a reproducible lockfile.

| Package | Current manifest | Registry latest | Proposed target |
| --- | --- | --- | --- |
| `@fr0st/ui` | Undeclared | `4.0.0` | `^4.0.0`, peer + dev |
| `@fr0st/query` | Undeclared | `5.0.0` | `^5.0.0`, peer + dev |
| `@fr0st/eslint-config` | `^1.0.3` | `5.0.3` | `^5.0.3` |
| `@fr0st/stylelint-config` | `^1.0.8` | `4.0.2` | `^4.0.2` |
| `vite` | Absent | `8.3.1` | `^8.3.1` |
| `@playwright/test` | Absent | `1.63.0` | `^1.63.0` |
| `monocart-reporter` | Absent | `2.14.0` | Latest eligible release; see release-age restriction below |
| `eslint` | `^9.26.0` | `10.11.0` | `^10.11.0` |
| `stylelint` | `^16.19.1` | `17.15.0` | `^17.15.0` |
| `sass-embedded` | Uses `sass@^1.88.0` | `1.105.1` | Replace `sass`; latest eligible release |
| `autoprefixer` | `^10.4.21` | `10.6.1` | `^10.6.1` |
| `postcss` | `^8.5.3` | `8.5.28` | `^8.5.28` |
| `postcss-cli` | `^11.0.1` | `12.0.0` | Keep `^11.0.1` for UI's Node support; explicit exception |
| `clean-css-cli` | `^5.6.3` | `5.6.3` | Keep `^5.6.3` |
| `find-unused-sass-variables` | `^6.1.0` | `6.2.1` | `^6.2.1` |
| `sort-package-json` | Absent | `4.0.0` | Run through `npx` on Node 24 during implementation |

Sources: public npm registry metadata for [UI](https://registry.npmjs.org/@fr0st%2Fui/latest), [query](https://registry.npmjs.org/@fr0st%2Fquery/latest), [Vite](https://registry.npmjs.org/vite/latest), [Playwright](https://registry.npmjs.org/@playwright%2Ftest/latest), [PostCSS CLI](https://registry.npmjs.org/postcss-cli/latest), [Sass Embedded](https://registry.npmjs.org/sass-embedded), [Monocart](https://registry.npmjs.org/monocart-reporter), and [sort-package-json](https://registry.npmjs.org/sort-package-json/latest). The same registry endpoints were queried for every other package in the table.

Two constraints need to be explicit:

1. **Latest PostCSS CLI conflicts with full UI alignment.** Version 12 requires Node `>=22`; UI and both component references support `^20.19.0 || ^22.13.0 || >=24` and test Node 20. Recommend preserving that shared engine range and using PostCSS CLI 11.0.1. Adopting CLI 12 instead means deliberately dropping Node 20 and coordinating that change with UI. `sort-package-json@4` also requires Node 22+, but it is a maintainer command, so run it on Node 24 without making it part of the Node 20 build.
2. **Some latest releases are too young for the reference `.npmrc`.** `sass-embedded@1.105.1` was published on 29 September at 22:22 UTC and `monocart-reporter@2.14.0` at 16:37 UTC. They do not pass a three-day release-age gate until 2 October at the respective times. Resolve eligible versions during implementation, or adopt those releases once eligible; do not bypass the policy to label the package “latest.” The reference versions are Sass Embedded 1.105.0 and Monocart 2.13.1. Vite 8.3.1 was published on 24 September and clears that gate.

Remove direct development dependencies on `@rollup/plugin-node-resolve`, `rollup`, and `terser`. Vite supplies the JavaScript build/minification pipeline. Keep Sass/PostCSS/clean-css as separate CSS stages, matching UI and SelectMenu.

### `.npmrc` and `.gitignore`

Add the SelectMenu policy:

```ini
min-release-age=3
min-release-age-exclude[]=@fr0st/eslint-config
min-release-age-exclude[]=@fr0st/stylelint-config
min-release-age-exclude[]=@fr0st/core
min-release-age-exclude[]=@fr0st/query
min-release-age-exclude[]=@fr0st/ui
```

Use an npm version that implements this policy when resolving the lockfile. Update `.gitignore` to the reference groups: `node_modules/`, `.tmp/`, `coverage/`, `playwright-report/`, and `test-results/`. Keep `dist/` and `package-lock.json` tracked.

### Package contract

- Bump to `3.0.0`; retain `@fr0st/ui-tables`, public publishing, MIT license, and the existing repository identity. The remote is currently `elusivecodes/FrostUI-Tables`; do not invent a `frost-js/ui-tables` repository migration.
- Rewrite the description and keywords to describe actual table features. Align author/repository formatting with the reference components.
- Retain `type: module`; set `main` and `module` to `./dist/frost-ui-tables.esm.js`, and `unpkg`/`jsdelivr` to `./dist/frost-ui-tables.min.js`.
- Add root `import` and `default` export conditions pointing to the ESM file, plus `./dist/*` and `./src/*` mappings. Keep `files: [dist, LICENSE, README.md, src]` and `publishConfig.access: public`.
- Declare UI/query in both `peerDependencies` and `devDependencies`. Keep them external in component bundles, sharing the application's instances. Do not add core as a direct runtime dependency unless the implementation actually imports it.
- Set the UI engine range above and `browserslist: ["baseline newly available"]`. Match the reference Vite target separately: `baseline-widely-available`.
- Preserve initialization side effects: importing the package registers the fQuery plugin. Do not mark the entire package `sideEffects: false`.
- After editing the manifest, run **`npx sort-package-json`**, regenerate the lockfile, and verify `npm ci` from a clean checkout. These commands belong to implementation; they were not run against the current manifest for this proposal.

Adopt the same scripts as the styled component reference: `build`, `build:js`, `build:css`, `compile:css`, `autoprefix:css`, `minify:css`, `lint`, `lint:js`, `lint:css`, `lint:sass:unused`, `test`, `test:browser`, `test:coverage`, `test:headed`, and `test:ui`. `npm test` builds before browser tests; the individual browser/coverage commands use existing bundles, as documented by the references.

## 3. Vite and published bundles

Replace `rollup.config.js` with `vite.config.js`, adapting SelectMenu's `defineConfig(({ mode }) => ...)` and Vite 8 `rolldownOptions` configuration.

- Default mode builds `src/js/index.js` into ESM; `--mode umd` builds the renamed `src/js/browser.js`.
- Keep a default `Table` export for ESM and named `Table` export for UMD. Set UMD `name: 'UI'`, `extend: true`, and globals `@fr0st/query: 'fQuery'`, `@fr0st/ui: 'UI'`.
- Emit expanded and minified output in each mode with source maps. Set `emptyOutDir: !isUmd` so UMD does not delete ESM.
- Run JavaScript before CSS, because the first Vite build clears `dist`.
- Preserve separate component CSS files; consumers load UI CSS first.

Expected artifacts, each accompanied by `.map`:

```text
dist/frost-ui-tables.esm.js
dist/frost-ui-tables.esm.min.js
dist/frost-ui-tables.js
dist/frost-ui-tables.min.js
dist/frost-ui-tables.css
dist/frost-ui-tables.min.css
```

The UMD files remain browser scripts, not an advertised CommonJS `require()` entry in this ESM package. Validate both minified and expanded bundle loading, preservation of existing `UI` components, and ESM default import/plugin registration. Use package-resolved dependencies in test fixtures, never sibling source paths or public CDNs.

## 4. JavaScript architecture and behavior

### Component structure

Keep `src/js/index.js` focused on importing `Table`, calling `initComponent('table', Table)`, and exporting it. Move defaults/classes/buttons/layout into static class fields in `table.js`. Fold all five `src/js/prototype/` modules into class methods and remove that directory and prototype composition.

Use `this.node` and `this.options` from UI 4's BaseComponent. Its internal node/options fields are private, and resolved options are shallow-frozen. Copy mutable column, order, layout, and data bookkeeping into class-owned state; do not mutate shared defaults or treat options as mutable state.

Convert component implementation fields/methods to `#private` declarations. Retain pure helpers in modules where they are independently useful. Apply the same private-field/JSDoc cleanup to the shipped `Workbook` and ZIP implementation, preserving intentional cross-class access through documented methods/getters. This should not stop at the main `Table` class.

Replace `$.getHTML` with `$.getHtml` in DOM extraction and printing. The query 5 facade still exposes core utilities such as `$._getDot`, `$._setDot`, and `$._isPlainObject`; their underscore prefix does not make them obsolete. Retain `$._debounce(callback, delay)` for timed debouncing and cancellation: `$.debounce` is a different, once-per-microtask helper.

Add JSDoc typedefs for options, columns, row data, order tuples, request/response payloads, button/layout callbacks, language strings, and lifecycle callbacks. Use `@augments {BaseComponent<TableOptions>}`, `@returns`, lowercase primitive types, accurate optional/default values, and precise row/column/index semantics.

### Preserve extension points without exposing private state

`Table.buttons` and `Table.layout` currently call underscore methods through a bound component instance. A mechanical conversion to `#private` would break them.

Keep both registries as supported static extension points. Define built-in layout functions inside the class so they can call its private render methods. Define built-in button adapters there too; each adapter prepares a detached export payload and passes it to pure CSV/XLSX/print helpers. External helpers must receive their inputs explicitly rather than reading the instance's private fields.

Continue invoking custom button callbacks with the component as `this`, and custom layout callbacks with their destination container. Public methods and documented callback arguments are the supported integration surface. Access to old underscore fields/methods becomes a documented breaking change; do not recreate public aliases for every internal member.

### Data and lifecycle contract

- Preserve DOM data, supplied arrays, object rows/dot-path columns, local search, multi-column ordering, pagination, column visibility, callbacks, configurable controls, and CSV/XLSX/print buttons.
- Preserve public methods: `addRow`, `clear`, `dispose`, `getColumn`, `getRow`, `getValue`, `hideColumn`, `info`, `length`, `loading`, `order`, `page`, `refresh`, `reload`, `removeRow`, `search`, `setColumn`, `setRow`, `setValue`, and `showColumn`, alongside inherited `init`, `node`, and `options`.
- Preserve `.table()` and `*.ui.table` event names. Document event order, callback arguments, and any cancellation behavior; do not silently invent cancellability for every existing notification event.
- Centralize the local pipeline as filter → stable sort → clamp page → slice → render. Compute counts from the complete filtered dataset, and apply the pipeline after mutations. Indexes used by getters/mutators must refer to the current displayed rows when `modified: true`.
- Preserve remote `getResults(request)` → `{ results, total, filtered }`/promise behavior. Existing `request.order` and `request.columns` are numeric-keyed records, not arrays; retain and document that shape for this migration rather than silently changing server contracts. Preserve optional term/order/paging fields.
- Catch synchronous callback throws as well as promise rejections, retain optional cancellation on the original returned object, invalidate stale responses, validate result counts/rows, and cancel pending debounce work on disposal. Guard against disposal inside callbacks/events and subsequent late work.
- Define invalid-input behavior: reject invalid nonpositive/nonfinite page lengths; clamp finite out-of-range pages; treat `order: []` as unsorted; handle empty data and hidden/nonorderable columns consistently. Document whether invalid column/index arguments throw or are ignored and apply one policy consistently.
- Keep built-in exports scoped to the current displayed results by default, matching the existing implementation. Do not imply that remote exports fetch the complete server dataset.
- Use the reference sanitization pattern for strings inserted as HTML, including formatter output. Preserve useful formatted HTML through an explicit sanitizer hook; document any sanitization-related change in 3.0. Print titles should be assigned as text. Add focused tests for untrusted cell values rather than assuming every data source is trusted.
- Make disposal idempotent, cancel timers/requests, detach component handlers, restore original markup/classes/attributes and positioning, and call the base cleanup once. Preserve original IDs and accessibility attributes.

## 5. Styles and Sass

Styling changes are required. Current Tables references UI RGB variables and button focus variables that the UI 4 source no longer defines, and creates obsolete `ripple-line` elements for filled inputs.

- Rename `vars.scss` to `_vars.scss`; use `@forward "vars"` and namespaced `@use "vars"` in `tables.scss`, as SelectMenu does. Make every configurable variable `!default`, including the currently nonconfigurable sort focus shadow.
- Keep configurable sorting arrows and table export-button styling, but use current color tokens, `color-mix(...)`/UI-compatible color expressions, and `--ui-btn-focus-shadow-color` instead of legacy RGB focus variables.
- Provide a complete button state contract: background, foreground, border, hover, active, focus, and ripple values compatible with UI 4. Audit the generated `.btn-table` styles rather than relying on old defaults.
- Remove separate filled-input ripple markup; align search/select controls, sizes, form-input wrappers, spacing utilities, and pagination with current UI markup.
- Use logical padding/inset properties for sort arrows and spacing so RTL works. Preserve visible keyboard focus and accessible sort state.
- Keep only component CSS in this package. UI remains responsible for global theme behavior and base table/control styling.

Tables owns theme-dependent sort and button styles, so a small set of targeted style tests is warranted: sort indicator colors, custom button states, and focus styling under the relevant tokens. Do not duplicate the whole behavioral suite for light/dark themes or retest UI's generic theme system. Test RTL arrow placement and narrow-layout overflow as component behavior.

## 6. Playwright and coverage

### Harness and suite organization

Mirror the references' `test/package.json` with a `#test` import mapped to `support/test.js`; `test/setup/browser.js`; `test/support/app/index.html`; and `test/support/server/static-server.js`. The automatic fixture loads the local UMD bundle plus installed UI assets, verifies `UI.Table`/`QuerySet.prototype.table`, clears the fixture body, and waits for styles where needed. Support an opt-in mock clock and coverage collection.

Use the same Playwright browser projects, 30-second timeout, reduced motion, 800×600 default viewport, and local port 3001. Do not copy clipboard permissions into Tables tests without a feature that needs them.

Follow the reference `describe` order and naming closely:

```text
Table
  #init
  #dispose
  #addRow, #clear, #getColumn, #getRow, #getValue, ...remaining public methods
  events
  user events
  data option
  columns option
  ordering and searching
  layout option
  rendering and sanitization
Table remote results
  responses
  errors and retry
  cancellation
  pagination
  debounce
Table buttons
  csv
  excel
  print
  custom buttons
Table styles
  controls and layout
  sort indicators and focus
  button styling
  RTL
```

Place these in `table.test.js`, `table-data.test.js`, `table-buttons.test.js`, and `table-style.test.js`. Keep `#init` and `#dispose` first even though the current source lists some methods before `dispose`; keep remaining method groups in source/API order. Use the reference parameterized `class`/`QuerySet` cases within method groups, with readable case names. Include multiple-element initialization, first-instance return behavior, instance reuse, and method dispatch.

Use `page.evaluate` for setup and calls into the public API. Use locator assertions for observable behavior: `toHaveCount`, `toHaveText`, `toHaveValue`, `toHaveAttribute`, `toHaveClass`, `toBeVisible`, `toBeDisabled`, `toBeFocused`, and `toHaveCSS`. For example, assert actual ordered cell text and `aria-sort`, not a large object copied out of the DOM. Reserve direct scalar/array assertions for real API return values, event payloads, and export data with no locator equivalent. Do not copy the references' occasional object snapshot assertions where stronger assertions exist.

Use browser actions for sorting, shift sorting, paging, searching, and exports. Use controlled promises and the Playwright clock for stale responses/debounce/disposal; avoid fixed sleeps. Test native disabled pagination buttons, accessible control names, current page indication, sorting by Enter/Space, and the status region.

Download tests must parse CSV and independently inspect XLSX ZIP/XML contents, not merely assert a filename or a nonempty blob. Include Unicode, duplicate values, quotes/newlines, zero/false, dates/times, hidden columns, more than 26 columns, and multiple sheets at the workbook level. Validate ZIP stored/compressed entries and CRCs with an independent decoder. Keep workbook/ZIP checks focused on the bundled implementation's observable output, not private members or exact compressed bytes/timestamps.

Add small package/bundle smoke checks for the ESM entry and minified builds alongside the main UMD suite. Their purpose is to verify exports and dependency sharing, not duplicate all component tests.

### Coverage and Codecov

Adapt the coverage fixture and config using `FROST_UI_TABLES_COVERAGE=true`, Chromium V8 coverage, and Monocart. Collect only `/assets/frost-ui-tables.js`; map through `dist/frost-ui-tables.js.map` to local `src/js/` files, normalize Windows paths, and emit console, HTML, and `coverage/lcov.info` reports.

Include all implementation sources, including workbook and ZIP code. Exclude only genuinely erased re-export-only entry code, such as `browser.js`. `index.js` registers a component and therefore contains executable behavior; do not exclude it by copying UI's different entry exclusion. Use `all: './src/js'` so unvisited implementation files remain visible.

Use the reference Codecov policy: project target 95%, threshold 5%, failed CI reported as an error, and informational patch coverage. Treat coverage of the bundled ZIP implementation as real work; do not hide it to reach the target. Codecov configuration is not a substitute for reviewing the generated source report or a local threshold check if one is later desired.

## 7. CI and release workflow

Add `.github/workflows/ci.yml` with UI's `main` push/PR triggers and Markdown-only path exclusions. Use the five reference matrix entries: Node 20/22/24 with Chromium, and Node 24 with Firefox/WebKit.

Each job installs through `npm ci`, installs its Playwright browser/system dependencies, lints, builds, runs its browser project, verifies tracked `dist` output is current, and runs `npm pack --dry-run`. The Node 24 Chromium job runs coverage instead of repeating the ordinary suite and uploads `coverage/lcov.info` through Codecov OIDC.

Use the reference actions (`actions/checkout@v6`, `actions/setup-node@v6`, `codecov/codecov-action@v7`), checking compatibility when implementing. Match `contents: read`, `id-token: write`, npm caching, `--forbid-only`, and explicit worker limits. Use SelectMenu's stronger `git status --porcelain --untracked-files=all -- dist` guard to catch untracked new ESM artifacts as well as modified tracked files. Investigate platform-dependent output if Node matrix builds differ; do not suppress the check.

Add `.github/codecov.yml`. Repository-side Codecov activation/OIDC settings must be configured before its required upload can pass; record that release setup separately from committing files.

For full reference alignment, also add the release-triggered `publish.yml`: Node 24, clean install, lint/build/Chromium validation, bundle/package checks, then `npm publish --provenance`. Configure npm trusted publishing for the actual repository/workflow. Creating workflow files does not create a GitHub release or publish the package. Release publication follows successful validation and the normal release decision.

## 8. README and demos

Rewrite the README using the reference order: title/badges, highlights, installation, usage, options, data attributes, methods, events, fQuery API, accessibility, styling/customization, development, and license. Add Tables-specific sections for columns/formatters, local versus remote data, callbacks/layout extensions, and export scope.

Provide working examples for bundler ESM, direct-browser ESM with an import map for core/query/UI, and UMD loading UI's bundle before Tables. Show both required CSS files. Explain that the package requires a browser DOM and that UI's bundled script already provides fQuery. Include Sass `@use ... with (...)` customization and the major-version migration notes.

Document every supported option/method and the callback/event ordering verified by tests. Include request/response shapes, zero-based data indexes versus one-based page numbers, `info()` semantics, mutation behavior during filtering, safe formatted HTML, disposal, and current-page export behavior. Replace the “documentation coming soon” placeholder.

Replace the duplicated `demo/light` and `demo/dark` pages with `demo/index.html`, `demo/assets/demo.js`, and `demo/assets/demo.css`, following the UI/component showcase layout and theme control. Preserve existing feature coverage through sections for basic/empty data, array/object rows, sorting, searching, pagination, lengths, visibility, callbacks, custom layouts, export/custom buttons, remote data, and methods/events.

Use UI 4 CDN assets for the public demo and local Tables bundles, as SelectMenu does; use deterministic in-memory rows and simulated asynchronous requests so the demo needs no server API. Keep a system/light/dark selector through `data-ui-theme`, responsive layout, accessible labels, and an event log. Show loading, rejection/retry, and cancellation behavior. Replace old demo links in documentation and provide a mapping of removed pages to the new section anchors.

## 9. Bugs and issues found during the audit

**Evidence labels:** “Reproduced” means a focused Node execution of the existing helper/method confirmed the result. For DOM-dependent functions the probe supplied minimal dependencies and instance state; these are not full browser regressions. “Source finding” means the defect follows from the inspected source and still needs a browser/integration regression. All paths below refer to the current, pre-migration code.

| Priority | Finding and evidence | Required correction/regression |
| --- | --- | --- |
| Blocker | **UI 4 incompatibility — source finding.** `table.js` and all prototype modules use `_node`/`_options`; UI 4 exposes only `node`/`options`. `helpers.js` and `buttons.js` call `getHTML`, absent from query 5. | Update the base API and renamed HTML getter; test DOM initialization, rendering, and print with declared peers. |
| High | **Hidden columns break export — reproduced.** `prototype/helpers.js::_getVisibleColumns` returns `undefined` at the first hidden column. | Skip hidden columns; assert CSV/XLSX/print include exactly the selected visible columns. |
| High | **Filtering leaks rows during sorting — reproduced.** `_getOrderedIndexes` computes `filteredRows` but uses original `rows` in its terminal branch. With indexes `[0,1,2]` and allowed `[1]`, it returns `[0,1,2]`. Its skip accounting also counts unfiltered rows. | Filter before sorting/paging; test tied sort values, later pages, and multiple sort keys. |
| High | **Search counts the same row repeatedly — reproduced.** `Table.search` pushes a row index for every matching searchable column. One row matching two columns produces `filtered: 2` and `[0,0]`. It also retains the old page offset. | Match each row once and reset/clamp pagination on a new search. |
| High | **Disabled ordering creates invalid page indexes — reproduced.** `_getDataInit` uses an inclusive range from offset through offset + limit without bounding to data. Two rows with limit 10 produce 11 indexes and nine undefined rows. Existing filtered indexes also bypass page slicing when ordering is disabled. | Slice bounded dataset indexes; cover ordering off with paging/search on and off. |
| High | **Empty/custom ordering crashes — reproduced.** `_getOrderedIndexes([])` destructures `undefined`; `_getOrder` indexes `this._columns[index.orderData]` instead of the selected column's mapping. | Support empty order and implement validated `orderData` expansion; cover removing the last shift-sort key and nonorderable defaults. |
| High | **Sort keys collide with object properties — reproduced.** `_buildIndex` uses `{}` and `value in valueLookup`; sorting the text `constructor` throws when `.push` is called on an inherited function. | Use `Map` or a safe dictionary; cover `constructor`, `toString`, and `__proto__`. |
| High | **Row mutations leave stale indexes/counts — reproduced/source finding.** Removing the first of two rows leaves total/filtered at 2 and results containing an undefined row. Setters rebuild sorting buckets but refresh using the old displayed indexes; addRow increments filtered even for nonmatches. | Recompute the complete local pipeline after mutations; test active search/sort and removal on the final page. |
| High | **Callback failures — reproduced/source finding.** `_renderInfo` passes `text` before its declaration, producing a `ReferenceError` with `infoCallback`. `headerCallback` receives `_head`, which is never assigned. `preDrawCallback` is declared but never called. | Pass the computed info text and real heading node; implement/document pre-draw behavior and assert callback order/arguments. |
| High | **XLSX column names and escaping — reproduced.** `colName(14)` is `AN`, and `colName(26)` is `AZ`, due to `Math.round`. XML escaping replaces only the first occurrence of each character. | Correct base-26 conversion and complete XML escaping/control-character handling; independently parse exported workbooks. |
| High | **XLSX dates and values — reproduced/source finding.** January date input throws after decrementing the year to a number; a March string date returns a nonsensical serial (`739312149306100` for 2024-03-15). Numeric years contradict the implementation's substring calls. Numeric zero/false cells are omitted. The broad time suffix branch precedes datetime branches. | Normalize numeric date parts, retain date plus time, handle Excel's date convention, and preserve zero/boolean cells; assert decoded values and styles. |
| High | **Request/disposal race — source finding.** `_getResultsInit` invokes `getResults` before `Promise.resolve`, so synchronous errors escape. It retains only the normalized promise and leaves the debounce closure uncancelled on disposal. | Catch both throw/reject paths, retain cancellation handles, invalidate late responses, and cancel timers; test disposal before dispatch and during response handling. |
| Medium | **Hidden-column sorting selects the wrong column — source finding.** `events.js` uses the visible DOM sibling index even though headings carry `data-ui-index`. | Read the stable data column index; test click/keyboard sorting after hiding an earlier column. |
| Medium | **Rendering/control mistakes — source finding.** `_renderRow` calls `$.addClass(column.class)` without the cell; length options use `checked` rather than selected state; hide/show does not update `_columnCount`. | Assert cell classes, selected length, and empty-state colspan after visibility changes. |
| Medium | **Paging/empty state problems — source finding.** The constructor uses nonexistent `Number.INFINITY`; `page`/`length` accept invalid values; empty info displays start 1/end 0. Pagination has ARIA disabled state without native `disabled`, and its handler does not reject disabled controls. | Use an explicit unpaged path; normalize inputs; show coherent empty counts; enforce disabled controls and accessible current-page state. |
| Medium | **CSV escaping is incomplete — source finding.** `buttons.js::csv` doubles quotes but encloses a field only when it contains a comma. Quotes/newlines alone therefore produce invalid CSV. | Quote fields containing comma, quote, CR, or LF; parse round-trip exports in tests. Define/document treatment of spreadsheet formula-like values. |
| Medium | **Print/download cleanup and HTML handling — source finding.** `saveBlob` never revokes its object URL. Print interpolates titles into HTML, assumes `window.open` succeeds, and waits a fixed second for styles. Cell values/formatter results are also directly inserted as HTML. | Revoke URLs after download, handle blocked popups, use text titles, await print readiness, and apply the documented sanitization policy. |
| Medium | **Incomplete restoration — source finding.** Disposal restores child markup but leaves added table classes and removes `aria-describedby` without restoring its previous value. | Snapshot and restore original attributes/classes; cover repeat disposal, automatic removal, and reinitialization. |
| Medium | **UI 4 CSS incompatibility — source finding.** Current styles reference `--ui-secondary-color-rgb`, `--ui-primary-rgb`, and `--ui-btn-focus-shadow-rgb`; the current UI source uses color tokens and `--ui-btn-focus-shadow-color`. Filled inputs no longer use `ripple-line`. | Migrate tokens and input markup; assert computed component styles against UI 4. |
| Maintenance | **Package/documentation gaps — verified inventory.** Runtime imports are undeclared, there is no browser test/CI setup, and demos mix UI 2.3.3 and unbounded old GitHub CDN URLs. | Complete packaging, harness, CI, and documentation work before release. |

Additional validation targets, not yet confirmed defects: remote zero-row results with inclusive range utilities; omitted layout controls while their features remain enabled; malformed DOM headings and column-count mismatches; multi-sheet names/XML relationships; shared-string and style references; large/compressed ZIP payloads; callback-triggered disposal; and preservation of useful formatting across display/export/print.

## 10. Delivery sequence and acceptance criteria

1. **Package/build foundation:** add repository configuration, upgrade/sort the manifest, resolve the eligible lockfile, establish lint environments, rename the browser entry, and generate the ESM/UMD/CSS artifacts. Adapt the ESLint browser/node overrides and test globals from SelectMenu. Retain the shared Stylelint configuration.
2. **Harness and compatibility:** add the reference Playwright server/fixtures and initial init/dispose/API tests; refactor into private class members and make UI 4/query 5 initialization work. Introduce regressions alongside fixes rather than asserting existing broken behavior as the desired contract.
3. **Data and lifecycle correctness:** fix filtering/sorting/paging/mutations, callbacks, extension adapters, async cancellation, and restoration. Preserve documented API behavior and record deliberate breaking changes.
4. **Exports and styles:** fix and validate CSV/XLSX/print output and shipped ZIP behavior; update Sass, UI controls, accessibility, RTL, and targeted component style coverage.
5. **Documentation and demos:** complete the README/API migration notes and replace all existing demonstrations with the consolidated showcase, retaining feature parity.
6. **CI and release readiness:** add CI/Codecov/publish files, review coverage, configure external integration prerequisites, rebuild/commit artifacts, and inspect the publishable package.

The migration is complete when:

- `npm ci`, `npm run lint`, `npm run build`, and `npm run lint:sass:unused` succeed with the selected compatible versions; the manifest has been processed with `npx sort-package-json`.
- All Playwright browser projects pass; the reference Node/browser CI matrix passes; generated bundles are reproducible and tracked; `npm pack --dry-run` exposes only the intended package files.
- A temporary consumer can load the package's compiled ESM export and both UMD variants with UI 4/query 5, with no missing peer declarations or duplicate UI/query instances.
- Coverage maps to the actual Tables implementation, includes workbook/ZIP sources, and meets the agreed reference policy without blanket exclusions or weak tests added solely for percentages.
- The high-priority audit findings have regression coverage and fixes; remaining confirmed issues are explicitly resolved or documented as release blockers.
- No prototype composition remains; the full shipped implementation uses the agreed private-state/JSDoc conventions; custom layouts/buttons work through supported interfaces.
- UI 4 styles, keyboard interaction, pagination accessibility, theme-dependent component styling, RTL, and disposal restoration behave as documented.
- README, demo assets, and migration notes describe the final behavior, supported engines, peer versions, output formats, and breaking changes accurately.

At the time of the original audit, the project had no automated test suite. That audit used source/configuration comparison, installed dependency inventory, live npm metadata checks, and focused executions of the existing data/workbook helpers. Subsequent implementation and validation results are recorded in the progress section above.
