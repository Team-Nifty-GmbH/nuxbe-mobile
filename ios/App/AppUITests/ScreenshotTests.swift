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

    /// Runs first (alphabetical order) to grant notification permission on a fresh simulator.
    func test01_GrantNotificationPermission() throws {
        app.launch()

        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let allowButtonEN = springboard.buttons["Allow"]
        let allowButtonDE = springboard.buttons["Erlauben"]
        if allowButtonEN.waitForExistence(timeout: 5) {
            allowButtonEN.tap()
        } else if allowButtonDE.waitForExistence(timeout: 2) {
            allowButtonDE.tap()
        }

        app.terminate()
    }

    /// Runs second — notification permission is already granted, so no dialog on splash.
    func test02_TakeScreenshots() throws {
        app.launchArguments += ["--screenshot-mode"]
        app.launch()

        // Screenshot 1: Splash Screen — no dialog because permission was granted in test01.
        snapshot("01_SplashScreen", waitForLoadingIndicator: false)

        // Wait for app to fully load (setup screen)
        sleep(3)

        // Screenshot 2: Server Selection Screen (empty state)
        snapshot("02_ServerSelection", waitForLoadingIndicator: false)

        // Find and interact with the server URL input field
        let webView = app.webViews.firstMatch
        if webView.waitForExistence(timeout: 5) {
            let textField = webView.textFields.firstMatch
            if textField.waitForExistence(timeout: 3) {
                textField.tap()
                sleep(1)
                textField.typeText("demo.nuxbe.com")
                sleep(1)
                snapshot("03_ServerInput", waitForLoadingIndicator: false)
            } else {
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
