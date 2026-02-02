import UIKit
import WebKit
import Capacitor

class NuxbeViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.allowsBackForwardNavigationGestures = true

        if ProcessInfo.processInfo.arguments.contains("--screenshot-mode") {
            let script = WKUserScript(
                source: "window.__screenshotMode = true;",
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
            webView?.configuration.userContentController.addUserScript(script)
        }
    }
}
