# Nuxbe Mobile - Flux ERP Integration

## Server Wechseln Feature

Die Nuxbe Mobile App stellt eine JavaScript Bridge bereit, über die Flux ERP Funktionen der nativen App aufrufen kann.

### 1. Capacitor Detection

Prüfe in Flux ERP, ob die App in Nuxbe läuft:

```javascript
// In Alpine.js oder global
if (window.nativeBridge && window.nativeBridge.isNative()) {
  // App läuft in Nuxbe Mobile
  const platform = window.nativeBridge.getPlatform(); // 'ios' oder 'android'
  const version = window.nativeBridge.getVersion(); // z.B. '1.0.0'
}
```

### 2. Server Wechseln Button

Füge in Flux ERP einen "Server wechseln" Button hinzu, der nur in der App sichtbar ist:

```blade
{{-- In deinem Blade Template, z.B. im User-Menü --}}
@if(request()->userAgent() && str_contains(request()->userAgent(), 'Capacitor'))
    <x-button
        x-show="window.nativeBridge && window.nativeBridge.isNative()"
        x-on:click="async () => {
            const result = await window.nativeBridge.changeServer();
            if (result.success) {
                console.log('Zurück zur Server-Auswahl');
            }
        }"
        :text="__('Server wechseln')"
        color="secondary"
    />
@endif
```

Oder mit Alpine.js:

```html
<div x-data="{
    isNativeApp: window.nativeBridge && window.nativeBridge.isNative()
}">
    <button
        x-show="isNativeApp"
        x-on:click="async () => {
            await window.nativeBridge.changeServer();
        }"
    >
        Server wechseln
    </button>
</div>
```

### 3. Deep Link Alternative

Alternativ kannst du auch einen Link verwenden:

```html
<a href="nuxbe://change-server"
   x-show="window.nativeBridge && window.nativeBridge.isNative()">
    Server wechseln
</a>
```

Dieser Link wird von der App abgefangen und führt zur Server-Auswahl zurück.

### 4. Verfügbare Bridge Funktionen

```javascript
// Prüfen ob native App
window.nativeBridge.isNative() // boolean

// Platform abrufen
window.nativeBridge.getPlatform() // 'ios' | 'android'

// App Version abrufen
window.nativeBridge.getVersion() // string

// Server wechseln
await window.nativeBridge.changeServer() // { success: boolean }

// Barcode scannen
await window.nativeBridge.scanBarcode() // { success: boolean, barcode?: string, format?: string, error?: string }

// Foto aufnehmen
await window.nativeBridge.capturePhoto() // { success: boolean, base64?: string, format?: string, error?: string }

// Foto aus Galerie wählen
await window.nativeBridge.pickPhoto() // { success: boolean, base64?: string, format?: string, error?: string }
```

## Styling für Mobile

Empfohlene Tailwind-Klassen um UI nur in der App anzuzeigen:

```blade
{{-- Nur in Desktop --}}
<div class="hidden md:block">...</div>

{{-- Nur in Mobile/App --}}
<div class="md:hidden">...</div>
```

Kombiniert mit Capacitor Detection:

```html
<div x-show="window.nativeBridge && window.nativeBridge.isNative()"
     class="md:hidden">
    <!-- Nur in der mobilen App sichtbar -->
</div>
```

## Share Target (geteilte Dateien empfangen)

Wenn der Anwender Dateien (PDF, Bilder, XML, …) in die App teilt, legt die App
sie im Cache ab und navigiert zu `{server}/mobile/share-target`. Die Flux-Seite
liest die Dateien direkt über die Capacitor-Plugins (Preferences + Filesystem),
die auf der Server-Origin injiziert sind.

Android nimmt `ACTION_SEND` / `ACTION_SEND_MULTIPLE` mit beliebigem MIME-Type an
(`*/*`) sowie `ACTION_VIEW` für PDF und Bilder. Die Filterung, welche Datei für
welche Aktion zulässig ist, gehört in die Action-Registry auf Flux-Seite
(`accepts(mimeType)`), nicht ins App-Manifest.

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
- Reine Text-/URL-Shares (ohne Datei-Stream) werden derzeit ignoriert.
- Empfohlene Größenprüfung serverseitig: ~20 MB pro Datei (base64-Overhead beachten).
