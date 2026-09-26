package com.alexkrewson.distillery;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before super.onCreate builds the bridge.
        registerPlugin(BackgroundWorkPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
