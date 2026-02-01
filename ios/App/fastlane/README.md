fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios build

```sh
[bundle exec] fastlane ios build
```

Build production IPA without uploading

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Build and upload to TestFlight

### ios build_development

```sh
[bundle exec] fastlane ios build_development
```

Build development IPA for nightly builds

### ios sync_profiles

```sh
[bundle exec] fastlane ios sync_profiles
```

Download provisioning profiles

### ios add_device

```sh
[bundle exec] fastlane ios add_device
```

Register new device

### ios screenshots

```sh
[bundle exec] fastlane ios screenshots
```

Take App Store screenshots

### ios upload_screenshots

```sh
[bundle exec] fastlane ios upload_screenshots
```

Upload screenshots to App Store Connect

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
