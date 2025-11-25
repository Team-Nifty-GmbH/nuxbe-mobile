package com.teamnifty.nuxbe;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.view.WindowCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;

import java.lang.reflect.Method;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        patchJSInjection();

        // Ensure the system handles the status bar - content below it
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }

    private void createNotificationChannel() {
        // Create notification channel for Android 8.0+ (API 26+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            String channelId = "nuxbe_default_channel";
            CharSequence channelName = "Nuxbe Notifications";
            String channelDescription = "Default channel for Nuxbe push notifications";
            int importance = NotificationManager.IMPORTANCE_HIGH;

            NotificationChannel channel = new NotificationChannel(channelId, channelName, importance);
            channel.setDescription(channelDescription);
            channel.enableVibration(true);
            channel.enableLights(true);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }

    private void patchJSInjection() {
        try {
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                Method getJsInjector = bridge.getClass().getDeclaredMethod("getJSInjector");
                getJsInjector.setAccessible(true);
                Object injector = getJsInjector.invoke(bridge);

                assert injector != null;
                Method getScriptString = injector.getClass().getDeclaredMethod("getScriptString");
                String scriptString = (String) getScriptString.invoke(injector);

                Set<String> allowedOrigins = new HashSet<>();
                // Add origins that the Capacitor JS Bridge should be injected into
                // Note: Only HTTP(S) origins are valid, custom schemes like capacitor:// are not supported
                allowedOrigins.add("https://localhost");
                allowedOrigins.add("http://localhost");

                // Get saved server URL from Capacitor Preferences
                String savedServerUrl = getSavedServerUrl();
                if (savedServerUrl != null && !savedServerUrl.isEmpty()) {
                    try {
                        // Extract origin from URL (protocol + host + port)
                        URL url = new URL(savedServerUrl);
                        String origin = url.getProtocol() + "://" + url.getHost();
                        if (url.getPort() != -1 && url.getPort() != url.getDefaultPort()) {
                            origin += ":" + url.getPort();
                        }
                        allowedOrigins.add(origin);
                        Log.d("MainActivity", "Added saved server origin: " + origin);
                    } catch (Exception e) {
                        Log.w("MainActivity", "Could not parse saved server URL: " + savedServerUrl, e);
                    }
                }

                assert scriptString != null;
                WebViewCompat.addDocumentStartJavaScript(bridge.getWebView(), scriptString, allowedOrigins);

                Log.d("MainActivity", "JS Injection patched for origins: " + allowedOrigins);
            }
        } catch (Exception e) {
            Log.e("MainActivity", "Error patching JS injection: " + (e.getMessage() != null ? e.getMessage() : ""), e);
        }
    }

    private String getSavedServerUrl() {
        try {
            // Capacitor stores preferences in SharedPreferences
            SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
            String savedUrl = prefs.getString("server_url", null);
            Log.d("MainActivity", "Reading saved server URL from SharedPreferences: " + savedUrl);
            return savedUrl;
        } catch (Exception e) {
            Log.w("MainActivity", "Could not read saved server URL from preferences", e);
            return null;
        }
    }
}
