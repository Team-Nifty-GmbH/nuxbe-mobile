//
//  ScreenshotTests.swift
//  AppUITests
//
//  Screenshots for App Store
//

import XCTest

@MainActor
final class ScreenshotTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        setupSnapshot(app)
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testTakeScreenshots() throws {
        // Configure launch environment to skip notification permission request
        // Using launchEnvironment instead of launchArguments for better compatibility
        app.launchEnvironment["DISABLE_NOTIFICATION_PERMISSION"] = "1"
        app.launch()

        // Screenshot 1: Splash Screen - capture immediately after launch
        // The splash screen shows for 2 seconds (configured in capacitor.config.ts)
        // Capture quickly before any system dialogs appear
        snapshot("01_SplashScreen", waitForLoadingIndicator: false)

        // Handle notification permission dialog if it appears (supports EN and DE)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        // Wait a brief moment for the dialog to appear
        sleep(1)
        // Try English first, then German
        let allowButtonEN = springboard.buttons["Allow"]
        let allowButtonDE = springboard.buttons["Erlauben"]
        if allowButtonEN.waitForExistence(timeout: 3) {
            allowButtonEN.tap()
        } else if allowButtonDE.waitForExistence(timeout: 1) {
            allowButtonDE.tap()
        }

        // Wait for app to fully load (app goes directly to server selection screen)
        sleep(3)

        // Screenshot 2: Server Selection Screen (empty state)
        snapshot("02_ServerSelection", waitForLoadingIndicator: false)

        // Find and interact with the server URL input field
        // WebViews have their text fields accessible via otherElements
        let webView = app.webViews.firstMatch
        if webView.waitForExistence(timeout: 5) {
            // Try to find text field in WebView
            let textField = webView.textFields.firstMatch
            if textField.waitForExistence(timeout: 3) {
                textField.tap()
                sleep(1)
                textField.typeText("demo.nuxbe.com")
                sleep(1)
                // Screenshot 3: Server URL entered
                snapshot("03_ServerInput", waitForLoadingIndicator: false)
            } else {
                // Alternative: Try coordinate-based tap on input field area
                // Input is roughly in the center of the screen
                let coordinate = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.45))
                coordinate.tap()
                sleep(1)
                app.typeText("demo.nuxbe.com")
                sleep(1)
                snapshot("03_ServerInput", waitForLoadingIndicator: false)
            }
        }
    }
}
