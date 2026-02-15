import UIKit
import WebKit
import Capacitor

class NuxbeViewController: CAPBridgeViewController {

    private let refreshControl = UIRefreshControl()

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

        setupPullToRefresh()
    }

    private func setupPullToRefresh() {
        guard let scrollView = webView?.scrollView else { return }
        refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        scrollView.refreshControl = refreshControl
    }

    @objc private func handleRefresh() {
        webView?.evaluateJavaScript("window.location.reload()") { [weak self] _, _ in
            self?.refreshControl.endRefreshing()
        }
    }
}
