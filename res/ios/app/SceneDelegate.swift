// Ersetzt beim Build Capacitors SceneDelegate (Vorlage von @capacitor/ios 8.5.3)
// und ergänzt die Schnellaktionen am App-Symbol (lange drücken).
//
// Eine Schnellaktion trägt als Typ einen Link wie „todoorganizer://new-task“.
// Er geht denselben Weg wie ein Link aus dem Widget: ApplicationDelegateProxy
// → appUrlOpen in der Web-App. Beim Kaltstart erst, wenn Capacitor bereit ist.
import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        // Kaltstart über eine Schnellaktion: weiterreichen, sobald die App geladen ist
        if let item = connectionOptions.shortcutItem {
            var token: NSObjectProtocol?
            token = NotificationCenter.default.addObserver(forName: .capacitorViewDidAppear, object: nil, queue: .main) { _ in
                if let token = token { NotificationCenter.default.removeObserver(token) }
                SceneDelegate.open(item)
            }
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    // App läuft schon: Schnellaktion direkt weiterreichen
    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(SceneDelegate.open(shortcutItem))
    }

    @discardableResult
    static func open(_ item: UIApplicationShortcutItem) -> Bool {
        guard let url = URL(string: item.type), url.scheme == "todoorganizer" else { return false }
        return ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
    }
}
