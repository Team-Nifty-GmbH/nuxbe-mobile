import UIKit
import WebKit
import Capacitor

class NuxbeViewController: CAPBridgeViewController {
    private let navigationProxy = NavigationDelegateProxy()

    override func viewDidLoad() {
        super.viewDidLoad()

        // Enable back/forward navigation gestures (edge swipe)
        webView?.allowsBackForwardNavigationGestures = true

        // Intercept navigation to block swipe-back to Capacitor's local pages
        navigationProxy.originalDelegate = webView?.navigationDelegate
        webView?.navigationDelegate = navigationProxy
    }
}

/// Proxy that intercepts WKNavigationDelegate calls to block back/forward
/// navigation to Capacitor's local pages while forwarding everything else
/// to the original Capacitor delegate via Objective-C message forwarding.
class NavigationDelegateProxy: NSObject, WKNavigationDelegate {
    weak var originalDelegate: WKNavigationDelegate?

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.navigationType == .backForward,
           let url = navigationAction.request.url?.absoluteString,
           url.hasPrefix("capacitor://localhost") || url.hasPrefix("http://localhost") {
            decisionHandler(.cancel)
            return
        }

        if let original = originalDelegate {
            original.webView?(webView, decidePolicyFor: navigationAction, decisionHandler: decisionHandler)
        } else {
            decisionHandler(.allow)
        }
    }

    override func responds(to aSelector: Selector!) -> Bool {
        return super.responds(to: aSelector) || (originalDelegate?.responds(to: aSelector) ?? false)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        if let delegate = originalDelegate, delegate.responds(to: aSelector) {
            return delegate
        }
        return super.forwardingTarget(for: aSelector)
    }
}
