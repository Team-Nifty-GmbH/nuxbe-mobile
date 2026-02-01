import UIKit
import Capacitor

class NuxbeViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        // Enable back/forward navigation gestures (edge swipe)
        webView?.allowsBackForwardNavigationGestures = true
    }
}
