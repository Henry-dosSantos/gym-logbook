import SwiftUI

@main
struct DossierApp: App {
    @StateObject private var log = LogModel()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        Theme.registerFonts()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(log)
                .preferredColorScheme(.dark)
        }
        .onChange(of: scenePhase) { _, phase in
            // Write the log out as soon as the app leaves the foreground, without waiting for the debounce.
            if phase != .active { log.saveNow() }
        }
    }
}

struct RootView: View {
    @State private var showIntro = true

    var body: some View {
        ZStack {
            EditorScreen()
            if showIntro {
                // Never blocks taps: the log underneath can be used straight away, as on the web.
                IntroView { showIntro = false }
                    .allowsHitTesting(false)
            }
        }
        .background(Theme.background)
    }
}
