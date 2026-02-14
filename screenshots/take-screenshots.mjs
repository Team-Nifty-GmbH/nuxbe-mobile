#!/usr/bin/env node

/**
 * App Store Screenshot Generator
 *
 * Takes screenshots of the Nuxbe mobile app using Playwright instead of
 * iOS/Android simulators. Since Nuxbe is a Capacitor app (WebView), the
 * UI is identical across all devices — only viewport dimensions differ.
 *
 * Output is written to ios/App/fastlane/screenshots/{lang}/{device}-{name}.png
 * which is compatible with Fastlane deliver for App Store Connect upload.
 *
 * Usage:
 *   node screenshots/take-screenshots.mjs
 *
 * Environment variables:
 *   DEMO_SERVER_URL  - Server to screenshot (default: http://127.0.0.1:8000)
 *   DEMO_EMAIL       - Login email (default: demo@demo.com)
 *   DEMO_PASSWORD    - Login password (default: demo)
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { mkdir, readFile, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.join(ROOT, 'ios', 'App', 'fastlane', 'screenshots');

const SERVER_URL = process.env.DEMO_SERVER_URL || 'http://127.0.0.1:8000';
const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@demo.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo';
const LOCAL_PORT = 4173;

// App Store required resolutions
const DEVICES = [
    // Apple App Store
    {
        name: 'iPhone 14 Plus',
        viewport: { width: 428, height: 926 },
        deviceScaleFactor: 3,
        // Output: 1284 x 2778 (6.5" display)
        isMobile: true,
        hasTouch: true,
    },
    {
        name: 'iPad Pro 13-inch (M4)',
        viewport: { width: 1024, height: 1366 },
        deviceScaleFactor: 2,
        // Output: 2048 x 2732 (13" display)
        isMobile: true,
        hasTouch: true,
    },
    // Google Play
    {
        name: 'Android Phone',
        viewport: { width: 360, height: 640 },
        deviceScaleFactor: 3,
        // Output: 1080 x 1920
        isMobile: true,
        hasTouch: true,
    },
    {
        name: 'Android 7-inch Tablet',
        viewport: { width: 540, height: 960 },
        deviceScaleFactor: 2,
        // Output: 1080 x 1920
        isMobile: true,
        hasTouch: true,
    },
    {
        name: 'Android 10-inch Tablet',
        viewport: { width: 800, height: 1280 },
        deviceScaleFactor: 2,
        // Output: 1600 x 2560
        isMobile: true,
        hasTouch: true,
    },
];

const LANGUAGES = ['de-DE', 'en-US'];

const PAGES = [
    { name: '02_Dashboard', path: '/' },
    { name: '03_Orders', path: '/orders/list' },
    { name: '04_Tickets', path: '/tickets' },
    { name: '05_Contacts', path: '/contacts/contacts' },
];

/**
 * Start vite preview server to serve the built app locally.
 * Returns the child process (kill it when done).
 */
function startLocalServer() {
    return new Promise((resolve, reject) => {
        const proc = spawn('npx', ['vite', 'preview', '--port', String(LOCAL_PORT), '--strictPort'], {
            cwd: ROOT,
            stdio: 'pipe',
        });

        let started = false;

        proc.stdout.on('data', (data) => {
            const output = data.toString();
            if (!started && output.includes('http')) {
                started = true;
                resolve(proc);
            }
        });

        proc.stderr.on('data', (data) => {
            const output = data.toString();
            if (!started && output.includes('http')) {
                started = true;
                resolve(proc);
            }
        });

        proc.on('error', reject);

        // Fallback: resolve after 5s even if we didn't see the URL in output
        setTimeout(() => {
            if (!started) {
                started = true;
                resolve(proc);
            }
        }, 5000);
    });
}

/**
 * Login to the demo server. Handles both pre-filled demo forms and manual credential entry.
 */
async function login(page) {
    await page.goto(`${SERVER_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for the login form to appear
    await page.locator('input[type="email"]:visible').first().waitFor({ timeout: 15000 });

    // Fill credentials (only target visible inputs to avoid reset-password form)
    const emailField = page.locator('input[type="email"]:visible').first();
    const passwordField = page.locator('input[type="password"]:visible').first();

    await emailField.fill(DEMO_EMAIL);
    await passwordField.fill(DEMO_PASSWORD);

    // Click login button
    const loginButton = page.locator('button[type="submit"]:visible').first();
    await loginButton.click();

    // Wait for navigation away from login page
    await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 });
}

/**
 * Wait for Livewire components to finish rendering.
 */
async function waitForPageReady(page) {
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Wait for Livewire to finish processing
    await page.evaluate(() => {
        return new Promise((resolve) => {
            if (typeof Livewire !== 'undefined' && Livewire.hook) {
                // Give Livewire components time to mount and render
                setTimeout(resolve, 3000);
            } else {
                setTimeout(resolve, 3000);
            }
        });
    });

    // Extra buffer for widget rendering
    await page.waitForTimeout(2000);
}

async function main() {
    console.log('=== Nuxbe App Store Screenshot Generator ===\n');
    console.log(`Server:  ${SERVER_URL}`);
    console.log(`Devices: ${DEVICES.map((d) => d.name).join(', ')}`);
    console.log(`Langs:   ${LANGUAGES.join(', ')}`);
    console.log(`Output:  ${SCREENSHOT_DIR}\n`);

    // Clean and create output directory
    await rm(SCREENSHOT_DIR, { recursive: true, force: true });
    await mkdir(SCREENSHOT_DIR, { recursive: true });

    // Start local server for setup screen
    console.log('Starting local preview server...');
    const localServer = await startLocalServer();
    console.log(`Local server running on http://localhost:${LOCAL_PORT}\n`);

    const isHeadless = process.env.HEADED !== '1';
    const browser = await chromium.launch({ headless: isHeadless });

    // Group devices by deviceScaleFactor (can only be set at context creation)
    const scaleGroups = {};
    for (const device of DEVICES) {
        const key = device.deviceScaleFactor;
        if (!scaleGroups[key]) scaleGroups[key] = [];
        scaleGroups[key].push(device);
    }

    try {
        for (const lang of LANGUAGES) {
            const langDir = path.join(SCREENSHOT_DIR, lang);
            await mkdir(langDir, { recursive: true });

            for (const [scaleFactor, devices] of Object.entries(scaleGroups)) {
                console.log(`\n--- ${lang} / @${scaleFactor}x (${devices.map((d) => d.name).join(', ')}) ---`);

                const context = await browser.newContext({
                    viewport: devices[0].viewport,
                    deviceScaleFactor: Number(scaleFactor),
                    isMobile: true,
                    hasTouch: true,
                    locale: lang,
                });

                const page = await context.newPage();

                // --- Screenshot 0: Splash Screen ---
                try {
                    const splashImage = path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset', 'splash-2732x2732.png');
                    const splashBase64 = (await readFile(splashImage)).toString('base64');
                    await page.setContent(`<html><body style="margin:0;background:#6366f1;display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;overflow:hidden"><img src="data:image/png;base64,${splashBase64}" style="min-width:100%;min-height:100%;object-fit:cover" /></body></html>`);
                    await page.waitForTimeout(500);

                    for (const device of devices) {
                        await page.setViewportSize(device.viewport);
                        await page.waitForTimeout(300);
                        const splashFile = path.join(langDir, `${device.name}-00_SplashScreen.png`);
                        await page.screenshot({ path: splashFile });
                        console.log(`  + ${device.name} / 00_SplashScreen`);
                    }
                } catch (err) {
                    console.error(`  ! 00_SplashScreen failed: ${err.message}`);
                }

                // --- Screenshot 1: Setup Screen (local app) ---
                try {
                    await page.goto(`http://localhost:${LOCAL_PORT}`, {
                        waitUntil: 'networkidle',
                        timeout: 15000,
                    });
                    await page.waitForTimeout(2000);

                    for (const device of devices) {
                        await page.setViewportSize(device.viewport);
                        await page.waitForTimeout(500);
                        const setupFile = path.join(langDir, `${device.name}-01_SetupScreen.png`);
                        await page.screenshot({ path: setupFile });
                        console.log(`  + ${device.name} / 01_SetupScreen`);
                    }
                } catch (err) {
                    console.error(`  ! 01_SetupScreen failed: ${err.message}`);
                }

                // --- Login once per scale group ---
                try {
                    await page.setViewportSize(devices[0].viewport);
                    await login(page);
                    console.log(`  + Logged in`);
                } catch (err) {
                    console.error(`  ! Login failed: ${err.message}`);
                    await context.close();
                    continue;
                }

                // --- Screenshots 2-5: Navigate once, resize for each device ---
                for (const pageConfig of PAGES) {
                    try {
                        await page.goto(`${SERVER_URL}${pageConfig.path}`, {
                            waitUntil: 'networkidle',
                            timeout: 30000,
                        });
                        await waitForPageReady(page);

                        for (const device of devices) {
                            await page.setViewportSize(device.viewport);
                            await page.waitForTimeout(500);
                            const filename = `${device.name}-${pageConfig.name}.png`;
                            await page.screenshot({ path: path.join(langDir, filename) });
                            console.log(`  + ${device.name} / ${pageConfig.name}`);
                        }
                    } catch (err) {
                        console.error(`  ! ${pageConfig.name} failed: ${err.message}`);
                    }
                }

                await context.close();
            }
        }
        // --- Store Assets (language-independent) ---
        console.log('\n--- Store Assets ---');
        const assetsDir = path.join(SCREENSHOT_DIR, 'store-assets');
        await mkdir(assetsDir, { recursive: true });

        const splashImage = path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset', 'splash-2732x2732.png');
        const splashBase64 = (await readFile(splashImage)).toString('base64');
        const appIcon = path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
        const iconBase64 = (await readFile(appIcon)).toString('base64');

        // App Icon 512x512
        try {
            const iconCtx = await browser.newContext({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
            const iconPage = await iconCtx.newPage();
            await iconPage.setContent(`<html><body style="margin:0;padding:0;width:512px;height:512px;overflow:hidden"><img src="data:image/png;base64,${iconBase64}" style="width:512px;height:512px" /></body></html>`);
            await iconPage.waitForTimeout(500);
            await iconPage.screenshot({ path: path.join(assetsDir, 'app-icon-512x512.png') });
            await iconCtx.close();
            console.log('  + app-icon-512x512.png');
        } catch (err) {
            console.error(`  ! App Icon failed: ${err.message}`);
        }

        // Feature Graphic 1024x500
        try {
            const fgCtx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
            const fgPage = await fgCtx.newPage();
            await fgPage.setContent(`<html><body style="margin:0;width:1024px;height:500px;overflow:hidden"><img src="data:image/png;base64,${splashBase64}" style="width:100%;height:100%;object-fit:cover" /></body></html>`);
            await fgPage.waitForTimeout(500);
            await fgPage.screenshot({ path: path.join(assetsDir, 'feature-graphic-1024x500.png') });
            await fgCtx.close();
            console.log('  + feature-graphic-1024x500.png');
        } catch (err) {
            console.error(`  ! Feature Graphic failed: ${err.message}`);
        }
    } finally {
        await browser.close();
        localServer.kill();
    }

    console.log('\n=== Done ===');
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
