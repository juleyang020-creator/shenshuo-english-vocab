# 申硕词汇 · iOS

The vocabulary app, wrapped as a native iOS app. It bundles the built web app
(`vocab-study-app`) inside the app and serves it locally through a custom URL
scheme, so it runs **100% offline** — no server, no network — and your learning
progress is saved in the WebView's `localStorage` on the device.

## Open & run

1. Open the project in Xcode:
   ```
   open ios/ShenShuoVocab.xcodeproj
   ```
2. Pick a simulator (e.g. *iPhone 17*) from the device menu, press **▶ Run**.

That's it for the simulator — no signing needed.

### Run on your own iPhone

1. Plug in the iPhone, select it as the run destination.
2. Project → target **ShenShuoVocab** → **Signing & Capabilities**:
   - Check **Automatically manage signing**
   - Pick your **Team** (a free personal Apple ID works)
   - If the bundle id `com.shenshuo.vocab` is taken, change it to something
     unique like `com.yourname.shenshuovocab`
3. Press **▶ Run**. First launch: on the phone go to
   *Settings → General → VPN & Device Management* and trust your developer cert.

A free Apple ID lets you run it on your own device; it just needs re-installing
every 7 days. A paid Apple Developer account ($99/yr) removes that limit and is
required to ship via TestFlight / the App Store.

## Updating the content / web app

The native shell never changes — only the bundled `web/` folder does. After you
edit anything under `vocab-study-app/`:

```
sh ios/make-web.sh      # rebuilds the web app and refreshes ios/web/
```

Then rebuild in Xcode (⌘R). The `web/` folder is the source of truth that ships
inside the `.app`.

## How it works

- `Sources/WebView.swift` — a `WKWebView` that loads `appbundle://local/index.html`.
- `Sources/BundleSchemeHandler.swift` — a `WKURLSchemeHandler` that serves files
  out of the bundled `web/` directory. Using a custom scheme (instead of
  `file://`) gives the page a real origin, so `fetch('/data/vocab.json')`,
  absolute asset paths, and `localStorage` all work.
- A document-start user script sets `documentElement.dataset.served = 'true'` so
  the SPA renders (its web/Windows build hides `#root` until it detects a served
  origin).
- External links (e.g. the etymonline link) open in Safari instead of replacing
  the app.

## Regenerating the Xcode project

The project is generated from `project.yml` with
[XcodeGen](https://github.com/yonsm/XcodeGen):

```
cd ios && xcodegen generate
```

Commit `project.yml`; the generated `ShenShuoVocab.xcodeproj` and `build/` are
disposable (see `.gitignore`).
