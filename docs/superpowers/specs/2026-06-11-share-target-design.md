# Share Target / Intent Actions — Design

**Date:** 2026-06-11
**Status:** Approved
**Scope:** nuxbe-mobile (this repo) + flux-erp core (separate PR)

## Goal

Users can share or open files (PDFs, images) from other apps (Mail, Files, Photos, file managers) into the Nuxbe app. The app hands the files to the connected Flux ERP server, where the user picks an action. First action: upload as purchase invoice (Eingangsrechnung). The mechanism is generic — the app knows nothing about purchase invoices; more actions follow later.

## Architecture Overview

The app is a Capacitor wrapper that fully navigates the webview to the remote Flux server after setup (`window.location.replace`). Local `app.js` is not running while the user works in Flux. The Capacitor runtime is injected into the remote page (`allowNavigation: ['*']`, `nuxbe-bridge.js` served by Flux), so the Flux page can use Capacitor plugins (Preferences, Filesystem) directly — same pattern as push deep links today.

Flow:

1. User shares a PDF/image → picks Nuxbe.
2. Native layer copies the file(s) into the app cache (`shared_files/`) and writes a metadata JSON to Capacitor Preferences under `pending_shared_files`.
3. App navigates the webview to `{server}/mobile/share-target` (via the existing `login-mobile?redirect=` flow on cold start, or directly via `loadUrl` when the app is already running).
4. The Flux page reads the files through the bridge, shows a preview and a list of registered actions.
5. The chosen action runs server-side with the normal webview session — no extra auth.
6. The page clears the pending files.

## App Side (this repo)

### Android

- `AndroidManifest.xml`: intent filters on `MainActivity` for `ACTION_SEND` / `ACTION_SEND_MULTIPLE` with `*/*` (the action registry on the Flux side filters via `accepts(mimeType)` — a manifest change needs an app release, a registry change only a server deploy; covers future cases like ZUGFeRD XML, CSV bank statements, vCards, EML) and `ACTION_VIEW` restricted to `application/pdf` / `image/*` (so Android does not offer Nuxbe as an opener for every file type).
- `MainActivity.java`: handle the intent (same pattern as the existing push deep-link handling):
  - Resolve content URIs, copy each file into the app cache directory `shared_files/`.
  - Write metadata JSON (`[{ path, name, mimeType, size }]`) to Capacitor Preferences key `pending_shared_files`.
  - Cold start: existing flow — `app.js` detects `pending_shared_files` and sets `redirect=/mobile/share-target` on the `login-mobile` URL.
  - App already running on the Flux page (`onNewIntent`): cache the file, then navigate the webview via `loadUrl` to `{server}/mobile/share-target` (cookies/session stay intact).

### iOS

Two phases:

- **Phase 1 (this design):** declare `CFBundleDocumentTypes` / `UTImportedTypeDeclarations` in `Info.plist` so "Open in Nuxbe" appears for PDFs in Files/Mail. The file arrives via `application(_:open:)` → same cache + Preferences pattern as Android.
- **Phase 2 (separate, later):** a Share Extension target with an App Group, required so Nuxbe appears when sharing photos from the Photos app. Separate effort (own target, provisioning).

### Cold-start handling in `app.js`

On startup, check `pending_shared_files` (analogous to `pending_deep_link_url`/`pending_deep_link_path`). If present, append `redirect=/mobile/share-target` to the `login-mobile` URL.

### Bridge contract

`nuxbe-bridge.js` (served by Flux) reads everything via Capacitor plugins directly; no local JS needs to be alive. Exposed functions:

```javascript
await window.nativeBridge.getSharedFiles()
// → [{ name, mimeType, size, base64 }] | []

await window.nativeBridge.clearSharedFiles()
// removes cached files + clears the Preferences key
```

Files are read from the cache via the Filesystem plugin and returned base64-encoded.

## Flux Side (flux-erp core, separate PR)

- Route `GET /mobile/share-target` behind the auth middleware.
- Livewire component `ShareTarget`: reads files via the bridge, shows previews (thumbnail for images, PDF icon, name, size) and the list of registered actions.
- Action registry: `ShareTargetAction` classes registered via a ServiceProvider event (same pattern as custom tabs). Each action declares:
  - `label`, `icon`
  - `supportsMultiple(): bool`
  - `accepts(string $mimeType): bool`
  - `handle(array $files)`
- Multi-file behavior: the picker is shown once for all files together. An action with `supportsMultiple = false` is disabled when multiple files are shared (or can be run per file).
- First action: **Upload purchase invoice** — creates one purchase invoice per file with the file attached as media, then redirects to the purchase invoice list with a success toast.
- After a successful action, the page calls `clearSharedFiles()`.

## Error Handling

- Not logged in: `login-mobile` handles it; the redirect survives the login.
- File too large: limit ~20 MB per file (mind the base64 overhead); show an error in the picker.
- Old Flux version without the route: webview shows the Flux 404. Acceptable; the app does not version-check.
- User aborts / picks no action: cached files stay and are overwritten by the next share. App start cleans up cached shared files older than 24 h.

## Testing

- Android: emulator — share a PDF from the Files app; cover both cold start and app-already-running.
- iOS: simulator — "Open in Nuxbe" from the Files app.
- Flux side: Pest tests for the action registry + Livewire smoke test for `ShareTarget`, bridge mocked.

## Build Order

1. App side, Android (intent filters, MainActivity, app.js cold-start check)
2. Flux side: route, `ShareTarget` component, action registry, purchase invoice action
3. iOS Phase 1 (document types)
4. iOS Phase 2 (Share Extension) — later, separate design
