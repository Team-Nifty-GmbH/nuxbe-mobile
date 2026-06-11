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
        deleteContents(dir);
        if (!dir.exists() && !dir.mkdirs()) {
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

    private static void deleteContents(File dir) {
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
