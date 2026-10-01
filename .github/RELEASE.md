# Release setup

The workflows target `elusivecodes/FrostUI-Tables` and `@fr0st/ui-tables`.

## External setup

These settings live outside Git. Confirm them with the repository/package owner before the first release:

1. Activate this repository in Codecov and grant its GitHub integration repository access. CI uses `use_oidc: true`, `id-token: write`, and `coverage/lcov.info`; it fails if upload fails. No Codecov token is stored in the repository. See [Codecov OIDC](https://github.com/codecov/codecov-action#using-oidc).
2. In npm package settings, configure a GitHub trusted publisher with owner **elusivecodes**, repository **FrostUI-Tables**, workflow filename **publish.yml**, and no environment name (the workflow does not declare one). Allow direct publishing for this publisher. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/). It requires npm 11.5.1+ and Node 22.14+; publishing uses Node 24 on a GitHub-hosted runner.
3. Ensure GitHub Actions is enabled and required branch checks reflect the five CI matrix jobs. Run CI after these files are pushed; local tests cannot establish GitHub OIDC trust or verify a Codecov upload.

No GitHub release, npm publication, or external account configuration is performed by adding these files. Account-side setup is not inferred from local configuration.

Migration verification on 1 October 2026: the [public Codecov repository API](https://api.codecov.io/api/v2/github/elusivecodes/repos/FrostUI-Tables/) reports `active: false` and `activated: false`. The local npm account check returned `401 Unauthorized`, so trusted-publisher settings could not be verified. These are external prerequisites for a successful first hosted upload/publication.

## Preparing a release

1. Update `package.json` and `package-lock.json` together. Sort the manifest with `npx sort-package-json` on Node 24.
2. Run `npm ci`, `npm run lint`, `npm run build`, `npm run lint:sass:unused`, the browser suite, and source coverage. Review the actual LCOV report against the 95% project target; retain all implementation sources in coverage.
3. Run `npm pack --dry-run`. The package includes README, LICENSE, `dist`, and `src`; it excludes demos, tests, reports, and workflows.
4. Commit generated bundles/maps with source. CI's bundle guard also rejects untracked files in `dist`. Confirm the hosted Node/browser matrix and Codecov upload pass.
5. Publish a GitHub release from that validated commit with tag `v<package version>`. The publish workflow checks the tag/version, rebuilds, tests Chromium, verifies bundles/package contents, then runs `npm publish --provenance`.

README CDN examples for Tables 3 resolve only once version 3 is published. The local demo already uses this checkout's bundles. CDN dependency majors are pinned to UI 4/query 5/core 4 so a future incompatible major does not silently alter the examples.

The action versions follow the UI reference workflows: [checkout v6](https://github.com/actions/checkout/tree/v6), [setup-node v6](https://github.com/actions/setup-node/tree/v6), and [Codecov v7](https://github.com/codecov/codecov-action/tree/v7).
