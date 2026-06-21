import SwiftUI

/// 申硕英语词汇学习 — native iOS shell.
///
/// The whole app is the existing React/Vite build, bundled into the app and
/// served locally through a custom URL scheme. No network, no server: it runs
/// fully offline and the user's progress lives in the WKWebView's localStorage.
@main
struct ShenShuoVocabApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
