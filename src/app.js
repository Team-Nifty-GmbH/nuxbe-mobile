import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { CapacitorBarcodeScanner } from '@capacitor/barcode-scanner';
import { PushNotifications } from '@capacitor/push-notifications';
import { Camera } from '@capacitor/camera';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { Device } from '@capacitor/device';
import { StatusBar, Style } from '@capacitor/status-bar';
import packageJson from '../package.json';
import { t, updateUI } from './i18n.js';

const STORAGE_KEY = 'server_url';
const STORAGE_SERVER_HISTORY = 'server_history';
const STORAGE_FCM_TOKEN = 'fcm_token';
const APP_VERSION = packageJson.version;
const MAX_SERVER_HISTORY = 5;

class NuxbeApp {
    constructor() {
        this.serverUrl = null;
        this.appName = null;
        this.isNative = Capacitor.isNativePlatform();
        this.loadingTimeout = null;

        this.init();
    }

    /**
     * Get the base URL for redirects within the app
     * Android: http://localhost (required for JS injection to work)
     * iOS: capacitor://localhost
     */
    getBaseUrl() {
        if (!this.isNative) return '/';
        const platform = Capacitor.getPlatform();
        return platform === 'android' ? 'http://localhost' : 'capacitor://localhost';
    }

    async init() {
        updateUI();

        if (this.isNative) {
            try {
                await StatusBar.setOverlaysWebView({ overlay: false });
                await StatusBar.setStyle({ style: Style.Light });
            } catch (error) {
                console.error('[STATUS BAR] Configuration failed:', error);
            }
        }

        // IMPORTANT: Initialize push notifications immediately on first app start
        // This must happen BEFORE anything else so the user can grant permission
        if (this.isNative) {
            await this.initializePushNotifications();
        }

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('reset') === '1') {
            await this.clearServerUrl();
            window.sessionStorage.removeItem('nuxbe_connected');
            this.showSetupScreen();
            this.setupEventListeners();
            return;
        }

        const currentUrl = window.location.href;
        const isAtApp = currentUrl.includes('capacitor://') || currentUrl.includes('localhost') || currentUrl.includes('index.html');

        if (!isAtApp && this.isNative) {
            const savedUrl = await this.getSavedServerUrl();
            if (savedUrl) {
                this.serverUrl = savedUrl;
                await this.initializeNativeFeatures();
                this.enablePullToRefresh();
            }
            return;
        }

        const savedUrl = await this.getSavedServerUrl();

        if (savedUrl) {
            // Server is saved - navigate directly to preserve login session (cookies remain intact)
            this.serverUrl = savedUrl;

            const config = await this.fetchConfig(savedUrl);
            if (config?.app_name) {
                this.appName = config.app_name;
                await this.addServerToHistory(savedUrl, config.app_name);
            }

            if (this.isNative) {
                await this.initializeNativeFeatures();
            }

            this.showWebView();
        } else {
            this.showSetupScreen();
        }

        this.setupEventListeners();
    }

    showReconnectPrompt(savedUrl) {
        document.getElementById('setup-screen').style.display = 'flex';
        document.getElementById('webview-container').style.display = 'none';
        document.getElementById('loading-screen').style.display = 'none';

        const container = document.querySelector('#setup-screen .container');
        container.innerHTML = `
            <div class="logo">
                <h1>Nuxbe</h1>
                <p class="subtitle">Willkommen zurück</p>
                <p class="subtitle" style="font-size: 0.75rem; opacity: 0.6;">v${APP_VERSION}</p>
            </div>
            <div class="setup-form">
                <p style="margin-bottom: 1.5rem; text-align: center; color: #6B7280;">
                    Letzter Server: <strong>${savedUrl}</strong>
                </p>
                <button id="reconnect-btn" class="btn btn-primary">
                    Mit Server verbinden
                </button>
                <button id="change-server-btn" class="btn btn-secondary" style="margin-top: 0.75rem;">
                    Server ändern
                </button>
            </div>
        `;

        // Setup event listeners for new buttons
        document.getElementById('reconnect-btn').addEventListener('click', async () => {
            this.serverUrl = savedUrl;
            this.showWebView();
            await this.initializeNativeFeatures();
        });

        document.getElementById('change-server-btn').addEventListener('click', async () => {
            await this.clearServerUrl();
            location.reload();
        });
    }

    setupEventListeners() {
        // Connect button
        const connectBtn = document.getElementById('connect-btn');
        connectBtn?.addEventListener('click', () => this.handleConnect());

        // QR Scan button
        const scanBtn = document.getElementById('scan-qr-btn');
        scanBtn?.addEventListener('click', () => this.handleQRScan());

        // Enter key on input
        const urlInput = document.getElementById('server-url');
        urlInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleConnect();
            }
        });

        // App state listeners (for native)
        if (this.isNative) {
            App.addListener('appStateChange', ({ isActive }) => {
                // App state changed
            });

            // Deep Link Handler für "Server wechseln" aus Flux ERP
            App.addListener('appUrlOpen', async (data) => {
                if (data.url && data.url.includes('change-server')) {
                    await this.clearServerUrl();
                    window.location.href = this.getBaseUrl() + '/index.html';
                }
            });
        }
    }

    async handleConnect() {
        const urlInput = document.getElementById('server-url');
        const connectBtn = document.getElementById('connect-btn');
        const errorMsg = document.getElementById('url-error');

        let url = urlInput.value.trim();

        if (!url) {
            this.showError(errorMsg, t('setup.errors.emptyUrl'));
            return;
        }

        // Normalize URL: remove trailing slash
        url = url.replace(/\/$/, '');

        // Auto-prefix https:// if no protocol is present
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        // Force HTTPS if user entered HTTP (except for localhost/192.168.x.x)
        if (url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1') && !url.match(/http:\/\/192\.168\./)) {
            url = url.replace('http://', 'https://');
        }

        // Validate URL format
        if (!this.isValidUrl(url)) {
            this.showError(errorMsg, t('setup.errors.invalidUrl'));
            return;
        }

        // Show loading state
        this.setButtonLoading(connectBtn, true);
        this.hideError(errorMsg);

        try {
            // Test connection
            const isValid = await this.testConnection(url);

            if (isValid) {
                // Fetch server config to get app name
                const config = await this.fetchConfig(url);
                const appName = config?.app_name || null;
                this.appName = appName;

                await this.saveServerUrl(url, appName);
                this.serverUrl = url;

                // Initialize native features before showing webview
                if (this.isNative) {
                    await this.initializeNativeFeatures();
                }

                this.showWebView();
            } else {
                this.showError(errorMsg, t('setup.errors.serverNotReachable'));
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            this.showError(errorMsg, t('setup.errors.connectionFailed') + ': ' + error.message);
        } finally {
            this.setButtonLoading(connectBtn, false);
        }
    }

    async handleQRScan() {
        if (!this.isNative) {
            alert(t('setup.qrScannerNativeOnly'));
            return;
        }

        try {
            const result = await CapacitorBarcodeScanner.scanBarcode({
                hint: 0, // 0 = QR_CODE from Html5QrcodeSupportedFormats enum
                scanInstructions: t('setup.scanQr'),
                scanButton: false
            });

            if (result.ScanResult) {
                const scannedUrl = result.ScanResult;

                // Populate input and trigger connect
                const urlInput = document.getElementById('server-url');
                urlInput.value = scannedUrl;

                await this.handleConnect();
            }
        } catch (error) {
            console.error('QR Scan failed:', error);
            alert(t('setup.qrScanFailed') + ': ' + error.message);
        }
    }

    async testConnection(url) {
        try {
            const healthUrl = `${url}/api/health`;

            const response = await fetch(healthUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });

            await response.json();

            return response.ok;
        } catch (error) {
            console.error('[HEALTH CHECK] Failed:', error);
            return false;
        }
    }

    async fetchConfig(url) {
        try {
            const configUrl = `${url}/api/mobile/config`;

            const response = await fetch(configUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });

            if (!response.ok) {
                return null;
            }

            const config = await response.json();

            return config;
        } catch (error) {
            return null;
        }
    }

    async initializeNativeFeatures() {
        try {
            // Setup camera bridge for webview
            this.setupCameraBridge();

            // Setup other native bridges
            this.setupNativeBridges();

            // Enable pull-to-refresh
            this.enablePullToRefresh();

            // Note: Push notifications werden bereits in init() initialisiert

        } catch (error) {
            console.error('[NATIVE] Failed to initialize native features:', error);
        }
    }

    async initializePushNotifications() {
        try {
            // WICHTIG: Event Listener IMMER registrieren, auch wenn Permission denied
            // Grund: User könnte später Permission geben, oder Notifications kommen trotzdem durch

            // Handle push notification received while app is open
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                // Notification received while app is open
            });

            // Handle notification tap - Deep Link Navigation
            PushNotifications.addListener('pushNotificationActionPerformed', async (notification) => {
                const data = notification.notification?.data;

                if (data?.url && data?.path) {
                    // Save target server and path
                    await Preferences.set({
                        key: STORAGE_KEY,
                        value: data.url
                    });

                    await Preferences.set({
                        key: 'deep_link_target',
                        value: data.path
                    });

                    // Reload app - will navigate to server and then to deep link path
                    window.location.href = this.getBaseUrl() + '/index.html';
                }
            });

            // Handle deep links from URLs (universal links, custom schemes)
            App.addListener('appUrlOpen', async (event) => {
                try {
                    const url = new URL(event.url);

                    // Handle nuxbe:// deep links
                    if (url.protocol === 'nuxbe:') {
                        const serverUrl = url.searchParams.get('server');
                        const targetPath = url.searchParams.get('path');

                        if (serverUrl && targetPath) {
                            if (this.serverUrl !== serverUrl) {
                                this.serverUrl = serverUrl;
                                await Preferences.set({
                                    key: STORAGE_KEY,
                                    value: serverUrl
                                });
                            }

                            window.location.href = `${serverUrl}${targetPath}`;
                        }
                    }
                } catch (error) {
                    console.error('[DEEP LINK] Error:', error);
                }
            });

            // Check and request permissions
            let permStatus = await PushNotifications.checkPermissions();

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            // Register with APNs (iOS) - triggers FCM token generation in AppDelegate
            await PushNotifications.register();

            // Listen for registration confirmation
            PushNotifications.addListener('registration', async (token) => {
                // Save token to preferences for session-based registration
                await Preferences.set({
                    key: 'fcm_token',
                    value: token.value
                });
            });

            // Handle registration errors
            PushNotifications.addListener('registrationError', (error) => {
                console.error('[PUSH] Registration error:', error);
            });

            // Check for pending deep links from MainActivity (Android)
            // MainActivity saves deep link data to SharedPreferences when app is opened via notification
            const pendingUrl = await Preferences.get({ key: 'pending_deep_link_url' });
            const pendingPath = await Preferences.get({ key: 'pending_deep_link_path' });

            if (pendingUrl.value && pendingPath.value) {
                // Save to server URL and target path
                await Preferences.set({
                    key: STORAGE_KEY,
                    value: pendingUrl.value
                });

                await Preferences.set({
                    key: 'deep_link_target',
                    value: pendingPath.value
                });

                // Clear pending deep link
                await Preferences.remove({ key: 'pending_deep_link_url' });
                await Preferences.remove({ key: 'pending_deep_link_path' });
            }

        } catch (error) {
            console.error('[PUSH ERROR] Push notifications initialization failed:', error);
        }
    }


    async getDeviceId() {
        if (!this.isNative) {
            // Web: use localStorage UUID
            let deviceId = localStorage.getItem('nuxbe_device_id');
            if (!deviceId) {
                deviceId = this.generateUUID();
                localStorage.setItem('nuxbe_device_id', deviceId);
            }
            return deviceId;
        }

        // Native: use Capacitor Device ID
        const info = await Device.getId();
        return info.identifier;
    }

    async getDeviceInfo() {
        if (!this.isNative) {
            return {
                platform: 'web',
                model: 'Web Browser',
                osVersion: navigator.userAgent
            };
        }

        const info = await Device.getInfo();
        return {
            platform: info.platform,
            model: info.model,
            manufacturer: info.manufacturer,
            osVersion: info.osVersion,
            isVirtual: info.isVirtual
        };
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    setupCameraBridge() {
        // Make camera available to webview via window object
        window.nativeBridge = window.nativeBridge || {};

        window.nativeBridge.capturePhoto = async () => {
            try {
                const image = await Camera.getPhoto({
                    quality: 90,
                    allowEditing: false,
                    resultType: 'base64',
                    source: 'camera'
                });

                return {
                    success: true,
                    base64: image.base64String,
                    format: image.format
                };
            } catch (error) {
                console.error('Camera capture failed:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        };

        window.nativeBridge.pickPhoto = async () => {
            try {
                const image = await Camera.getPhoto({
                    quality: 90,
                    allowEditing: false,
                    resultType: 'base64',
                    source: 'photos'
                });

                return {
                    success: true,
                    base64: image.base64String,
                    format: image.format
                };
            } catch (error) {
                console.error('Photo picker failed:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        };
    }

    enablePullToRefresh() {
        // Enable pull-to-refresh for the WebView
        if (this.isNative) {
            // Add pull-to-refresh listener
            document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
            document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
            document.addEventListener('touchend', this.handleTouchEnd.bind(this));

            this.touchStartY = 0;
            this.touchCurrentY = 0;
            this.isPulling = false;
        }
    }

    handleTouchStart(e) {
        // Only trigger if at top of page
        if (window.scrollY === 0) {
            this.touchStartY = e.touches[0].clientY;
        }
    }

    handleTouchMove(e) {
        if (window.scrollY === 0 && this.touchStartY > 0) {
            this.touchCurrentY = e.touches[0].clientY;
            const pullDistance = this.touchCurrentY - this.touchStartY;

            // Trigger refresh if pulled down > 100px
            if (pullDistance > 100 && !this.isPulling) {
                this.isPulling = true;
            }
        }
    }

    handleTouchEnd() {
        if (this.isPulling) {
            window.location.reload();
        }

        this.touchStartY = 0;
        this.touchCurrentY = 0;
        this.isPulling = false;
    }

    setupNativeBridges() {
        window.nativeBridge = window.nativeBridge || {};

        // Barcode scanning
        window.nativeBridge.scanBarcode = async () => {
            try {
                const result = await CapacitorBarcodeScanner.scanBarcode({
                    hint: 'ALL', // 'ALL' is valid as CapacitorBarcodeScannerTypeHintALLOption
                    scanButton: false
                });

                if (result.ScanResult) {
                    return {
                        success: true,
                        barcode: result.ScanResult,
                        format: result.format || 'unknown'
                    };
                }

                return {
                    success: false,
                    error: 'No barcode detected'
                };
            } catch (error) {
                console.error('Barcode scan failed:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        };

        // Server wechseln - für Flux ERP
        window.nativeBridge.changeServer = async () => {
            try {
                await this.clearServerUrl();
                window.location.href = this.getBaseUrl() + '/index.html';
                return { success: true };
            } catch (error) {
                console.error('Change server failed:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        };

        // Check if running in native app
        window.nativeBridge.isNative = () => this.isNative;

        // Get platform
        window.nativeBridge.getPlatform = () => Capacitor.getPlatform();

        // App Version
        window.nativeBridge.getVersion = () => APP_VERSION;
    }

    async showSetupScreen() {
        document.getElementById('setup-screen').style.display = 'flex';
        document.getElementById('webview-container').style.display = 'none';
        document.getElementById('loading-screen').style.display = 'none';

        // Hide splash screen when setup screen is ready
        if (this.isNative) {
            await SplashScreen.hide();
        }

        // Load and display server history
        const history = await this.getServerHistory();
        const historyContainer = document.getElementById('server-history');

        if (history.length > 0 && historyContainer) {
            historyContainer.innerHTML = `
                <div class="server-history-title">${t('setup.connected')}</div>
                ${history.map(server => `
                    <div class="server-history-item-wrapper">
                        <button class="server-history-item" data-url="${server.url}">
                            <span class="server-url">${server.appName || server.url}</span>
                            <svg class="chevron-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                        </button>
                        <button class="server-delete-btn" data-url="${server.url}" title="Remove server">
                            <svg class="delete-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                `).join('')}
            `;

            // Add click listeners for history items
            historyContainer.querySelectorAll('.server-history-item').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const url = e.currentTarget.getAttribute('data-url');
                    document.getElementById('server-url').value = url;
                    await this.handleConnect();
                });
            });

            // Add click listeners for delete buttons
            historyContainer.querySelectorAll('.server-delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Prevent triggering the server-history-item click
                    const url = btn.getAttribute('data-url');
                    await this.removeServerFromHistory(url);
                });
            });

            historyContainer.style.display = 'block';
        } else if (historyContainer) {
            historyContainer.style.display = 'none';
        }
    }

    async showWebView() {
        // Get FCM token, device info and device ID
        const { value: fcmToken } = await Preferences.get({ key: STORAGE_FCM_TOKEN });
        const { value: deviceName } = await Preferences.get({ key: 'device_name' });
        const deviceId = await this.getDeviceId();
        const deviceInfo = await this.getDeviceInfo();

        // Check if there's a deep link target path from MainActivity (Android)
        // MainActivity saves: pending_deep_link_url and pending_deep_link_path
        const { value: pendingUrl } = await Preferences.get({ key: 'pending_deep_link_url' });
        const { value: pendingPath } = await Preferences.get({ key: 'pending_deep_link_path' });

        // Also check for deep_link_target (from pushNotificationActionPerformed in app.js)
        const { value: deepLinkTarget } = await Preferences.get({ key: 'deep_link_target' });

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

        // Show loading screen with app name or server URL as fallback
        const displayName = this.appName || this.serverUrl;
        this.showLoading(t('loading.openingServer', { name: displayName }));

        // Always navigate to login-mobile endpoint
        // This ensures proper session handling and redirect functionality
        let targetUrl = `${this.serverUrl}/login-mobile`;
        const params = new URLSearchParams();

        // Add FCM token if available
        if (fcmToken && this.isNative) {
            params.append('fcm_token', fcmToken);
            params.append('platform', deviceInfo.platform);
            params.append('device_id', deviceId);
            params.append('device_model', deviceInfo.model);
            params.append('device_os_version', deviceInfo.osVersion);

            if (deviceInfo.manufacturer) {
                params.append('device_manufacturer', deviceInfo.manufacturer);
            }

            if (deviceName) {
                params.append('device_name', deviceName);
            }
        }

        // Add deep link redirect if we have one
        if (finalDeepLinkPath) {
            params.append('redirect', finalDeepLinkPath);

            // Clear the deep link target (if it came from pushNotificationActionPerformed)
            if (deepLinkTarget) {
                await Preferences.remove({ key: 'deep_link_target' });
            }
        }

        // Build final URL with parameters
        if (params.toString()) {
            targetUrl = `${targetUrl}?${params.toString()}`;
        }

        // Hide splash screen before showing iframe
        if (this.isNative) {
            await SplashScreen.hide();
        }

        // Set timeout to show error if navigation takes too long
        this.setLoadingTimeout(targetUrl);

        // Navigate to server - Capacitor bridge will be loaded by nuxbe-bridge.js
        window.location.href = targetUrl;
    }

    showLoading(text = null) {
        document.getElementById('setup-screen').style.display = 'none';
        document.getElementById('webview-container').style.display = 'none';
        document.getElementById('loading-screen').style.display = 'flex';

        // Update loading text
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.textContent = text || t('loading.connectingToServer');
        }

        // Setup cancel button
        const cancelBtn = document.getElementById('cancel-loading-btn');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                this.clearLoadingTimeout();
                if (this.isNative) {
                    window.location.href = this.getBaseUrl() + '/?reset=1';
                } else {
                    window.location.href = '/';
                }
            };
        }
    }

    async getSavedServerUrl() {
        const { value } = await Preferences.get({ key: STORAGE_KEY });
        return value;
    }

    async saveServerUrl(url, appName = null) {
        await Preferences.set({
            key: STORAGE_KEY,
            value: url
        });

        // Add to server history with app name
        await this.addServerToHistory(url, appName);
    }

    async getServerHistory() {
        const { value } = await Preferences.get({ key: STORAGE_SERVER_HISTORY });
        if (!value) return [];

        try {
            return JSON.parse(value);
        } catch (error) {
            console.error('Failed to parse server history:', error);
            return [];
        }
    }

    async addServerToHistory(url, appName = null) {
        let history = await this.getServerHistory();

        // Remove if already exists
        history = history.filter(server => server.url !== url);

        // Add to beginning with app name
        history.unshift({
            url,
            appName: appName || url, // Use app name if available, otherwise use URL
            lastConnected: new Date().toISOString()
        });

        // Keep only last MAX_SERVER_HISTORY entries
        history = history.slice(0, MAX_SERVER_HISTORY);

        await Preferences.set({
            key: STORAGE_SERVER_HISTORY,
            value: JSON.stringify(history)
        });
    }

    async removeServerFromHistory(url) {
        try {
            // Delete device token from server
            try {
                const deviceId = await this.getDeviceId();
                const deleteUrl = `${url}/api/mobile/device-token/delete`;

                await fetch(deleteUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ device_id: deviceId })
                });
            } catch (error) {
                // Failed to delete device token from server
            }

            // Remove from local history
            let history = await this.getServerHistory();
            history = history.filter(server => server.url !== url);

            await Preferences.set({
                key: STORAGE_SERVER_HISTORY,
                value: JSON.stringify(history)
            });

            // Reload setup screen to show updated history
            await this.showSetupScreen();
        } catch (error) {
            console.error('[DEVICE] Failed to remove server from history:', error);
        }
    }

    async clearServerUrl() {
        await Preferences.remove({ key: STORAGE_KEY });
    }

    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    showError(element, message) {
        element.textContent = message;
        element.classList.add('show');

        const input = document.getElementById('server-url');
        input?.classList.add('error');
    }

    hideError(element) {
        element.textContent = '';
        element.classList.remove('show');

        const input = document.getElementById('server-url');
        input?.classList.remove('error');
    }

    setButtonLoading(button, isLoading) {
        const btnText = button.querySelector('.btn-text');
        const loader = button.querySelector('.loader');

        button.disabled = isLoading;

        if (isLoading) {
            btnText.style.display = 'none';
            loader.style.display = 'block';
        } else {
            btnText.style.display = 'block';
            loader.style.display = 'none';
        }
    }

    setLoadingTimeout(targetUrl) {
        // Clear any existing timeout
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
        }

        // Set timeout for 30 seconds
        this.loadingTimeout = setTimeout(() => {
            console.error('[TIMEOUT] Loading took too long, showing error screen');
            this.showLoadingError(targetUrl);
        }, 30000);
    }

    clearLoadingTimeout() {
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = null;
        }
    }

    showLoadingError(targetUrl) {
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.innerHTML = `
            <div class="loading-content" style="max-width: 400px; padding: 2rem;">
                <svg
                    style="width: 64px; height: 64px; margin: 0 auto 1.5rem; color: #EF4444;"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #1F2937;">
                    ${t('loading.connectionFailedTitle')}
                </h2>
                <p style="color: #6B7280; margin-bottom: 1.5rem; text-align: center;">
                    ${t('loading.connectionFailedMessage')}
                </p>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <button id="retry-btn" class="btn btn-primary" style="width: 100%;">
                        ${t('loading.retry')}
                    </button>
                    <button id="cancel-btn" class="btn btn-secondary" style="width: 100%;">
                        ${t('loading.backToServerSelection')}
                    </button>
                </div>
            </div>
        `;

        // Add event listeners
        document.getElementById('retry-btn').addEventListener('click', () => {
            this.clearLoadingTimeout();
            this.showWebView();
        });

        document.getElementById('cancel-btn').addEventListener('click', async () => {
            this.clearLoadingTimeout();
            await this.showSetupScreen();
        });
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new NuxbeApp();
    });
} else {
    new NuxbeApp();
}
