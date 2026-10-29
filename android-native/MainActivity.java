package com.filamenthub.app;

import android.content.SharedPreferences;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import java.io.File;

// Meldet die eigenen Plugins an: FilamentBars (Systemleisten), FilamentMqtt (Drucker ohne Server),
// FilamentNfc (NFC-Tags), FilamentBle (Etiketten-Drucker per Bluetooth), FilamentLive (Live-Update der Oberfläche ohne neue APK),
// FilamentNotify (Meldungen aufs Handy).
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FilamentBarsPlugin.class);
        registerPlugin(FilamentMqttPlugin.class);
        registerPlugin(FilamentNfcPlugin.class);
        registerPlugin(FilamentLivePlugin.class);
        registerPlugin(FilamentBlePlugin.class);
        registerPlugin(FilamentNotifyPlugin.class);
        super.onCreate(savedInstanceState);
        loadLiveBundle();
    }

    // Neueste heruntergeladene Oberfläche laden. Schutz: ist die APK gleich neu oder neuer, oder startet die
    // Live-Version zweimal hintereinander nicht sauber (markGood fehlt), wird sie verworfen und die eingebaute genutzt.
    private void loadLiveBundle() {
        try {
            SharedPreferences p = FilamentLivePlugin.prefs(this);
            String path = p.getString("livePath", null);
            String liveVersion = p.getString("liveVersion", "");
            if (path == null) return;
            String apkVersion = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            boolean apkNewer = apkVersion != null && !FilamentLivePlugin.isNewer(liveVersion, apkVersion);
            int tries = p.getInt("bootTries", 0);
            if (apkNewer || tries >= 2 || !new File(path, "index.html").exists()) {
                FilamentLivePlugin.clear(this);
                return;
            }
            p.edit().putInt("bootTries", tries + 1).apply();
            getBridge().setServerBasePath(path);
        } catch (Exception ignored) {
            // eingebaute Oberfläche bleibt aktiv
        }
    }
}
