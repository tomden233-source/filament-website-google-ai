package com.filamenthub.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.BluetoothStatusCodes;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

// Bluetooth-LE-Brücke für den Etiketten-Drucker (Supvan E10): suchen, verbinden, Bytes senden/empfangen.
// Das Drucker-Protokoll selbst läuft in der Web-App (src/utils/supvan), hier ist nur die Leitung.
// Ereignisse: "data" { data: base64 }, "disconnect".
@CapacitorPlugin(
        name = "FilamentBle",
        permissions = {
            @Permission(alias = "ble31", strings = {Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT}),
            @Permission(alias = "bleLegacy", strings = {Manifest.permission.ACCESS_FINE_LOCATION})
        })
public class FilamentBlePlugin extends Plugin {

    private static final UUID CCC = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    // Bekannte GATT-Layouts der Supvan-Drucker: Dienst, Benachrichtigung, Schreiben
    private static final String[][] LAYOUTS = {
        {"0000fee7-0000-1000-8000-00805f9b34fb", "0000fec1-0000-1000-8000-00805f9b34fb", "0000fec1-0000-1000-8000-00805f9b34fb"},
        {"0000e0ff-3c17-d293-8e48-14fe2e4da212", "0000ffe1-0000-1000-8000-00805f9b34fb", "0000ffe9-0000-1000-8000-00805f9b34fb"},
        {"0000ff00-0000-1000-8000-00805f9b34fb", "0000ff01-0000-1000-8000-00805f9b34fb", "0000ff02-0000-1000-8000-00805f9b34fb"}
    };

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService writer = Executors.newSingleThreadExecutor();

    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic writeChar;
    private BluetoothGattCharacteristic notifyChar;
    private int writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT;
    private int chunk = 20;
    private PluginCall connectCall;
    private final AtomicBoolean discovering = new AtomicBoolean(false);
    private volatile CountDownLatch writeLatch;
    private volatile boolean writeOk;

    private BluetoothAdapter adapter() {
        BluetoothManager m = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return m != null ? m.getAdapter() : null;
    }

    private String alias() {
        return Build.VERSION.SDK_INT >= 31 ? "ble31" : "bleLegacy";
    }

    private boolean hasAccess() {
        return getPermissionState(alias()) == PermissionState.GRANTED;
    }

    @PluginMethod
    public void status(PluginCall call) {
        BluetoothAdapter a = adapter();
        JSObject r = new JSObject();
        r.put("available", a != null);
        r.put("enabled", a != null && a.isEnabled());
        r.put("granted", hasAccess());
        call.resolve(r);
    }

    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (hasAccess()) {
            JSObject r = new JSObject();
            r.put("granted", true);
            call.resolve(r);
            return;
        }
        requestPermissionForAlias(alias(), call, "accessCallback");
    }

    @PermissionCallback
    private void accessCallback(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", hasAccess());
        call.resolve(r);
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void scan(final PluginCall call) {
        final BluetoothAdapter a = adapter();
        if (a == null || !a.isEnabled()) {
            call.reject("Bluetooth ist aus");
            return;
        }
        if (!hasAccess()) {
            call.reject("Bluetooth-Berechtigung fehlt");
            return;
        }
        final android.bluetooth.le.BluetoothLeScanner scanner = a.getBluetoothLeScanner();
        if (scanner == null) {
            call.reject("Bluetooth-Suche nicht möglich");
            return;
        }
        final int ms = call.getInt("ms", 6000);
        final Map<String, JSObject> found = new LinkedHashMap<>();
        final ScanCallback cb = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                try {
                    BluetoothDevice d = result.getDevice();
                    ScanRecord rec = result.getScanRecord();
                    String name = rec != null ? rec.getDeviceName() : null;
                    if (name == null) name = d.getName();
                    boolean likely = false;
                    if (name != null) {
                        String n = name.toLowerCase();
                        likely = n.startsWith("t0") || n.startsWith("e1") || n.startsWith("supvan") || n.startsWith("katasymbol");
                    }
                    if (rec != null && rec.getServiceUuids() != null) {
                        for (ParcelUuid u : rec.getServiceUuids()) {
                            String s = u.toString().toLowerCase();
                            if (s.startsWith("0000e0ff") || s.startsWith("0000fee7")) likely = true;
                        }
                    }
                    JSObject o = new JSObject();
                    o.put("address", d.getAddress());
                    o.put("name", name != null ? name : "(ohne Name)");
                    o.put("rssi", result.getRssi());
                    o.put("likely", likely);
                    found.put(d.getAddress(), o);
                } catch (Exception ignored) {
                }
            }
        };
        try {
            scanner.startScan(null, new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), cb);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
            return;
        }
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                try {
                    scanner.stopScan(cb);
                } catch (Exception ignored) {
                }
                JSArray arr = new JSArray();
                for (JSObject o : found.values()) arr.put(o);
                JSObject r = new JSObject();
                r.put("devices", arr);
                call.resolve(r);
            }
        }, ms);
    }

    @SuppressLint("MissingPermission")
    private void closeGatt() {
        BluetoothGatt g = gatt;
        gatt = null;
        writeChar = null;
        notifyChar = null;
        if (g != null) {
            try {
                g.disconnect();
            } catch (Exception ignored) {
            }
            try {
                g.close();
            } catch (Exception ignored) {
            }
        }
    }

    private void failConnect(String msg) {
        PluginCall c = connectCall;
        connectCall = null;
        closeGatt();
        if (c != null) c.reject(msg);
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void connect(final PluginCall call) {
        final String address = call.getString("address");
        BluetoothAdapter a = adapter();
        if (address == null || a == null || !a.isEnabled()) {
            call.reject("Bluetooth ist aus oder keine Adresse");
            return;
        }
        if (!hasAccess()) {
            call.reject("Bluetooth-Berechtigung fehlt");
            return;
        }
        try {
            closeGatt();
            connectCall = call;
            discovering.set(false);
            BluetoothDevice dev = a.getRemoteDevice(address);
            gatt = dev.connectGatt(getContext(), false, callback, BluetoothDevice.TRANSPORT_LE);
            handler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    if (connectCall == call) failConnect("Zeitüberschreitung. Ist der Drucker an und in der Nähe?");
                }
            }, 12000);
        } catch (Exception e) {
            failConnect(String.valueOf(e.getMessage()));
        }
    }

    @SuppressLint("MissingPermission")
    private void startDiscovery(BluetoothGatt g) {
        if (discovering.compareAndSet(false, true)) {
            if (!g.discoverServices()) failConnect("Dienste konnten nicht gelesen werden");
        }
    }

    private final BluetoothGattCallback callback = new BluetoothGattCallback() {
        @SuppressLint("MissingPermission")
        @Override
        public void onConnectionStateChange(final BluetoothGatt g, int status, int newState) {
            if (gatt != null && g != gatt) return;
            if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                boolean ok = false;
                try {
                    ok = g.requestMtu(247);
                } catch (Exception ignored) {
                }
                if (!ok) {
                    startDiscovery(g);
                } else {
                    handler.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            startDiscovery(g);
                        }
                    }, 1500);
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                if (connectCall != null) {
                    failConnect("Verbindung fehlgeschlagen (Status " + status + ")");
                } else if (gatt != null) {
                    closeGatt();
                    notifyListeners("disconnect", new JSObject());
                }
            }
        }

        @Override
        public void onMtuChanged(BluetoothGatt g, int mtu, int status) {
            chunk = status == BluetoothGatt.GATT_SUCCESS ? Math.max(20, Math.min(128, mtu - 3)) : 20;
            startDiscovery(g);
        }

        @SuppressLint("MissingPermission")
        @SuppressWarnings("deprecation")
        @Override
        public void onServicesDiscovered(BluetoothGatt g, int status) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                failConnect("Dienste konnten nicht gelesen werden (Status " + status + ")");
                return;
            }
            for (String[] l : LAYOUTS) {
                BluetoothGattService s = g.getService(UUID.fromString(l[0]));
                if (s == null) continue;
                BluetoothGattCharacteristic n = s.getCharacteristic(UUID.fromString(l[1]));
                BluetoothGattCharacteristic w = s.getCharacteristic(UUID.fromString(l[2]));
                if (n == null || w == null) continue;
                notifyChar = n;
                writeChar = w;
                writeType = (w.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0
                        ? BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                        : BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE;
                g.setCharacteristicNotification(n, true);
                BluetoothGattDescriptor d = n.getDescriptor(CCC);
                if (d == null) {
                    finishConnect(g);
                    return;
                }
                d.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                if (!g.writeDescriptor(d)) failConnect("Benachrichtigungen konnten nicht aktiviert werden");
                return;
            }
            StringBuilder sb = new StringBuilder();
            for (BluetoothGattService s : g.getServices()) sb.append(s.getUuid().toString().substring(0, 8)).append(' ');
            failConnect("Kein bekannter Supvan-Dienst gefunden: " + sb.toString().trim());
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor descriptor, int status) {
            if (connectCall == null) return;
            if (status == BluetoothGatt.GATT_SUCCESS) finishConnect(g);
            else failConnect("Benachrichtigungen konnten nicht aktiviert werden (Status " + status + ")");
        }

        @Override
        public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic c, int status) {
            writeOk = status == BluetoothGatt.GATT_SUCCESS;
            CountDownLatch l = writeLatch;
            if (l != null) l.countDown();
        }

        @SuppressWarnings("deprecation")
        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c) {
            emitData(c.getValue());
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c, byte[] value) {
            emitData(value);
        }
    };

    @SuppressLint("MissingPermission")
    private void finishConnect(BluetoothGatt g) {
        PluginCall c = connectCall;
        connectCall = null;
        if (c == null) return;
        JSObject r = new JSObject();
        String name = null;
        try {
            name = g.getDevice().getName();
        } catch (Exception ignored) {
        }
        r.put("name", name != null ? name : "Drucker");
        r.put("chunk", chunk);
        c.resolve(r);
    }

    private void emitData(byte[] v) {
        if (v == null) return;
        JSObject o = new JSObject();
        o.put("data", Base64.encodeToString(v, Base64.NO_WRAP));
        notifyListeners("data", o);
    }

    @SuppressLint("MissingPermission")
    @SuppressWarnings("deprecation")
    private boolean writeChunk(byte[] part) throws InterruptedException {
        BluetoothGatt g = gatt;
        BluetoothGattCharacteristic c = writeChar;
        if (g == null || c == null) return false;
        writeLatch = new CountDownLatch(1);
        writeOk = false;
        boolean started;
        if (Build.VERSION.SDK_INT >= 33) {
            started = g.writeCharacteristic(c, part, writeType) == BluetoothStatusCodes.SUCCESS;
        } else {
            c.setWriteType(writeType);
            c.setValue(part);
            started = g.writeCharacteristic(c);
        }
        if (!started) return false;
        return writeLatch.await(3, TimeUnit.SECONDS) && writeOk;
    }

    @PluginMethod
    public void write(final PluginCall call) {
        final byte[] data = Base64.decode(call.getString("data", ""), Base64.DEFAULT);
        final int delay = call.getInt("delay", 10);
        final int size = Math.max(20, call.getInt("chunk", chunk));
        writer.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    for (int off = 0; off < data.length; off += size) {
                        if (off > 0) Thread.sleep(delay);
                        byte[] part = Arrays.copyOfRange(data, off, Math.min(data.length, off + size));
                        if (!writeChunk(part)) {
                            call.reject("Senden an den Drucker fehlgeschlagen");
                            return;
                        }
                    }
                    call.resolve();
                } catch (Exception e) {
                    call.reject(String.valueOf(e.getMessage()));
                }
            }
        });
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        connectCall = null;
        closeGatt();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        closeGatt();
        writer.shutdownNow();
        super.handleOnDestroy();
    }
}
