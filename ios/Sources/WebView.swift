import SwiftUI
import WebKit

/// Wraps a WKWebView that loads the bundled SPA and keeps real web links out
/// of the app shell (they open in Safari instead).
struct WebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let webRoot = Bundle.main.resourceURL!
            .appendingPathComponent("web", isDirectory: true)

        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(root: webRoot),
                                   forURLScheme: BundleSchemeHandler.scheme)
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // index.html keeps #root hidden until documentElement[data-served] is
        // set (its web/Windows guard checks for http/https). Force it on at
        // document start so the React app renders under the custom scheme.
        let served = WKUserScript(
            source: "document.documentElement.dataset.served = 'true';",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true)
        config.userContentController.addUserScript(served)

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = false
        let pageBackground = UIColor(red: 0.953, green: 0.937, blue: 0.902, alpha: 1) // #f3efe6
        webView.backgroundColor = pageBackground
        webView.scrollView.backgroundColor = pageBackground

        let start = URL(string: "\(BundleSchemeHandler.scheme)://\(BundleSchemeHandler.host)/index.html")!
        webView.load(URLRequest(url: start))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        /// In-app navigation stays in the custom scheme; external links go to Safari.
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = navigationAction.request.url, isExternal(url) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        /// target="_blank" links (e.g. the etymonline link): open externally
        /// rather than spawning a nested web view.
        func webView(_ webView: WKWebView,
                     createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url, isExternal(url) {
                UIApplication.shared.open(url)
            }
            return nil
        }

        private func isExternal(_ url: URL) -> Bool {
            switch url.scheme?.lowercased() {
            case "http", "https", "mailto", "tel": return true
            default: return false
            }
        }
    }
}
