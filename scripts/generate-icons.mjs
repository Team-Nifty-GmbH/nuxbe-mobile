import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const svgPath = join(__dirname, '../../flux-core/public/pwa/images/icons-vector.svg');
const appIconPath = join(__dirname, '../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
const splashPath = join(__dirname, '../ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png');
const splash1Path = join(__dirname, '../ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png');
const splash2Path = join(__dirname, '../ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png');

console.log('Reading SVG from:', svgPath);

// Blue background color from the SVG (#0690FA)
const blueBackground = { r: 6, g: 144, b: 250, alpha: 1 };

// Read and modify SVG to remove extra viewBox padding
let svgContent = readFileSync(svgPath, 'utf-8');

// The original SVG has viewBox="-100 -100 551 577" which adds padding
// We want the actual content to fill the icon, so adjust viewBox to "0 0 351 377"
// Add some padding manually for the icon (20% on each side for better spacing)
const paddingPercent = 0.2;
const width = 351;
const height = 377;
const padding = Math.max(width, height) * paddingPercent;
const newWidth = width + (padding * 2);
const newHeight = height + (padding * 2);

svgContent = svgContent.replace(
    'viewBox="-100 -100 551 577"',
    `viewBox="${-padding} ${-padding} ${newWidth} ${newHeight}"`
);

// Remove the style attribute and add background as a rect instead
svgContent = svgContent.replace(
    '<svg style="background: #0690FA"',
    '<svg'
);
svgContent = svgContent.replace(
    'fill="none"',
    `fill="none"><rect x="${-padding}" y="${-padding}" width="${newWidth}" height="${newHeight}" fill="#0690FA"/>`
);

const svgBuffer = Buffer.from(svgContent);

// Resize the SVG to 1024x1024
sharp(svgBuffer)
    .resize(1024, 1024)
    .png()
    .toFile(appIconPath)
    .then(() => {
        console.log('✅ iOS app icon (1024x1024) generated successfully!');
        return generateSplashScreen();
    })
    .then(() => {
        return generateAndroidIcons();
    })
    .catch(err => {
        console.error('❌ Error generating app icon:', err);
        process.exit(1);
    });

async function generateSplashScreen() {
    try {
        // Generate splash screen (2732x2732) with centered logo
        await sharp(svgBuffer)
            .resize(1366, 1366) // Logo size: 50% of splash screen
            .extend({
                top: 683,
                bottom: 683,
                left: 683,
                right: 683,
                background: blueBackground
            })
            .png()
            .toFile(splashPath);

        // Copy to all three required files
        await sharp(splashPath).toFile(splash1Path);
        await sharp(splashPath).toFile(splash2Path);

        console.log('✅ iOS splash screens (2732x2732) generated successfully!');
    } catch (err) {
        console.error('❌ Error generating splash screens:', err);
        process.exit(1);
    }
}

async function generateAndroidIcons() {
    const androidBasePath = join(__dirname, '../android/app/src/main/res');

    const iconSizes = [
        { dir: 'mipmap-mdpi', size: 48 },
        { dir: 'mipmap-hdpi', size: 72 },
        { dir: 'mipmap-xhdpi', size: 96 },
        { dir: 'mipmap-xxhdpi', size: 144 },
        { dir: 'mipmap-xxxhdpi', size: 192 }
    ];

    try {
        for (const { dir, size } of iconSizes) {
            const iconPath = join(androidBasePath, dir, 'ic_launcher.png');
            const roundIconPath = join(androidBasePath, dir, 'ic_launcher_round.png');
            const foregroundPath = join(androidBasePath, dir, 'ic_launcher_foreground.png');

            // Generate square icon
            await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toFile(iconPath);

            // Generate round icon
            await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toFile(roundIconPath);

            // Generate foreground (transparent background)
            await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toFile(foregroundPath);

            console.log(`✅ Android icons for ${dir} (${size}x${size}) generated successfully!`);
        }
    } catch (err) {
        console.error('❌ Error generating Android icons:', err);
        process.exit(1);
    }
}
