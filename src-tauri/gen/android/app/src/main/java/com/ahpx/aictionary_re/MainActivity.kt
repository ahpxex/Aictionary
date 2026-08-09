package com.ahpx.aictionary_re

import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * The activity runs edge-to-edge, which is not optional on API 35+: the webview
 * is laid out behind the status and navigation bars. Chromium does not fold the
 * system bars into `env(safe-area-inset-*)` on Android - that only ever reports
 * a display cutout - so the measurements are handed to the web layer instead,
 * which decides what to pad and what to let run under the bars.
 *
 * Both directions are wired on purpose. The listener pushes, so rotation, a
 * keyboard opening or a cutout change land immediately; the JavaScript
 * interface lets the page pull, because the first inset dispatch usually
 * happens before there is a document to receive it, and a dev-server reload
 * would otherwise drop the values on the floor.
 */
class MainActivity : TauriActivity() {
  private var insets = Insets(0f, 0f, 0f, 0f)

  private data class Insets(
    val top: Float,
    val right: Float,
    val bottom: Float,
    val left: Float,
  ) {
    fun toJson() = """{"top":$top,"right":$right,"bottom":$bottom,"left":$left}"""
  }

  /**
   * The web layer's handle on the Android host. Its mere presence is also how
   * the frontend knows it is running on a phone rather than a desktop window
   * that happens to be narrow, which decides whether platform-only settings
   * such as the tray icon and login item are worth showing at all.
   */
  private inner class AndroidHost {
    @JavascriptInterface
    fun insets(): String = insets.toJson()
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    webView.addJavascriptInterface(AndroidHost(), "AndroidHost")

    ViewCompat.setOnApplyWindowInsetsListener(webView) { view, windowInsets ->
      val bars = windowInsets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      // CSS pixels, not device pixels: the webview reports layout in the
      // former and the values are consumed as CSS lengths.
      val density = view.resources.displayMetrics.density
      insets = Insets(
        top = bars.top / density,
        right = bars.right / density,
        bottom = bars.bottom / density,
        left = bars.left / density,
      )

      webView.evaluateJavascript(
        "window.dispatchEvent(new CustomEvent('android-insets',{detail:${insets.toJson()}}))",
        null,
      )

      windowInsets
    }
  }
}
