# Nuxbe Mobile

Native iOS & Android mobile app für Flux ERP mit Capacitor.

## 📱 Features

- ✅ **Multi-Tenant Support**: Eine App für alle Flux ERP Installationen
- ✅ **QR-Code Setup**: Schnelle Server-Konfiguration via QR-Code
- ✅ **Push Notifications**: FCM-basierte Benachrichtigungen
- ✅ **Native Camera**: Fotos aufnehmen und hochladen
- ✅ **Document Scanner**: Dokumente mit ML Kit/VisionKit scannen
- ✅ **Barcode Scanner**: Produkt-Barcodes scannen
- ✅ **WebView Container**: Lädt Flux ERP PWA

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ und npm
- Xcode 14+ (für iOS Development)
- Android Studio (für Android Development)
- Firebase Projekt mit FCM aktiviert

### Installation

```bash
# Dependencies installieren
npm install

# Native Projekte hinzufügen
npm run add:ios
npm run add:android
```

### Development

```bash
# Development Server starten
npm run dev

# Build für Production
npm run build

# Native Projekte syncen
npm run sync

# iOS Projekt in Xcode öffnen
npm run open:ios

# Android Projekt in Android Studio öffnen
npm run open:android
```

## 🔧 Konfiguration

### Firebase Setup

#### 1. Firebase Projekt erstellen

1. Gehe zu [Firebase Console](https://console.firebase.google.com/)
2. Erstelle ein neues Projekt: `flux-erp-mobile`
3. Aktiviere Cloud Messaging (FCM)

#### 2. iOS App hinzufügen

1. In Firebase Console: **Add app** → **iOS**
2. Bundle ID: `com.teamnifty.nuxbe`
3. App Name: `Nuxbe`
4. Download `GoogleService-Info.plist`
5. Kopiere die Datei nach: `ios/App/App/GoogleService-Info.plist`

**Wichtig**: Die `GoogleService-Info.plist` ist bereits im Projekt vorhanden und muss nicht ersetzt werden, außer du erstellst ein neues Firebase-Projekt.

#### 3. Android App hinzufügen

1. In Firebase Console: **Add app** → **Android**
2. Package name: `com.teamnifty.nuxbe`
3. App Name: `Nuxbe`
4. Download `google-services.json`
5. Kopiere die Datei nach: `android/app/google-services.json`

**Wichtig**: Die `google-services.json` ist bereits im Projekt vorhanden und muss nicht ersetzt werden, außer du erstellst ein neues Firebase-Projekt.

#### 4. APNs Key für iOS (Apple Developer Account benötigt)

1. In Apple Developer Portal: **Certificates, Identifiers & Profiles**
2. Erstelle einen neuen APNs Key
3. Download den `.p8` Key
4. In Firebase Console: **Project Settings** → **Cloud Messaging**
5. Upload APNs Key mit Team ID und Key ID

### Laravel Backend Konfiguration

Die Flux Core API-Endpoints sind bereits implementiert. Du musst nur die Migration ausführen:

```bash
# Im flux-core Package
php artisan migrate
```

Die folgenden Endpoints sind verfügbar:

- `GET /api/health` - Health Check (öffentlich)
- `GET /api/mobile/config` - App Konfiguration (öffentlich)
- `POST /api/mobile/register-device` - Device Token registrieren (authentifiziert)
- `POST /api/mobile/unregister-device` - Device Token entfernen (authentifiziert)

## 📝 Server URL Setup

### QR-Code generieren (für Admins)

Erstelle einen QR-Code mit der Server-URL für einfaches Setup:

```
https://mein-server.de
```

Tools zum QR-Code erstellen:
- [QR Code Generator](https://www.qr-code-generator.com/)
- [QRCode Monkey](https://www.qrcode-monkey.com/)

### Manuelles Setup

Benutzer können auch die Server-URL manuell eingeben:

```
https://mein-server.de
```

## 🏗️ Build & Deploy

### iOS Build

```bash
# Syncen
npm run build
npm run sync:ios

# Xcode öffnen
npm run open:ios

# In Xcode:
# 1. Product → Archive
# 2. Distribute App
# 3. App Store Connect
```

### Android Build

```bash
# Syncen
npm run build
npm run sync:android

# Android Studio öffnen
npm run open:android

# In Android Studio:
# 1. Build → Generate Signed Bundle / APK
# 2. Android App Bundle (.aab)
# 3. Release
```

## 🔐 Wichtige Hinweise

### Keine Secrets im Code

⚠️ **Dieses Projekt ist Open Source!** Keine API Keys, Tokens oder Secrets im Code committen.

Die Firebase Config-Dateien (`GoogleService-Info.plist` und `google-services.json`) sind bereits im Projekt und enthalten nur öffentliche Projekt-Identifikatoren. Diese sind sicher im Repository.

Sensible Firebase-Einstellungen (Server Keys, etc.) bleiben in der Firebase Console und werden niemals committed.

### .gitignore

Die folgenden Dateien/Ordner sind bereits in `.gitignore`:

- `node_modules/`
- `dist/`
- `ios/App/Pods/`
- `android/.gradle/`
- `.env*` (außer `.env.example`)

## 📱 Native Features

### Camera Access

```javascript
const result = await window.nativeBridge.capturePhoto();
if (result.success) {
    console.log('Photo captured:', result.base64);
}
```

### Photo Picker

```javascript
const result = await window.nativeBridge.pickPhoto();
if (result.success) {
    console.log('Photo selected:', result.base64);
}
```

### Barcode Scanner

```javascript
const result = await window.nativeBridge.scanBarcode();
if (result.success) {
    console.log('Barcode:', result.barcode);
}
```

### Platform Detection

```javascript
const isNative = window.nativeBridge.isNative();
const platform = window.nativeBridge.getPlatform(); // 'ios', 'android', or 'web'
```

## 🧪 Testing

### Web Browser Testing

```bash
npm run dev
# Öffne http://localhost:3000
```

### iOS Simulator Testing

```bash
npm run build
npm run sync:ios
npm run open:ios
# In Xcode: Run (⌘R)
```

### Android Emulator Testing

```bash
npm run build
npm run sync:android
npm run open:android
# In Android Studio: Run
```

## 🐛 Troubleshooting

### Push Notifications funktionieren nicht

1. Prüfe ob FCM Token registriert wurde (Console Log)
2. Prüfe Firebase Console → Cloud Messaging Konfiguration
3. iOS: Prüfe ob APNs Key korrekt konfiguriert ist
4. Android: Prüfe ob `google-services.json` korrekt ist

### Kamera funktioniert nicht

1. iOS: Prüfe `Info.plist` Permissions
2. Android: Prüfe `AndroidManifest.xml` Permissions
3. Prüfe Browser Console für Fehler

### App lädt nicht

1. Prüfe Server-URL (muss https:// sein)
2. Prüfe `/api/health` Endpoint
3. Prüfe CORS Settings im Backend

## 📦 Projektstruktur

```
nuxbe-mobile/
├── src/
│   ├── app.js              # Hauptlogik & Capacitor Bridge
│   └── style.css           # Styling
├── index.html              # Setup-Screen & WebView
├── ios/                    # Native iOS Projekt (Xcode)
├── android/                # Native Android Projekt (Android Studio)
├── capacitor.config.ts     # Capacitor Konfiguration
├── vite.config.js          # Build Konfiguration
├── package.json            # Dependencies
└── README.md               # Diese Datei
```

## 🤝 Contributing

Dieses Projekt ist Teil des Flux ERP Monorepos.

## 📄 License

MIT License - siehe [LICENSE](../../LICENSE)

## 🆘 Support

Bei Fragen oder Problemen:
- Erstelle ein Issue auf GitHub
- Kontaktiere das Team Nifty Support-Team
