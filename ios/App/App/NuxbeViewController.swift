import UIKit
import WebKit
import Capacitor

class NuxbeViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        // Disable built-in back/forward gestures (they navigate to capacitor:// pages)
        webView?.allowsBackForwardNavigationGestures = false

        // Add custom edge swipe gestures that filter out capacitor:// URLs
        let swipeBack = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(handleSwipeBack(_:)))
        swipeBack.edges = .left
        webView?.addGestureRecognizer(swipeBack)

        let swipeForward = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(handleSwipeForward(_:)))
        swipeForward.edges = .right
        webView?.addGestureRecognizer(swipeForward)
    }

    @objc private func handleSwipeBack(_ gesture: UIScreenEdgePanGestureRecognizer) {
        guard gesture.state == .ended else { return }
        if let backItem = webView?.backForwardList.backItem,
           !isLocalURL(backItem.url) {
            webView?.goBack()
        }
    }

    @objc private func handleSwipeForward(_ gesture: UIScreenEdgePanGestureRecognizer) {
        guard gesture.state == .ended else { return }
        if let forwardItem = webView?.backForwardList.forwardItem,
           !isLocalURL(forwardItem.url) {
            webView?.goForward()
        }
    }

    private func isLocalURL(_ url: URL) -> Bool {
        let s = url.absoluteString
        return s.hasPrefix("capacitor://localhost") || s.hasPrefix("http://localhost")
    }
}
