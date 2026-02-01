import UIKit
import Capacitor
import Firebase
import FirebaseMessaging

// Capacitor Notification Names Extension
extension Notification.Name {
    static let capacitorDidReceiveNotification = Notification.Name("CapacitorDidReceiveNotification")
    static let capacitorDidReceiveNotificationResponse = Notification.Name("CapacitorDidReceiveNotificationResponse")
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, MessagingDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Firebase initialisieren
        FirebaseApp.configure()

        // FCM Delegate setzen
        Messaging.messaging().delegate = self

        // WICHTIG: NICHT den UNUserNotificationCenter.delegate setzen!
        // Capacitor macht das automatisch und registriert sich selbst.
        // Wenn wir das hier setzen, überschreiben wir Capacitor.

        // Check if notification permission should be disabled (for UI testing/screenshots)
        // Check both environment variable and launch arguments for compatibility
        let disableNotificationPermission = ProcessInfo.processInfo.environment["DISABLE_NOTIFICATION_PERMISSION"] == "1" ||
                                            ProcessInfo.processInfo.arguments.contains("--disable-notification-permission")

        if !disableNotificationPermission {
            // Push Notifications registrieren
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
                print("FCM: Permission granted: \(granted)")
                if let error = error {
                    print("FCM: Error requesting authorization: \(error)")
                }
            }
            application.registerForRemoteNotifications()
        } else {
            print("FCM: Notification permission request disabled via launch argument")
        }

        // Override point for customization after application launch.
        return true
    }

    // MARK: - FCM Token Handling

    // Wird aufgerufen wenn FCM Token sich ändert
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("FCM: Token received: \(fcmToken ?? "nil")")

        guard let token = fcmToken else {
            print("FCM: Token is nil")
            return
        }

        // Token in Capacitor Preferences speichern (damit JavaScript es lesen kann)
        UserDefaults.standard.set(token, forKey: "CapacitorStorage.fcm_token")
        print("FCM: Token saved to Capacitor Preferences with key 'fcm_token'")

        // Device Name auch speichern (z.B. "Patrick's iPhone")
        let deviceName = UIDevice.current.name
        UserDefaults.standard.set(deviceName, forKey: "CapacitorStorage.device_name")
        print("FCM: Device name saved: \(deviceName)")

        // Auch das Token direkt ausgeben für Debugging
        print("FCM: ====================================")
        print("FCM: TOKEN: \(token)")
        print("FCM: DEVICE: \(deviceName)")
        print("FCM: ====================================")
    }

    // MARK: - APNs Token Handling

    // Wird aufgerufen wenn APNs Token empfangen wird
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        print("APNs: Device token received")

        // APNs Token an FCM weiterleiten - WICHTIG für FCM!
        Messaging.messaging().apnsToken = deviceToken
        print("APNs: Token forwarded to FCM")
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("APNs: Failed to register: \(error)")
    }

    // MARK: - UNUserNotificationCenterDelegate
    // ENTFERNT: Wir implementieren diese Methoden NICHT mehr hier
    // Capacitor registriert sich selbst als UNUserNotificationCenterDelegate
    // und handhabt Notifications automatisch

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
