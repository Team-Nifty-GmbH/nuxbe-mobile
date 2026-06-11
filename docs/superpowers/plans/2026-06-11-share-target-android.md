# Share Target (Android) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nuxbe appears in the Android share sheet / "Open with" for PDFs and images; shared files are cached and handed to the Flux server page `/mobile/share-target` via Capacitor Preferences + Filesystem.

**Architecture:** Intent filters on `MainActivity` receive `ACTION_SEND` / `ACTION_SEND_MULTIPLE` / `ACTION_VIEW`. A new `ShareIntentHandler` copies the files into the app cache (`shared_files/`), writes metadata JSON into the `CapacitorStorage` SharedPreferences (key `pending_shared_files`) plus a one-shot redirect flag (`pending_share_redirect`). Cold start: `app.js` sees the flag and appends `redirect=/mobile/share-target` to the `login-mobile` URL. Warm start (`onNewIntent`, app is on the Flux page): MainActivity navigates the webview directly to `{server}/mobile/share-target`. The Flux page reads the files through the Capacitor Preferences/Filesystem plugins (already injected into the server origin via `patchJSInjection`).

**Tech Stack:** Capacitor 7 wrapper, Java (Android), vanilla JS (`src/app.js`), no test infrastructure in this repo → manual emulator verification per task.

**Spec:** `docs/superpowers/specs/2026-06-11-share-target-design.md`

**Note on TDD:** This repo has no automated test infrastructure (no JUnit setup, no JS test runner). Tasks therefore use compile checks + manual emulator verification instead of failing-test-first. Do not introduce a test framework as a side effect.

---

### Task 1: Android intent filters

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml` (inside the existing `<activity>` block, after the `nuxbe` scheme filter at lines 31-36)

- [ ] **Step 1: Add intent filters**

Insert after the existing `nuxbe://` intent filter (after line 36), before `</activity>`:

```xml
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="application/pdf" />
                <data android:mimeType="image/*" />
            </intent-filter>

            <intent-filter>
                <action android:name="android.intent.action.SEND_MULTIPLE" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="application/pdf" />
                <data android:mimeType="image/*" />
            </intent-filter>

            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:scheme="content" />
                <data android:scheme="file" />
                <data android:mimeType="application/pdf" />
                <data android:mimeType="image/*" />
            </intent-filter>
```

- [ ] **Step 2: Verify the manifest parses by building**

Run: `cd /Users/patrickweh/Projects/team-nifty/nuxbe-mobile/android && ./gradlew assembleDebug -q`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/AndroidManifest.xml
git commit -m "Add share intent filters for PDFs and images"
```

---

### Task 2: ShareIntentHandler

**Files:**
- Create: `android/app/src/main/java/com/teamnifty/nuxbe/ShareIntentHandler.java`

Responsibilities: detect share intents, copy content URIs into the cache, persist metadata for the web layer, clean up stale files. `org.json` is part of the Android SDK — no new dependency.

- [ ] **Step 1: Create the handler class**

```java
package com.teamnifty.nuxbe;

import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Receives files shared into the app (ACTION_SEND / ACTION_SEND_MULTIPLE / ACTION_VIEW),
 * copies them into the cache dir "shared_files/" and stores metadata in the
 * CapacitorStorage SharedPreferences so the Flux web page can read them via the
 * Capacitor Preferences + Filesystem plugins.
 */
public class ShareIntentHandler {

    private static final String TAG = "ShareIntentHandler";
    private static final String CACHE_SUBDIR = "shared_files";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String PREFS_KEY_FILES = "pending_shared_files";
    private static final String PREFS_KEY_REDIRECT = "pending_share_redirect";
    private static final long MAX_AGE_MS = 24L * 60 * 60 * 1000;

    /**
     * Returns true if the intent was a share intent and at least one file was cached.
     */
    public static boolean handleIntent(Context context, Intent intent) {
        if (intent == null) {
            return false;
        }

        List<Uri> uris = extractUris(intent);
        if (uris.isEmpty()) {
            return false;
        }

        File dir = new File(context.getCacheDir(), CACHE_SUBDIR);
        deleteRecursively(dir);
        if (!dir.mkdirs()) {
            Log.w(TAG, "Could not create cache dir: " + dir);
        }

        JSONArray meta = new JSONArray();
        long stamp = System.currentTimeMillis();
        int index = 0;

        for (Uri uri : uris) {
            try {
                String name = resolveDisplayName(context, uri);
                String mimeType = resolveMimeType(context, uri, intent.getType());
                File target = new File(dir, stamp + "_" + index + "_" + sanitize(name));
                long size = copyUriToFile(context, uri, target);

                JSONObject entry = new JSONObject();
                entry.put("name", name);
                entry.put("mimeType", mimeType);
                entry.put("size", size);
                // Path relative to the cache dir, readable via Filesystem plugin (directory: CACHE)
                entry.put("path", CACHE_SUBDIR + "/" + target.getName());
                meta.put(entry);
                index++;
            } catch (Exception e) {
                Log.e(TAG, "Failed to cache shared file: " + uri, e);
            }
        }

        if (meta.length() == 0) {
            return false;
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(PREFS_KEY_FILES, meta.toString())
            .putString(PREFS_KEY_REDIRECT, "1")
            .apply();

        Log.d(TAG, "Cached " + meta.length() + " shared file(s)");
        return true;
    }

    /**
     * Deletes cached shared files older than 24h. Called on app start.
     */
    public static void cleanupOldFiles(Context context) {
        File dir = new File(context.getCacheDir(), CACHE_SUBDIR);
        File[] files = dir.listFiles();
        if (files == null) {
            return;
        }
        long cutoff = System.currentTimeMillis() - MAX_AGE_MS;
        for (File file : files) {
            if (file.lastModified() < cutoff && !file.delete()) {
                Log.w(TAG, "Could not delete stale shared file: " + file);
            }
        }
    }

    private static List<Uri> extractUris(Intent intent) {
        List<Uri> uris = new ArrayList<>();
        String action = intent.getAction();

        if (Intent.ACTION_SEND.equals(action)) {
            Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (uri != null) {
                uris.add(uri);
            }
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<Uri> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) {
                uris.addAll(list);
            }
        } else if (Intent.ACTION_VIEW.equals(action)) {
            Uri data = intent.getData();
            // nuxbe:// deep links also arrive as ACTION_VIEW - only accept file-like URIs
            if (data != null && ("content".equals(data.getScheme()) || "file".equals(data.getScheme()))) {
                uris.add(data);
            }
        }

        return uris;
    }

    private static String resolveDisplayName(Context context, Uri uri) {
        if ("content".equals(uri.getScheme())) {
            try (Cursor cursor = context.getContentResolver()
                    .query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    String name = cursor.getString(0);
                    if (name != null && !name.isEmpty()) {
                        return name;
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Could not resolve display name for " + uri, e);
            }
        }
        String segment = uri.getLastPathSegment();
        return segment != null ? segment : "shared_file";
    }

    private static String resolveMimeType(Context context, Uri uri, String intentType) {
        ContentResolver resolver = context.getContentResolver();
        String type = resolver.getType(uri);
        if (type != null) {
            return type;
        }
        if (intentType != null && !intentType.contains("*")) {
            return intentType;
        }
        return "application/octet-stream";
    }

    private static long copyUriToFile(Context context, Uri uri, File target) throws Exception {
        long total = 0;
        try (InputStream in = context.getContentResolver().openInputStream(uri);
             OutputStream out = new FileOutputStream(target)) {
            if (in == null) {
                throw new IllegalStateException("Could not open input stream for " + uri);
            }
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
                total += read;
            }
        }
        return total;
    }

    private static String sanitize(String name) {
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private static void deleteRecursively(File dir) {
        File[] files = dir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (!file.delete()) {
                    Log.w(TAG, "Could not delete: " + file);
                }
            }
        }
    }
}
```

- [ ] **Step 2: Compile**

Run: `cd /Users/patrickweh/Projects/team-nifty/nuxbe-mobile/android && ./gradlew assembleDebug -q`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/teamnifty/nuxbe/ShareIntentHandler.java
git commit -m "Add ShareIntentHandler for incoming share intents"
```

---

### Task 3: Wire MainActivity

**Files:**
- Modify: `android/app/src/main/java/com/teamnifty/nuxbe/MainActivity.java`

- [ ] **Step 1: Add import and onCreate wiring**

Add to the imports (after `import android.webkit.WebView;`):

```java
import android.content.Intent;
```

In `onCreate` (currently lines 27-35), add the two handler calls after `setupPullToRefresh();`:

```java
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        patchJSInjection();
        setupPullToRefresh();

        ShareIntentHandler.cleanupOldFiles(this);
        ShareIntentHandler.handleIntent(this, getIntent());

        // Ensure the system handles the status bar - content below it
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
```

- [ ] **Step 2: Add onNewIntent override**

Add this method after `onCreate` (the activity uses `launchMode="singleTask"`, so a share while the app is running arrives here; the webview is on the remote Flux page at that point):

```java
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);

        if (ShareIntentHandler.handleIntent(this, intent)) {
            String serverUrl = getSavedServerUrl();
            if (serverUrl != null && !serverUrl.isEmpty()) {
                String target = serverUrl + "/mobile/share-target";
                WebView webView = bridge.getWebView();
                webView.post(() -> webView.loadUrl(target));
            }
        }
    }
```

- [ ] **Step 3: Compile**

Run: `cd /Users/patrickweh/Projects/team-nifty/nuxbe-mobile/android && ./gradlew assembleDebug -q`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/teamnifty/nuxbe/MainActivity.java
git commit -m "Handle share intents in MainActivity"
```

---

### Task 4: Cold-start redirect in app.js

**Files:**
- Modify: `src/app.js` (in `showWebView()`, after the `deepLinkTarget` handling around lines 741-755)

- [ ] **Step 1: Add the share redirect check**

In `showWebView()`, the existing code picks `finalDeepLinkPath` from `pending_deep_link_*` or `deep_link_target`. Extend it: after the `else if (deepLinkTarget)` block, add the one-shot share redirect (push deep links win over share redirects if both are pending):

```javascript
        // Use pending path from MainActivity if available, otherwise use deep_link_target
        let finalDeepLinkPath = null;
        if (pendingUrl && pendingPath) {
            // Update server URL if notification was for a different server
            if (pendingUrl !== this.serverUrl) {
                this.serverUrl = pendingUrl;
                await this.saveServerUrl(pendingUrl);
            }
            finalDeepLinkPath = pendingPath;
            // Clear MainActivity preferences
            await Preferences.remove({ key: 'pending_deep_link_url' });
            await Preferences.remove({ key: 'pending_deep_link_path' });
        } else if (deepLinkTarget) {
            finalDeepLinkPath = deepLinkTarget;
        }

        // One-shot redirect set by ShareIntentHandler when files were shared into the app.
        // The shared files themselves stay in pending_shared_files until the Flux page clears them.
        if (!finalDeepLinkPath) {
            const { value: shareRedirect } = await Preferences.get({ key: 'pending_share_redirect' });
            if (shareRedirect === '1') {
                finalDeepLinkPath = '/mobile/share-target';
                await Preferences.remove({ key: 'pending_share_redirect' });
            }
        }
```

- [ ] **Step 2: Build the web assets**

Run: `cd /Users/patrickweh/Projects/team-nifty/nuxbe-mobile && npm run build`
Expected: vite build succeeds, no errors

- [ ] **Step 3: Commit**

```bash
git add src/app.js
git commit -m "Redirect to share-target page after receiving shared files"
```

---

### Task 5: Document the bridge contract for the Flux side

**Files:**
- Modify: `FLUX_INTEGRATION.md` (append a new section at the end)

- [ ] **Step 1: Append the section**

```markdown
## Share Target (geteilte Dateien empfangen)

Wenn der Anwender Dateien (PDF, Bilder) in die App teilt, legt die App sie im
Cache ab und navigiert zu `{server}/mobile/share-target`. Die Flux-Seite liest
die Dateien direkt über die Capacitor-Plugins (Preferences + Filesystem), die
auf der Server-Origin injiziert sind.

### Metadaten lesen

```javascript
const { Preferences } = Capacitor.Plugins;
const { Filesystem } = Capacitor.Plugins;

const { value } = await Preferences.get({ key: 'pending_shared_files' });
const files = value ? JSON.parse(value) : [];
// [{ name: 'rechnung.pdf', mimeType: 'application/pdf', size: 12345, path: 'shared_files/1718000000000_0_rechnung.pdf' }]
```

### Dateiinhalt lesen (base64)

```javascript
const { data } = await Filesystem.readFile({
    path: file.path,
    directory: 'CACHE'
});
// data ist base64-encoded
```

### Nach erfolgreicher Aktion aufräumen

```javascript
await Preferences.remove({ key: 'pending_shared_files' });
await Filesystem.rmdir({
    path: 'shared_files',
    directory: 'CACHE',
    recursive: true
});
```

### Verhalten

- `pending_share_redirect` ist ein One-Shot-Flag, das die App selbst konsumiert -
  die Flux-Seite muss es nicht beachten.
- Bricht der Anwender ab, bleiben die Dateien liegen; der nächste Share
  überschreibt sie, die App löscht Dateien älter als 24h beim Start.
- Empfohlene Größenprüfung serverseitig: ~20 MB pro Datei (base64-Overhead beachten).
```

- [ ] **Step 2: Commit**

```bash
git add FLUX_INTEGRATION.md
git commit -m "Document share target bridge contract"
```

---

### Task 6: Emulator verification

**Files:** none (manual verification)

- [ ] **Step 1: Build and install**

```bash
cd /Users/patrickweh/Projects/team-nifty/nuxbe-mobile
npm run build:android
cd android && ./gradlew installDebug
```

Expected: app installed on a running emulator/device.

- [ ] **Step 2: Push a test PDF**

```bash
adb shell am start -a android.intent.action.VIEW -d "https://example.com" >/dev/null 2>&1 || true
adb push ~/Downloads/test.pdf /sdcard/Download/test.pdf
```

(Any small PDF works; create one if needed.)

- [ ] **Step 3: Cold-start share**

1. Swipe the Nuxbe app away (kill it).
2. Open the Files app on the emulator → Downloads → long-press `test.pdf` → Share → Nuxbe must appear → tap it.
3. Expected: app starts, connects to the saved server, lands on `{server}/mobile/share-target` (404 is OK while the Flux side doesn't exist yet — the URL in any error page proves the redirect worked).

Verify the preferences were written:

```bash
adb shell "run-as com.teamnifty.nuxbe cat /data/data/com.teamnifty.nuxbe/shared_prefs/CapacitorStorage.xml" | grep -o 'pending_shared_files[^<]*'
```

Expected: an entry containing `shared_files/..._test.pdf`.

- [ ] **Step 4: Warm share**

1. With the app open on the Flux page, switch to Files and share `test.pdf` to Nuxbe again.
2. Expected: app comes to foreground and the webview navigates to `/mobile/share-target` directly (no app restart, session intact).

- [ ] **Step 5: Image + multi-share**

1. Save two images to the gallery/Downloads.
2. Select both → Share → Nuxbe.
3. Expected: `pending_shared_files` contains two entries with `image/*` MIME types.

- [ ] **Step 6: Regression: deep links still work**

```bash
adb shell am start -a android.intent.action.VIEW -d "nuxbe://open?server=https://demo.example.com\&path=/"
```

Expected: app opens, no shared-files entry created (ShareIntentHandler must ignore the `nuxbe` scheme).
