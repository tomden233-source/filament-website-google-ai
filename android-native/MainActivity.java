package com.filamenthub.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

// Meldet die eigenen Plugins an: FilamentBars (Farben der Systemleisten), FilamentMqtt (Drucker ohne Server), FilamentNfc (NFC-Tags).
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FilamentBarsPlugin.class);
        registerPlugin(FilamentMqttPlugin.class);
        registerPlugin(FilamentNfcPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
