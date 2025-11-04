# Firebase Setup für Nuxbe Mobile

Detaillierte Anleitung für die Firebase-Integration in iOS und Android.

## 📋 Übersicht

Firebase wird für Push Notifications (FCM) verwendet. Die Initialisierung erfolgt unterschiedlich:

- **iOS**: Automatisch via `GoogleService-Info.plist` + CocoaPods
- **Android**: Automatisch via `google-services.json` + Gradle Plugin
- **Web**: Firebase SDK (optional, nur für Web-Testing)

## 🔥 Firebase Projekt Setup

### 1. Firebase Projekt erstellen

1. Gehe zu [Firebase Console](https://console.firebase.google.com/)
2. Klicke **Add project**
3. Projekt Name: `flux-erp-mobile` (oder dein Name)
4. Google Analytics: Optional
5. Klicke **Create project**

### 2. Cloud Messaging aktivieren

1. In Firebase Console: Dein Projekt öffnen
2. Linkes Menu: **Build** → **Cloud Messaging**
3. Klicke **Get Started** (falls noch nicht aktiviert)

## 🍎 iOS Firebase Setup

### 1. iOS App zu Firebase hinzufügen

1. Firebase Console → **Project Overview** → **Add app** → **iOS**
2. Konfiguration:
   - **Bundle ID**: `com.teamnifty.nuxbe`
   - **App nickname**: `Nuxbe iOS`
   - **App Store ID**: (leer lassen für Development)
3. Klicke **Register app**

### 2. GoogleService-Info.plist herunterladen

1. Download `GoogleService-Info.plist`
2. Speichere im Projekt Root: `nuxbe-mobile/GoogleService-Info.plist`

**Wichtig**: Die Datei ist bereits im Repo vorhanden. Nur ersetzen wenn du ein neues Firebase-Projekt erstellst!

### 3. Firebase SDK zu iOS Projekt hinzufügen

Die `ios/App/Podfile` sollte Firebase Pods enthalten:

```ruby
platform :ios, '13.0'
use_frameworks!

target 'App' do
  capacitor_pods

  # Firebase Pods
  pod 'Firebase/Messaging'
  pod 'FirebaseCore'
end
```

**Pods installieren:**

```bash
cd ios/App
pod install
cd ../..
```

### 4. AppDelegate konfigurieren

Die `ios/App/App/AppDelegate.swift` muss Firebase initialisieren:

```swift
import UIKit
import Capacitor
import Firebase

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Firebase initialisieren
        FirebaseApp.configure()

        return true
    }

    // ... rest of the file
}
```

### 5. APNs Authentication Key einrichten

Für Push Notifications auf iOS benötigst du einen APNs Key:

#### Apple Developer Portal:

1. Gehe zu [Apple Developer](https://developer.apple.com/account/)
2. **Certificates, Identifiers & Profiles**
3. **Keys** → **+** (neuer Key)
4. Name: `Nuxbe APNs Key`
5. ✅ **Apple Push Notifications service (APNs)**
6. **Continue** → **Register**
7. **Download** den `.p8` Key (nur einmal downloadbar!)
8. Notiere: **Key ID** und **Team ID**

#### Firebase Console:

1. Firebase Console → **Project Settings** → **Cloud Messaging**
2. **Apple app configuration**
3. **APNs Authentication Key**
4. Upload `.p8` File
5. Gib **Key ID** und **Team ID** ein
6. **Upload**

### 6. iOS Capabilities aktivieren

In Xcode:

1. Wähle Target **App**
2. Tab **Signing & Capabilities**
3. Klicke **+ Capability**
4. Füge hinzu:
   - ✅ **Push Notifications**
   - ✅ **Background Modes** → Remote notifications

## 🤖 Android Firebase Setup

### 1. Android App zu Firebase hinzufügen

1. Firebase Console → **Project Overview** → **Add app** → **Android**
2. Konfiguration:
   - **Package name**: `com.teamnifty.nuxbe`
   - **App nickname**: `Nuxbe Android`
   - **SHA-1 certificate**: (optional für Development)
3. Klicke **Register app**

### 2. google-services.json herunterladen

1. Download `google-services.json`
2. Speichere im Projekt Root: `nuxbe-mobile/google-services.json`

**Wichtig**: Die Datei ist bereits im Repo vorhanden. Nur ersetzen wenn du ein neues Firebase-Projekt erstellst!

### 3. Firebase SDK zu Android Projekt hinzufügen

#### android/build.gradle

```gradle
buildscript {
    dependencies {
        classpath 'com.android.tools.build:gradle:8.0.0'
        classpath 'com.google.gms:google-services:4.4.0'  // Firebase
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
```

#### android/app/build.gradle

Am **Ende** der Datei:

```gradle
apply plugin: 'com.android.application'
apply plugin: 'com.google.gms.google-services'  // Firebase - ganz am Ende!
```

Dependencies hinzufügen:

```gradle
dependencies {
    implementation 'com.google.firebase:firebase-messaging:23.4.0'
    implementation platform('com.google.firebase:firebase-bom:32.7.0')

    // ... andere dependencies
}
```

### 4. AndroidManifest.xml konfigurieren

Die `android/app/src/main/AndroidManifest.xml` sollte enthalten:

```xml
<manifest>
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application>
        <!-- Firebase Cloud Messaging Service -->
        <service
            android:name="com.google.firebase.messaging.FirebaseMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

        <!-- ... rest -->
    </application>
</manifest>
```

### 5. Gradle Sync

```bash
cd android
./gradlew clean build
cd ..
```

## 🌐 Web Firebase Setup (Optional)

Für Web-Testing kannst du optional Firebase für den Browser einrichten:

### 1. Web App zu Firebase hinzufügen

1. Firebase Console → **Add app** → **Web** (</>)
2. App nickname: `Nuxbe Web`
3. ✅ **Firebase Hosting** (optional)
4. **Register app**

### 2. Firebase Config kopieren

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

### 3. Firebase in Web App initialisieren

In `src/app.js` (nur für Web):

```javascript
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';

// Nur im Web-Browser initialisieren
if (!Capacitor.isNativePlatform()) {
    const firebaseConfig = {
        // Deine Config hier
    };

    const app = initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    // Web Push Token holen
    getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' })
        .then((token) => {
            console.log('FCM Web Token:', token);
        });
}
```

**WICHTIG**: Dies ist NUR für Web-Testing. Native Apps brauchen das NICHT!

## ✅ Verifizierung

### Test ob Firebase initialisiert ist

#### iOS (Xcode Console):

Nach App-Start solltest du sehen:
```
[Firebase/Core][I-COR000003] The default Firebase app has been configured.
```

#### Android (Logcat):

```
I/FirebaseApp: Device unlocked: initializing all Firebase APIs for app [DEFAULT]
```

### Test Push Notifications

1. App auf Device installieren
2. App öffnen → Device Token sollte registriert werden
3. Firebase Console → **Cloud Messaging** → **Send test message**
4. FCM Token eingeben (aus Console Log)
5. **Test** klicken

## 🔧 Troubleshooting

### iOS: "FirebaseApp.configure() not called"

**Lösung**: Prüfe ob `AppDelegate.swift` Firebase importiert und konfiguriert

### iOS: Push kommen nicht an

**Lösung**:
- APNs Key in Firebase Console hochgeladen?
- Push Notifications Capability aktiviert?
- Auf echtem Device testen (Simulator unterstützt kein Push)

### Android: "Default FirebaseApp is not initialized"

**Lösung**:
- `google-services.json` in `android/app/` vorhanden?
- `apply plugin: 'com.google.gms.google-services'` am Ende von `build.gradle`?
- Gradle Sync durchführen

### Android: Build Error "Duplicate class"

**Lösung**:
```bash
cd android
./gradlew clean
./gradlew build
cd ..
```

## 📊 Firebase Console Monitoring

Nach Deployment kannst du in Firebase Console überwachen:

- **Cloud Messaging** → Message Delivery Statistics
- **Analytics** → User Engagement (falls aktiviert)
- **Crashlytics** → Crash Reports (optional)

## 🔒 Sicherheit

### API Keys im Code

Die `GoogleService-Info.plist` und `google-services.json` enthalten nur:
- **Public Identifiers** (Project ID, App ID, etc.)
- **API Keys für Client-Apps** (sind öffentlich)

Diese sind **sicher im Git Repo** zu committen!

Sensible Keys (Server Keys, Service Account Keys) bleiben in Firebase Console und werden **niemals** committed.

### Firebase Security Rules

Falls du Firestore/Realtime Database verwendest:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 📚 Weitere Ressourcen

- [Firebase iOS Setup](https://firebase.google.com/docs/ios/setup)
- [Firebase Android Setup](https://firebase.google.com/docs/android/setup)
- [FCM Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications)
