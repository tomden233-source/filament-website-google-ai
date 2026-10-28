package com.filamenthub.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

// Meldet das kleine Plugin FilamentBars an, damit die Web-App die Farben der Systemleisten ändern kann.
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FilamentBarsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
