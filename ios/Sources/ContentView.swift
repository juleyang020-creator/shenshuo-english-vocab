import SwiftUI

struct ContentView: View {
    var body: some View {
        WebView()
            // Match the web app's page background (#f3efe6 linen) so the
            // status-bar area and any safe-area gaps blend with the content.
            .background(Color(red: 0.953, green: 0.937, blue: 0.902))
    }
}
