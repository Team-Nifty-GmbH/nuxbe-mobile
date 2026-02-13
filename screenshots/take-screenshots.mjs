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
 *   DEMO_SERVER_URL  - Server to screenshot (default: https://demo.nuxbe.com)
 *   DEMO_EMAIL       - Login email (optional, uses pre-filled demo credentials)
 *   DEMO_PASSWORD    - Login password (optional, uses pre-filled demo credentials)
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { mkdir, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.join(ROOT, 'ios', 'App', 'fastlane', 'screenshots');

const SERVER_URL = process.env.DEMO_SERVER_URL || 'https://demo.nuxbe.com';
const DEMO_EMAIL = process.env.DEMO_EMAIL || '';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || '';
const LOCAL_PORT = 4173;

// Apple App Store required resolutions
const DEVICES = [
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
        viewport: { width: 1032, height: 1376 },
        deviceScaleFactor: 2,
        // Output: 2064 x 2752 (13" display)
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
    await page.goto(`${SERVER_URL}/login-mobile`, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for the login form to appear
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });

    // Fill credentials if provided (or if fields are empty)
    const emailField = page.locator('input[type="email"], input[name="email"]').first();
    const passwordField = page.locator('input[type="password"], input[name="password"]').first();

    const currentEmail = await emailField.inputValue();
    const currentPassword = await passwordField.inputValue();

    if (!currentEmail && DEMO_EMAIL) {
        await emailField.fill(DEMO_EMAIL);
    }

    if (!currentPassword && DEMO_PASSWORD) {
        await passwordField.fill(DEMO_PASSWORD);
    }

    // Click login button
    const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Anmelden")').first();
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

    // Clean output directory
    await rm(SCREENSHOT_DIR, { recursive: true, force: true });

    // Start local server for setup screen
    console.log('Starting local preview server...');
    const localServer = await startLocalServer();
    console.log(`Local server running on http://localhost:${LOCAL_PORT}\n`);

    const browser = await chromium.launch({ headless: true });

    try {
        for (const lang of LANGUAGES) {
            const langDir = path.join(SCREENSHOT_DIR, lang);
            await mkdir(langDir, { recursive: true });

            for (const device of DEVICES) {
                console.log(`\n--- ${device.name} / ${lang} ---`);

                const context = await browser.newContext({
                    viewport: device.viewport,
                    deviceScaleFactor: device.deviceScaleFactor,
                    isMobile: device.isMobile,
                    hasTouch: device.hasTouch,
                    locale: lang,
                });

                const page = await context.newPage();

                // --- Screenshot 1: Setup Screen (local app) ---
                try {
                    await page.goto(`http://localhost:${LOCAL_PORT}`, {
                        waitUntil: 'networkidle',
                        timeout: 15000,
                    });
                    await page.waitForTimeout(2000);

                    const setupFile = path.join(langDir, `${device.name}-01_SetupScreen.png`);
                    await page.screenshot({ path: setupFile });
                    console.log(`  + 01_SetupScreen`);
                } catch (err) {
                    console.error(`  ! 01_SetupScreen failed: ${err.message}`);
                }

                // --- Login to demo server ---
                try {
                    await login(page);
                    console.log(`  + Logged in`);
                } catch (err) {
                    console.error(`  ! Login failed: ${err.message}`);
                    await context.close();
                    continue;
                }

                // --- Screenshots 2-5: App pages ---
                for (const pageConfig of PAGES) {
                    try {
                        await page.goto(`${SERVER_URL}${pageConfig.path}`, {
                            waitUntil: 'networkidle',
                            timeout: 30000,
                        });
                        await waitForPageReady(page);

                        const filename = `${device.name}-${pageConfig.name}.png`;
                        await page.screenshot({ path: path.join(langDir, filename) });
                        console.log(`  + ${pageConfig.name}`);
                    } catch (err) {
                        console.error(`  ! ${pageConfig.name} failed: ${err.message}`);
                    }
                }

                await context.close();
            }
        }
    } finally {
        await browser.close();
        localServer.kill();
    }

    console.log('\n=== Done ===');
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
