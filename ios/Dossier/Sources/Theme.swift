import CoreText
import SwiftUI
import UIKit

/// The design tokens from the top of the web app's src/styles.css. Monochrome only: no accent colours,
/// gradients, shadows or glows.
enum Theme {
    static let background = Color(hex: 0x000000)
    static let text = Color(hex: 0xF2F2F2)
    static let date = Color(hex: 0xFFFFFF)
    static let secondary = Color(hex: 0x8A8A8A)
    static let ghost = Color(red: 242 / 255, green: 242 / 255, blue: 242 / 255, opacity: 0.30)
    static let hairline = Color(hex: 0x262626)
    static let pressed = Color(hex: 0x161616)
    static let sheet = Color(hex: 0x0A0A0A)

    static let uiBackground = UIColor.black
    static let uiText = UIColor(red: 242 / 255, green: 242 / 255, blue: 242 / 255, alpha: 1)

    /// Sizes 10 / 13 / 15 / 17 pt, 34 pt readout.
    static let editorSize: CGFloat = 17
    static let lineHeightMultiple: CGFloat = 1.5

    /// iOS's spring-like curve, cubic-bezier(0.32, 0.72, 0, 1).
    static func ease(_ duration: Double) -> Animation { .timingCurve(0.32, 0.72, 0, 1, duration: duration) }

    /// IBM Plex Mono when its .ttf files are bundled (see ios/README.md), else the system monospaced font.
    static func mono(_ size: CGFloat, weight: UIFont.Weight = .regular) -> UIFont {
        let name = weight == .semibold ? "IBMPlexMono-SemiBold" : "IBMPlexMono-Regular"
        return UIFont(name: name, size: size) ?? .monospacedSystemFont(ofSize: size, weight: weight)
    }

    static func monoFont(_ size: CGFloat, weight: UIFont.Weight = .regular) -> Font { Font(mono(size, weight: weight)) }

    /// Registers any .ttf / .otf files bundled with the app, so they need no Info.plist list.
    static func registerFonts() {
        for ext in ["ttf", "otf"] {
            for url in Bundle.main.urls(forResourcesWithExtension: ext, subdirectory: nil) ?? [] {
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
