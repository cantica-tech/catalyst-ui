# Catalyst Studio on the desktop: building and signing

The desktop app (`packages/catalyst-host-electron`) ships for macOS, Windows and Linux. The `Desktop` workflow
(`.github/workflows/desktop.yml`) builds it on each operating system when a release is published and attaches the
files to that release; run by hand, it keeps them as the run's artifacts. Each platform is signed only once its
credentials are set up below; until then it is built unsigned and the run says so.

| Platform             | Files                   | Signing                                         |
| -------------------- | ----------------------- | ----------------------------------------------- |
| macOS (arm64, x64)   | `.dmg`, `.zip`          | Developer ID certificate and Apple notarization |
| Windows (x64, arm64) | `.exe` (NSIS installer) | Azure Artifact Signing                          |
| Linux (x64, arm64)   | `.AppImage`, `.deb`     | none                                            |

The app runs `catalyst serve --local` as its sidecar. It uses the machine's `catalyst` when there is one
(`CATALYST_BIN`, `~/.catalyst/bin/catalyst`, or `catalyst` on the `PATH`); otherwise it runs its own copy, the
`catalyst.pyz` of the kernel named in `packages/catalyst-host-electron/catalyst-version.txt`, which the `Desktop`
workflow downloads from the public distribution repository (`cantica-tech/cantica-tech`). That copy needs Python 3.11
or later on the `PATH` (macOS's own `python3` is 3.9); without one, the app says what to install. Raise
`catalyst-version.txt` once a kernel release is published there (0.104.1 since UI 0.59.0).

## Building locally

```sh
npm ci
npx tsc --build
npm run build --workspace catalyst-studio
cd packages/catalyst-host-electron
npm run bundle
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac dir   # or --win, --linux; drop `dir` for installers
```

The files land in `packages/catalyst-host-electron/release/`. In a VS Code terminal, unset `ELECTRON_RUN_AS_NODE`
before starting the built app, or it runs as plain Node.

## Windows: Azure Artifact Signing

1. An Artifact Signing (formerly Trusted Signing) account; note its **name** and its region's **endpoint**
   (for example `https://weu.codesigning.azure.net/`).
2. CanticaTech's **identity validation** completed in it, then a **public-trust certificate profile**; note its
   **name**.
3. An app registration with a **federated credential for GitHub Actions**: organization `cantica-tech`,
   repository `catalyst-ui`, entity type _Environment_, environment `release`. No client secret.
4. Give that app the **Artifact Signing Certificate Profile Signer** role (named Trusted Signing Certificate
   Profile Signer before the service was renamed) on the account, or on the profile.
5. In the repository's settings, environment `release`, set these **variables** (none is a secret):

| Variable                    | Value                                        |
| --------------------------- | -------------------------------------------- |
| `AZURE_TENANT_ID`           | the directory (tenant) ID                    |
| `AZURE_CLIENT_ID`           | the app registration's client ID             |
| `AZURE_SUBSCRIPTION_ID`     | the subscription holding the signing account |
| `ARTIFACT_SIGNING_ENDPOINT` | the account's endpoint                       |
| `ARTIFACT_SIGNING_ACCOUNT`  | the account's name                           |
| `ARTIFACT_SIGNING_PROFILE`  | the certificate profile's name               |

The installers are signed after they are built; the application inside an installer is not signed separately yet.

## macOS: Developer ID and notarization

1. An Apple Developer account in CanticaTech's name.
2. A **Developer ID Application** certificate, exported with its key as a `.p12` and a password.
3. An **App Store Connect API key** for notarization: its `.p8` file, key ID and issuer ID.
4. In environment `release`: **secrets** `MAC_CERTIFICATE_P12` (the `.p12`, base64-encoded:
   `base64 -i cert.p12 | pbcopy`), `MAC_CERTIFICATE_PASSWORD`, `APPLE_API_KEY_P8` (the `.p8`'s text); **variables**
   `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`.

## Linux

Nothing to set up. The `.deb` names its maintainer as "CanticaTech" without an address: `linux.maintainer` in
`electron-builder.yml` takes `CanticaTech <address>` once the organization names a public one.

## Not yet

- **Auto-update**: no update feed is configured (`publish: null`). It waits on the choice between Azure Blob
  Storage and GitHub Releases.
- **The app icon** is the catalyst logo rendered at 1024 px, until the brand work (R6.21) gives one.
