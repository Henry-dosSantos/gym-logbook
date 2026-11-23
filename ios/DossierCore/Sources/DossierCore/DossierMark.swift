import Foundation

// Port of src/core/dossier-mark.ts. The Dossier mark: a D made of a bar and a half disc (flat, one ink) on a
// 100-unit box, and its launch intro. Source and approved look: design/dossier-mark. Keep the intro numbers as
// they are.

/// The D as an SVG path, with x as the centre of the whole letter (the bar's left edge is at x - 25).
public func dPath(_ x: Double = 50) -> String {
    func f(_ n: Double) -> String { jsNumber((n * 1000).rounded() / 1000) }
    let seam = x - 12.5
    return "M\(f(seam - 12.5)) 12.5H\(f(seam))A37.5 37.5 0 0 1 \(f(seam)) 87.5H\(f(seam - 12.5))Z"
}

/// The intro: the top half glides in from the left and the bottom half from the right, at full speed from the
/// first frame and slowing exponentially, fading in over the first 60 % of the trip, then locking together.
public enum Intro {
    /// How far each half starts from its place, in viewBox units.
    public static let travel: Double = 75
    /// Time constant, s: x(t) = travel * e^(-t / tau).
    public static let tau: Double = 0.12
    /// Fully opaque once this share of the trip is done.
    public static let fadeShare: Double = 0.6
    /// Snap home once closer than this (a quarter pixel at 250 px).
    public static let land: Double = 0.1
}

public struct IntroFrame: Equatable, Sendable {
    public let topX: Double
    public let bottomX: Double
    public let opacity: Double
    public let done: Bool

    public init(topX: Double, bottomX: Double, opacity: Double, done: Bool) {
        self.topX = topX
        self.bottomX = bottomX
        self.opacity = opacity
        self.done = done
    }
}

/// Where the two halves are t seconds after the intro starts (t = 0 is the first frame shown).
public func introAt(_ t: Double) -> IntroFrame {
    // The first frame counts as one step in, so the first picture is already moving.
    let x = Intro.travel * exp(-(max(0, t) + 1.0 / 60) / Intro.tau)
    let done = x < Intro.land
    let d = done ? 0 : x
    let opacity = done ? 1 : max(0, min(1, (1 - d / Intro.travel) / Intro.fadeShare))
    return IntroFrame(topX: -d, bottomX: d, opacity: opacity, done: done)
}
