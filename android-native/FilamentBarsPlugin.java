package com.filamenthub.app;

import android.graphics.Color;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Setzt Farbe von Statusleiste (oben) und Navigationsleiste (unten) und wählt helle oder dunkle Symbole passend dazu.
@CapacitorPlugin(name = "FilamentBars")
public class FilamentBarsPlugin extends Plugin {

    @PluginMethod
    public void setBars(final PluginCall call) {
        final String status = call.getString("status");
        final String nav = call.getString("nav");
        getActivity().runOnUiThread(() -> {
            try {
                Window window = getActivity().getWindow();
                WindowInsetsControllerCompat controller =
                        WindowCompat.getInsetsController(window, window.getDecorView());
                if (status != null) {
                    int color = Color.parseColor(status);
                    window.setStatusBarColor(color);
                    controller.setAppearanceLightStatusBars(isLight(color));
                }
                if (nav != null) {
                    int color = Color.parseColor(nav);
                    window.setNavigationBarColor(color);
                    controller.setAppearanceLightNavigationBars(isLight(color));
                }
                call.resolve();
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        });
    }

    private static boolean isLight(int color) {
        double luminance = (0.299 * Color.red(color) + 0.587 * Color.green(color) + 0.114 * Color.blue(color)) / 255.0;
        return luminance > 0.6;
    }
}
