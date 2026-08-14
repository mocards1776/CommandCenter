import SwiftUI

@main
struct NLCentralStandingsApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        #if os(macOS)
        .defaultSize(width: 420, height: 520)
        .windowResizability(.contentSize)
        #endif
    }
}
