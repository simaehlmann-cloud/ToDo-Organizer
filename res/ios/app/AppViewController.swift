// Eigener Startbildschirm der App: wie Capacitors CAPBridgeViewController,
// meldet aber zusätzlich die Widget-Brücke an. tools/ios-setup.rb trägt
// diese Klasse in Main.storyboard ein (nur wenn das Widget mitgebaut wird).
import UIKit
import Capacitor

class AppViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetDataPlugin())
    }
}
