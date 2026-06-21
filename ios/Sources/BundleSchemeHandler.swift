import Foundation
import WebKit

/// Serves the bundled `web/` folder over a custom URL scheme so the SPA runs
/// from a real, stable origin (appbundle://local/). That gives us working
/// `fetch()`, `localStorage`, and absolute asset paths (`/assets/…`,
/// `/data/vocab.json`) without a network server or ATS exceptions.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "appbundle"
    static let host = "local"

    private let root: URL
    private let ioQueue = DispatchQueue(label: "vocab.scheme.io", qos: .userInitiated)
    private let lock = NSLock()
    private var stopped = Set<ObjectIdentifier>()

    init(root: URL) {
        self.root = root.standardizedFileURL
        super.init()
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let id = ObjectIdentifier(task)
        lock.lock(); stopped.remove(id); lock.unlock()

        guard let url = task.request.url else {
            fail(task, id: id, error: URLError(.badURL))
            return
        }

        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let relative = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let resolved = root.appendingPathComponent(relative).standardizedFileURL

        // Refuse anything that escapes the web root (e.g. "../../").
        guard resolved.path == root.path || resolved.path.hasPrefix(root.path + "/") else {
            respond(task, id: id, url: url, status: 404, body: Data("Forbidden".utf8),
                    contentType: "text/plain; charset=utf-8")
            return
        }

        // Read off the main thread (vocab.json is ~8.6MB), deliver back on main
        // where WebKit serializes start/stop, so the stopped-guard is reliable.
        ioQueue.async { [weak self] in
            guard let self else { return }
            let data = try? Data(contentsOf: resolved)
            DispatchQueue.main.async {
                guard let data else {
                    self.respond(task, id: id, url: url, status: 404,
                                 body: Data("Not found".utf8),
                                 contentType: "text/plain; charset=utf-8")
                    return
                }
                self.respond(task, id: id, url: url, status: 200, body: data,
                             contentType: MimeTypes.contentType(for: resolved.pathExtension))
            }
        }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        let id = ObjectIdentifier(task)
        lock.lock(); stopped.insert(id); lock.unlock()
    }

    // MARK: - Helpers

    private func isStopped(_ id: ObjectIdentifier) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return stopped.contains(id)
    }

    private func respond(_ task: WKURLSchemeTask, id: ObjectIdentifier, url: URL,
                         status: Int, body: Data, contentType: String) {
        guard !isStopped(id) else { return }
        let headers = [
            "Content-Type": contentType,
            "Content-Length": String(body.count),
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
        ]
        let response = HTTPURLResponse(url: url, statusCode: status,
                                       httpVersion: "HTTP/1.1", headerFields: headers)!
        task.didReceive(response)
        task.didReceive(body)
        task.didFinish()
    }

    private func fail(_ task: WKURLSchemeTask, id: ObjectIdentifier, error: Error) {
        guard !isStopped(id) else { return }
        task.didFailWithError(error)
    }
}
