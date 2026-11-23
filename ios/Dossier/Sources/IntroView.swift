import DossierCore
import SwiftUI

/// The Dossier launch intro over black, then a fade. The motion comes from DossierCore's `introAt` (the approved
/// numbers in design/dossier-mark); this view only draws it. Under Reduce Motion the finished mark shows for
/// 0.4 s and goes, as on the web.
struct IntroView: View {
    let onFinish: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date()
    @State private var opacity = 1.0

    private static let size: CGFloat = 160
    private static let fade = 0.24
    private static let still = 0.4

    var body: some View {
        TimelineView(.animation(paused: opacity < 1)) { context in
            let t = reduceMotion ? Double.infinity : context.date.timeIntervalSince(start)
            DossierMarkFrame(frame: introAt(t))
                .frame(width: Self.size, height: Self.size)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
        .opacity(opacity)
        .accessibilityHidden(true)
        .task {
            start = Date()
            if reduceMotion {
                try? await Task.sleep(for: .seconds(Self.still))
                onFinish()
                return
            }
            // introAt reports done (landed within a quarter pixel) at 0.78 s.
            while !introAt(Date().timeIntervalSince(start)).done {
                try? await Task.sleep(for: .milliseconds(16))
            }
            withAnimation(Theme.ease(Self.fade)) { opacity = 0 }
            try? await Task.sleep(for: .seconds(Self.fade))
            onFinish()
        }
    }
}

/// One frame of the intro: the D clipped above and below its middle, each half shifted sideways.
struct DossierMarkFrame: View {
    let frame: IntroFrame

    /// The D in its 100-unit box: a bar from x 25 to 37.5 and the right half of a disc centred at (37.5, 50).
    /// Built from shapes rather than the SVG arc so the result does not depend on arc direction conventions.
    static let mark: Path = {
        let bar = Path(CGRect(x: 25, y: 12.5, width: 12.5, height: 75))
        let disc = Path(ellipseIn: CGRect(x: 0, y: 12.5, width: 75, height: 75))
            .intersection(Path(CGRect(x: 37.5, y: 0, width: 62.5, height: 100)))
        return bar.union(disc)
    }()

    static let top = mark.intersection(Path(CGRect(x: -100, y: 0, width: 300, height: 50)))
    static let bottom = mark.intersection(Path(CGRect(x: -100, y: 50, width: 300, height: 50)))

    var body: some View {
        Canvas { context, size in
            context.scaleBy(x: size.width / 100, y: size.height / 100)
            let ink = GraphicsContext.Shading.color(Theme.text.opacity(frame.opacity))
            context.fill(Self.top.offsetBy(dx: frame.topX, dy: 0), with: ink)
            context.fill(Self.bottom.offsetBy(dx: frame.bottomX, dy: 0), with: ink)
        }
    }
}
