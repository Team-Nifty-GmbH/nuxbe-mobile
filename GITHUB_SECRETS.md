# GitHub Secrets Configuration

This document describes all GitHub Secrets required for the mobile app CI/CD workflows.

## ⚠️ CRITICAL: Public Repository Security

**This repository is PUBLIC!** The following files contain API keys and must NEVER be committed:

- ❌ `GoogleService-Info.plist` (iOS Firebase config)
- ❌ `google-services.json` (Android Firebase config)
- ❌ `firebase-service-account.json` (Firebase Admin SDK)
- ❌ Any `.keystore`, `.p12`, `.mobileprovision` files

These files are already in `.gitignore`. If you accidentally committed them:
1. Remove from git history immediately (use `git filter-repo`)
2. Rotate ALL Firebase credentials in Firebase Console
3. Update GitHub Secrets with new credentials

All sensitive files MUST be provided via GitHub Secrets in CI/CD workflows.

## iOS Secrets

### Code Signing

- **`IOS_DISTRIBUTION_CERT_P12`** (Required for Release)
  - Base64 encoded .p12 distribution certificate
  - Generate: `base64 -i YourDistributionCert.p12 | pbcopy`

- **`IOS_DISTRIBUTION_CERT_PASSWORD`** (Required for Release)
  - Password for the distribution certificate .p12 file

- **`IOS_DEVELOPMENT_CERT_P12`** (Required for Nightly)
  - Base64 encoded .p12 development certificate
  - Generate: `base64 -i YourDevelopmentCert.p12 | pbcopy`

- **`IOS_DEVELOPMENT_CERT_PASSWORD`** (Required for Nightly)
  - Password for the development certificate .p12 file

### Provisioning Profiles

- **`IOS_PROVISION_PROFILE`** (Required for Release)
  - Base64 encoded App Store provisioning profile
  - Generate: `base64 -i YourAppStore.mobileprovision | pbcopy`

- **`IOS_DEVELOPMENT_PROVISION_PROFILE`** (Required for Nightly)
  - Base64 encoded Development provisioning profile
  - Generate: `base64 -i YourDevelopment.mobileprovision | pbcopy`

### Google Services (CRITICAL for Public Repos!)

- **`IOS_GOOGLE_SERVICES_PLIST`** (Required)
  - Content of GoogleService-Info.plist file (NOT base64 encoded)
  - Get from Firebase Console → Project Settings → iOS App
  - **NEVER commit this file to a public repository!**
  - Location: `ios/App/App/GoogleService-Info.plist`

### App Store Connect API

- **`APP_STORE_CONNECT_API_KEY_ID`** (Required for TestFlight)
  - API Key ID from App Store Connect
  - https://appstoreconnect.apple.com/access/api

- **`APP_STORE_CONNECT_ISSUER_ID`** (Required for TestFlight)
  - Issuer ID from App Store Connect

- **`APP_STORE_CONNECT_API_KEY_CONTENT`** (Required for TestFlight)
  - Base64 encoded .p8 API key file
  - Generate: `base64 -i AuthKey_XXXXX.p8 | pbcopy`

### Fastlane

- **`FASTLANE_USER`** (Optional)
  - Apple ID email for App Store Connect

- **`FASTLANE_PASSWORD`** (Optional)
  - Apple ID password (use app-specific password)

- **`FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD`** (Optional)
  - App-specific password for Apple ID
  - Generate: https://appleid.apple.com/account/manage

- **`MATCH_PASSWORD`** (Optional, if using Fastlane Match)
  - Password for Fastlane Match encryption

### Environment Variables

- **`APP_IDENTIFIER`**
  - Bundle identifier (e.g., `com.nuxbe.mobile`)

- **`PROVISIONING_PROFILE_SPECIFIER`**
  - Name of the provisioning profile for App Store

- **`DEV_PROVISIONING_PROFILE_SPECIFIER`**
  - Name of the provisioning profile for Development

## Android Secrets

### Keystore

- **`ANDROID_KEYSTORE_BASE64`** (Required for Release)
  - Base64 encoded release keystore file
  - Generate: `base64 -i release.keystore | pbcopy`

- **`ANDROID_KEYSTORE_PASSWORD`** (Required for Release)
  - Password for the keystore file

- **`ANDROID_KEY_PASSWORD`** (Required for Release)
  - Password for the key within the keystore

- **`ANDROID_KEY_ALIAS`** (Required for Release)
  - Alias of the key within the keystore

- **`ANDROID_DEBUG_KEYSTORE_BASE64`** (Required for Nightly)
  - Base64 encoded debug keystore file
  - Generate: `base64 -i debug.keystore | pbcopy`

### Google Services (CRITICAL for Public Repos!)

- **`ANDROID_GOOGLE_SERVICES_JSON`** (Required)
  - Content of google-services.json file (NOT base64 encoded)
  - Get from Firebase Console → Project Settings → Android App
  - **NEVER commit this file to a public repository!**
  - Location: `android/app/google-services.json`

## Setting up Secrets in GitHub

1. Go to your repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with the exact name listed above

## Generating Required Files

### iOS Distribution Certificate (.p12)

```bash
# Export from Keychain Access
1. Open Keychain Access
2. Select "My Certificates"
3. Right-click your distribution certificate
4. Export → .p12 format
5. Set a password
6. Convert to base64: base64 -i cert.p12 | pbcopy
```

### Android Keystore

```bash
# Generate new keystore
keytool -genkey -v -keystore release.keystore -alias nuxbe-mobile \
  -keyalg RSA -keysize 2048 -validity 10000

# Convert to base64
base64 -i release.keystore | pbcopy
```

### App Store Connect API Key

```bash
# 1. Create API key at https://appstoreconnect.apple.com/access/api
# 2. Download the .p8 file
# 3. Convert to base64
base64 -i AuthKey_XXXXX.p8 | pbcopy
```

## Workflow Triggers

### Release Workflow (`mobile-release.yml`)
- Triggered on: Push tags matching `v*.*.*` or `mobile-v*.*.*`
- Pre-release detection: Tags containing `alpha`, `beta`, or `rc`
- Pre-release behavior: Automatically uploads to TestFlight

### Nightly Workflow (`mobile-nightly.yml`)
- Triggered on: Push to `main` branch (only when mobile files change)
- Can also be triggered manually via GitHub Actions UI
- Builds: Development signed builds with daily version codes

## Testing the Workflows

```bash
# Test release workflow
git tag v1.0.0
git push origin v1.0.0

# Test pre-release workflow (uploads to TestFlight)
git tag v1.0.0-beta.1
git push origin v1.0.0-beta.1

# Test nightly workflow
git commit -am "Update mobile app"
git push origin main
```

## Troubleshooting

### iOS Build Fails
- Check certificate and provisioning profile validity
- Ensure bundle identifier matches provisioning profile
- Verify Xcode version compatibility

### Android Build Fails
- Check keystore password and alias
- Verify Java version (requires Java 17)
- Ensure google-services.json is valid JSON

### TestFlight Upload Fails
- Verify App Store Connect API key is valid
- Check API key permissions (needs "Admin" or "App Manager" role)
- Ensure bundle identifier is registered in App Store Connect

## Security Best Practices

1. **Never commit secrets to git**
2. **Rotate certificates and keys regularly**
3. **Use app-specific passwords for Apple ID**
4. **Restrict API key permissions to minimum required**
5. **Enable 2FA on all accounts**
6. **Review GitHub Actions logs for sensitive data leaks**
