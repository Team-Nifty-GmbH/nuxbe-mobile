import UIKit
import WebKit
import Capacitor

class NuxbeViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        // Enable back/forward navigation gestures (edge swipe)
        webView?.allowsBackForwardNavigationGestures = true
    }

    // Block swipe-back/forward navigation to Capacitor's local pages.
    // Without this, swiping back from the server navigates to capacitor://localhost/index.html.
    override func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.navigationType == .backForward,
           let url = navigationAction.request.url?.absoluteString,
           url.hasPrefix("capacitor://localhost") || url.hasPrefix("http://localhost") {
            decisionHandler(.cancel)
            return
        }

        super.webView(webView, decidePolicyFor: navigationAction, decisionHandler: decisionHandler)
    }
}
