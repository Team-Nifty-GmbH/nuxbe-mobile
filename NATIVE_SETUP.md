# Native Projekt Setup Guide

Diese Anleitung erklärt wie du die iOS und Android Projekte einrichtest und die Firebase Config-Dateien integrierst.

## 📋 Voraussetzungen

- Node.js & npm installiert
- Dependencies installiert (`npm install`)
- Firebase Config-Dateien vorhanden:
  - `GoogleService-Info.plist` (iOS)
  - `google-services.json` (Android)

## 🍎 iOS Setup

### 1. Native iOS Projekt erstellen

```bash
npm run build
npx cap add ios
```

Dies erstellt den `ios/` Ordner mit dem Xcode Projekt.

### 2. Firebase Config integrieren

```bash
# GoogleService-Info.plist in iOS Projekt kopieren
cp GoogleService-Info.plist ios/App/App/
```

### 3. Xcode Projekt öffnen

```bash
npm run open:ios
```

### 4. Firebase Config in Xcode hinzufügen

1. In Xcode: Linke Sidebar → `App` Ordner
2. Rechtsklick auf `App` → **Add Files to "App"...**
3. Wähle `GoogleService-Info.plist` aus
4. ✅ **Copy items if needed** aktivieren
5. ✅ **Add to targets: App** aktivieren
6. Klicke **Add**

### 5. Permissions konfigurieren

Die `Info.plist` benötigt folgende Permissions:

```xml
<key>NSCameraUsageDescription</key>
<string>Nuxbe benötigt Zugriff auf die Kamera um Fotos aufzunehmen und Dokumente zu scannen.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Nuxbe benötigt Zugriff auf deine Fotos um Dokumente hochzuladen.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>Nuxbe benötigt deinen Standort für Lieferungen (optional).</string>
```

Füge diese in Xcode hinzu:
1. Wähle `App` Target
2. Tab **Info**
3. Klicke **+** bei "Custom iOS Target Properties"
4. Füge die Keys hinzu

### 6. Capabilities aktivieren

1. Wähle `App` Target
2. Tab **Signing & Capabilities**
3. Klicke **+ Capability**
4. Füge hinzu:
   - **Push Notifications**
   - **Background Modes** → ✅ Remote notifications

### 7. Build & Run

```bash
# In Xcode
# 1. Wähle ein Simulator Device (z.B. iPhone 15)
# 2. Drücke ⌘R oder klicke Play
```

## 🤖 Android Setup

### 1. Native Android Projekt erstellen

```bash
npm run build
npx cap add android
```

Dies erstellt den `android/` Ordner mit dem Android Studio Projekt.

### 2. Firebase Config integrieren

```bash
# google-services.json in Android Projekt kopieren
cp google-services.json android/app/
```

### 3. Google Services Plugin hinzufügen

Die `android/build.gradle` sollte bereits folgendes enthalten:

```gradle
buildscript {
    dependencies {
        // ... andere Dependencies
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

Die `android/app/build.gradle` sollte am Ende enthalten:

```gradle
apply plugin: 'com.google.gms.google-services'
```

### 4. Permissions konfigurieren

Die `AndroidManifest.xml` benötigt folgende Permissions:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

Diese sind meist schon durch Capacitor hinzugefügt.

### 5. Android Studio öffnen

```bash
npm run open:android
```

### 6. Gradle Sync

1. Android Studio öffnet das Projekt
2. Warte bis Gradle Sync fertig ist
3. Falls Fehler: **File** → **Sync Project with Gradle Files**

### 7. Build & Run

```bash
# In Android Studio
# 1. Wähle ein Emulator Device (z.B. Pixel 6)
# 2. Klicke Run (grüner Play Button)
```

## 🔄 Sync Workflow

Nach Code-Änderungen:

```bash
# 1. Build
npm run build

# 2. Sync zu Native Projekten
npm run sync

# oder einzeln:
npm run sync:ios
npm run sync:android

# 3. Öffne in IDE und teste
npm run open:ios
npm run open:android
```

## 🧪 Testing

### iOS Simulator

```bash
# Build & Sync
npm run build && npm run sync:ios

# In Xcode: Run (⌘R)
```

### Android Emulator

```bash
# Build & Sync
npm run build && npm run sync:android

# In Android Studio: Run
```

### Live Reload (Development)

```bash
# Terminal 1: Vite Dev Server
npm run dev

# Terminal 2: Xcode/Android Studio
# Ändere in capacitor.config.json:
"server": {
  "url": "http://localhost:3000",
  "cleartext": true
}

# Dann in Xcode/Android Studio: Run
```

## 📱 Device Testing

### iOS Real Device

1. Apple Developer Account benötigt
2. In Xcode: **Signing & Capabilities**
3. Team auswählen
4. Device per USB verbinden
5. Device in Xcode auswählen
6. Run (⌘R)

### Android Real Device

1. USB Debugging aktivieren:
   - Settings → About Phone
   - 7x auf "Build Number" tippen
   - Settings → Developer Options
   - ✅ USB Debugging
2. Device per USB verbinden
3. In Android Studio: Device auswählen
4. Run

## 🔧 Troubleshooting

### iOS: "GoogleService-Info.plist not found"

**Lösung:**
1. Prüfe ob Datei in `ios/App/App/` existiert
2. In Xcode: File Inspector → Target Membership → ✅ App

### iOS: Push Notifications nicht empfangen

**Lösung:**
1. Prüfe Capabilities → Push Notifications aktiviert
2. Prüfe APNs Key in Firebase Console
3. Real Device benötigt (Simulator unterstützt kein Push)

### Android: "google-services.json not found"

**Lösung:**
1. Prüfe ob Datei in `android/app/` existiert
2. Gradle Sync durchführen
3. Clean Project: Build → Clean Project

### Android: Build Fehler "Duplicate class"

**Lösung:**
```bash
cd android
./gradlew clean
cd ..
npm run sync:android
```

### "Failed to resolve: com.google.firebase"

**Lösung:**
Füge in `android/build.gradle` hinzu:

```gradle
allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
```

## 📦 Plugins & Dependencies

### Capacitor Plugins

Die folgenden Plugins sind bereits in `package.json`:

- `@capacitor/core` - Core Framework
- `@capacitor/ios` - iOS Platform
- `@capacitor/android` - Android Platform
- `@capacitor/camera` - Camera API
- `@capacitor/push-notifications` - FCM Push
- `@capacitor/preferences` - Storage API
- `@capacitor/geolocation` - Location API
- `@capacitor/filesystem` - File API
- `@capacitor/share` - Share API
- `@capacitor-mlkit/barcode-scanning` - Barcode Scanner
- `capacitor-document-scanner` - Document Scanner

### Native Dependencies Update

```bash
# iOS Pods updaten
cd ios/App
pod update
cd ../..

# Android Gradle updaten
cd android
./gradlew clean build
cd ..
```

## 🚀 Production Build

### iOS App Store

1. Archive in Xcode: **Product** → **Archive**
2. Distribute App
3. App Store Connect
4. Upload
5. TestFlight Beta Testing
6. Submit for Review

### Google Play Store

1. Generate Signed Bundle: **Build** → **Generate Signed Bundle**
2. Keystore erstellen (einmalig)
3. Release Bundle (.aab) erstellen
4. Upload zu Google Play Console
5. Internal Testing → Production

## 📚 Weitere Ressourcen

- [Capacitor iOS Setup](https://capacitorjs.com/docs/ios)
- [Capacitor Android Setup](https://capacitorjs.com/docs/android)
- [Firebase iOS Setup](https://firebase.google.com/docs/ios/setup)
- [Firebase Android Setup](https://firebase.google.com/docs/android/setup)
