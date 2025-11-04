# Flux ERP Mobile App - Anforderungen Zusammenfassung

## Projektübersicht
Native Mobile App (iOS & Android) als Wrapper für die bestehende Flux ERP PWA mit nativen Funktionen.

## Kern-Anforderungen

### 1. App-Architektur
- **Separates Projekt:** Neues Repository `flux-erp-mobile` (getrennt vom Laravel Backend)
- **Technologie:** Capacitor (nicht Flutter, nicht Ionic)
- **Struktur:** 
  - Setup-Screen für Server-Konfiguration
  - WebView Container für die Laravel PWA
  - Capacitor Bridge für native Funktionen

### 2. Multi-Tenant Support (On-Premise)
- **Eine App für alle Kunden** (nicht eine App pro Installation)
- **Server-Konfiguration beim ersten Start:**
  - Manuelle URL-Eingabe
  - QR-Code Scanning zur automatischen Konfiguration
  - Server-URL wird lokal gespeichert (Preferences API)
- **Validierung:** Connection-Test vor dem Speichern der URL

### 3. Push Notifications
- **FCM (Firebase Cloud Messaging)** für iOS und Android
- **Anforderungen:**
  - Notifications auch wenn App geschlossen
  - Device-Token Registrierung beim Laravel Backend
  - Ein Firebase-Projekt für alle Kunden-Installationen
  - Unterstützung für mehrere Geräte pro User
- **Backend Integration:**
  - Laravel: `kreait/laravel-firebase` Package
  - API Endpoint: `/api/mobile/register-device`
  - Notification Classes mit FCM Channel

### 4. Scanner Funktionen
**Dokumenten-Scanner:**
- Native ML Kit (Google) / VisionKit (Apple)
- Automatische Kantenerkennung
- Perspektivenkorrektur
- Schwarz-Weiß-Konvertierung
- Multi-Page Support

**Barcode/QR-Scanner:**
- Produkt-Barcodes scannen
- QR-Codes für Setup und Funktionen
- Live-Scanning mit Overlay

**OCR (Text-Erkennung):**
- Text aus Fotos extrahieren
- Rechnungsnummern automatisch erkennen
- Integration ins Laravel Backend

### 5. Native Funktionen
- **Camera:** Fotos aufnehmen und hochladen
- **File Picker:** Dateien aus Galerie/Files-App auswählen
- **Geolocation:** Standortzugriff (optional für Lieferungen)
- **Intent/Share:** Dateien von anderen Apps empfangen
- **Pull-to-Refresh:** Native Refresh-Funktion

### 6. Intent/Share Integration
**Android:**
- Intent Filter für PDF, Bilder, Dokumente
- SEND und SEND_MULTIPLE Actions
- File-Upload ans Laravel Backend

**iOS:**
- CFBundleDocumentTypes für PDF und Bilder
- Share Extension Support
- File-Upload ans Laravel Backend

### 7. Platform-spezifische Anforderungen
**iOS:**
- APNs Key-Konfiguration in Firebase
- Info.plist Permissions (Camera, Location, etc.)
- Xcode Build für App Store

**Android:**
- AndroidManifest.xml Permissions
- FCM Integration
- Android Studio Build für Play Store

## Technische Spezifikationen

### Dependencies
```bash
@capacitor/core
@capacitor/cli
@capacitor/ios
@capacitor/android
@capacitor/push-notifications
@capacitor/camera
@capacitor/geolocation
@capacitor/preferences
@capacitor/filesystem
@capacitor/share
capacitor-document-scanner
@capacitor-mlkit/barcode-scanning
```

### Laravel Backend Erweiterungen
- FCM Token Storage (Users-Tabelle oder separate Devices-Tabelle)
- API Endpoints:
  - `/api/mobile/register-device` (POST)
  - `/api/documents/upload` (POST)
  - `/api/health` (GET) - für Connection-Test
  - `/api/mobile/config` (GET)
- Firebase Notification Service
- Laravel Notification Channel für FCM

### App Store Anforderungen
- **App ID:** `com.teamnifty.fluxerp`
- **App Name:** Flux ERP
- **Apple Developer Account:** 99€/Jahr
- **Google Play Developer:** 25€ einmalig
- **Beschreibung:** Fokus auf Self-Hosted/On-Premise Setup

## Workflow

### User Journey
1. **Installation:** User installiert App aus App Store/Play Store
2. **Setup:** 
   - Öffnet App → Setup-Screen
   - Scannt QR-Code vom Admin oder gibt URL manuell ein
   - App validiert Connection
3. **Login:** User loggt sich über die Laravel-App ein
4. **Nutzung:** 
   - App lädt Laravel PWA im WebView
   - Native Funktionen über Capacitor Bridge verfügbar
   - Push Notifications empfangen

### Developer Workflow
1. **Development:** 
   - `npm run dev` für lokales Testing
   - Live-Reload während Entwicklung
2. **Build:** 
   - `npm run build` → Vite Output
   - `npx cap sync` → Native Projekte aktualisieren
3. **Deploy:**
   - `npx cap open ios` → Xcode → Archive → App Store
   - `npx cap open android` → Android Studio → Build Bundle → Play Store

## Nicht-funktionale Anforderungen
- **Performance:** WebView soll Laravel-App performant laden
- **Security:** HTTPS-only für Server-Verbindungen
- **Offline:** Graceful Handling wenn Server nicht erreichbar
- **Updates:** App-Updates über Store, Content-Updates über Laravel
- **Größe:** Ziel < 50 MB App-Größe
- **Support:** iOS 13+, Android 8+

## Out of Scope (nicht benötigt)
- ❌ Ionic UI Framework
- ❌ Flutter
- ❌ Komplett native UI (WebView reicht)
- ❌ App-spezifische Builds pro Kunde
- ❌ Complex Background Location Tracking (nur optional/basic)
- ❌ localStorage für Offline-Daten (läuft im WebView)

## Kosten
- **Firebase/FCM:** Kostenlos (unlimited Notifications)
- **Apple Developer:** 99€/Jahr
- **Google Play:** 25€ einmalig
- **Entwicklung:** Inhouse (team-nifty.com)

## Priorität Features
**Must Have (Phase 1):**
- ✅ QR-Code Setup
- ✅ WebView Container
- ✅ Push Notifications
- ✅ Camera/Photo Upload

**Should Have (Phase 2):**
- ✅ Dokumenten-Scanner
- ✅ Barcode-Scanner
- ✅ Intent/Share Support

**Nice to Have (Phase 3):**
- ⭕ OCR/Text-Erkennung
- ⭕ Background Geolocation
- ⭕ Offline-Fallback

## Success Criteria
- [ ] Eine App funktioniert für alle Kunden-Server
- [ ] Push Notifications kommen zuverlässig an
- [ ] Scanner-Funktionen arbeiten präzise
- [ ] Upload von Dokumenten funktioniert reibungslos
- [ ] App ist in beiden Stores verfügbar
- [ ] Setup-Prozess dauert < 2 Minuten

## Projektstruktur

```
flux-erp-mobile/
├── src/
│   ├── index.html           # Setup-Screen + WebView Container
│   ├── app.js               # Capacitor Logic & Bridge
│   └── style.css            # Minimal Styling
├── android/                 # Native Android Projekt
├── ios/                     # Native iOS Projekt
├── capacitor.config.ts      # Capacitor Konfiguration
├── vite.config.js           # Build Configuration
├── package.json
└── README.md
```

## Nächste Schritte
1. Neues Git Repository erstellen: `flux-erp-mobile`
2. Capacitor Projekt initialisieren
3. Firebase Projekt erstellen & konfigurieren
4. Setup-Screen implementieren
5. Push Notifications integrieren
6. Scanner-Funktionen implementieren
7. Laravel Backend API-Endpoints erstellen
8. Testing auf iOS & Android Devices
9. App Store & Play Store Submission vorbereiten
10. Dokumentation für Admins (QR-Code Generation)
