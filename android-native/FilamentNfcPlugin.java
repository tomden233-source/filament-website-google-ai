package com.filamenthub.app;

import android.app.Activity;
import android.nfc.FormatException;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.Ndef;
import android.nfc.tech.NdefFormatable;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.json.JSONArray;
import org.json.JSONObject;

// NFC-Tags lesen und beschreiben (NDEF), als Ersatz für Web NFC, das es in der Android-App (WebView) nicht gibt.
// Die Web-App ruft dieses Plugin über einen kleinen NDEFReader-Ersatz auf (src/utils/nativeNfc.ts).
@CapacitorPlugin(name = "FilamentNfc")
public class FilamentNfcPlugin extends Plugin implements NfcAdapter.ReaderCallback {

    private PluginCall pendingWrite = null;
    private boolean scanning = false;

    private NfcAdapter adapter() {
        return NfcAdapter.getDefaultAdapter(getContext());
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        NfcAdapter nfc = adapter();
        JSObject result = new JSObject();
        result.put("available", nfc != null);
        result.put("enabled", nfc != null && nfc.isEnabled());
        call.resolve(result);
    }

    @PluginMethod
    public void startScan(PluginCall call) {
        scanning = true;
        updateReaderMode();
        call.resolve();
    }

    @PluginMethod
    public void stopScan(PluginCall call) {
        scanning = false;
        updateReaderMode();
        call.resolve();
    }

    @PluginMethod
    public void write(PluginCall call) {
        if (pendingWrite != null) {
            pendingWrite.reject("Es läuft schon ein Schreibvorgang.");
        }
        call.setKeepAlive(true);
        pendingWrite = call;
        updateReaderMode();
    }

    @PluginMethod
    public void cancelWrite(PluginCall call) {
        if (pendingWrite != null) {
            pendingWrite.reject("Abgebrochen");
            pendingWrite = null;
        }
        updateReaderMode();
        call.resolve();
    }

    private void updateReaderMode() {
        final Activity activity = getActivity();
        final NfcAdapter nfc = adapter();
        if (activity == null || nfc == null) return;
        final boolean needed = scanning || pendingWrite != null;
        activity.runOnUiThread(() -> {
            try {
                if (needed) {
                    nfc.enableReaderMode(
                            activity,
                            this,
                            NfcAdapter.FLAG_READER_NFC_A
                                    | NfcAdapter.FLAG_READER_NFC_B
                                    | NfcAdapter.FLAG_READER_NFC_F
                                    | NfcAdapter.FLAG_READER_NFC_V,
                            null);
                } else {
                    nfc.disableReaderMode(activity);
                }
            } catch (Exception ignored) {
            }
        });
    }

    @Override
    public void onTagDiscovered(Tag tag) {
        final PluginCall write = pendingWrite;
        if (write != null) {
            doWrite(tag, write);
        } else if (scanning) {
            doRead(tag);
        }
    }

    // ---------- Lesen ----------

    private void doRead(Tag tag) {
        JSObject event = new JSObject();
        event.put("serialNumber", serialOf(tag));
        JSArray records = new JSArray();
        Ndef ndef = Ndef.get(tag);
        try {
            if (ndef != null) {
                ndef.connect();
                NdefMessage message = ndef.getNdefMessage();
                ndef.close();
                if (message != null) {
                    for (NdefRecord record : message.getRecords()) {
                        JSObject r = toJs(record);
                        if (r != null) records.put(r);
                    }
                }
            }
            event.put("records", records);
            notifyListeners("tag", event);
        } catch (Exception e) {
            JSObject err = new JSObject();
            err.put("message", String.valueOf(e.getMessage()));
            notifyListeners("tagError", err);
        }
    }

    private JSObject toJs(NdefRecord record) {
        JSObject r = new JSObject();
        byte[] type = record.getType();
        byte[] payload = record.getPayload();
        short tnf = record.getTnf();
        if (tnf == NdefRecord.TNF_WELL_KNOWN && Arrays.equals(type, NdefRecord.RTD_TEXT) && payload.length > 0) {
            int langLength = payload[0] & 0x3F;
            boolean utf16 = (payload[0] & 0x80) != 0;
            int start = 1 + langLength;
            byte[] text = start <= payload.length ? Arrays.copyOfRange(payload, start, payload.length) : new byte[0];
            r.put("recordType", "text");
            r.put("encoding", utf16 ? "utf-16" : "utf-8");
            r.put("data", Base64.encodeToString(text, Base64.NO_WRAP));
        } else if (tnf == NdefRecord.TNF_MIME_MEDIA) {
            r.put("recordType", "mime");
            r.put("mediaType", new String(type, StandardCharsets.US_ASCII));
            r.put("data", Base64.encodeToString(payload, Base64.NO_WRAP));
        } else {
            r.put("recordType", "unknown");
            r.put("data", Base64.encodeToString(payload, Base64.NO_WRAP));
        }
        return r;
    }

    private String serialOf(Tag tag) {
        byte[] id = tag.getId();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < id.length; i++) {
            if (i > 0) sb.append(':');
            sb.append(String.format("%02x", id[i] & 0xFF));
        }
        return sb.toString();
    }

    // ---------- Schreiben ----------

    private NdefMessage buildMessage(PluginCall call) throws Exception {
        JSArray array = call.getArray("records");
        if (array == null || array.length() == 0) {
            return new NdefMessage(new NdefRecord(NdefRecord.TNF_EMPTY, null, null, null));
        }
        NdefRecord[] records = new NdefRecord[array.length()];
        for (int i = 0; i < array.length(); i++) {
            JSONObject o = array.getJSONObject(i);
            String type = o.optString("recordType", "text");
            if ("mime".equals(type)) {
                byte[] bytes = Base64.decode(o.optString("data", ""), Base64.DEFAULT);
                records[i] = NdefRecord.createMime(o.optString("mediaType", "application/octet-stream"), bytes);
            } else if ("url".equals(type)) {
                records[i] = NdefRecord.createUri(o.optString("data", ""));
            } else {
                records[i] = NdefRecord.createTextRecord(null, o.optString("data", ""));
            }
        }
        return new NdefMessage(records);
    }

    private void finishWrite(PluginCall call, String error, String serial) {
        pendingWrite = null;
        updateReaderMode();
        if (error != null) {
            call.reject(error);
        } else {
            JSObject result = new JSObject();
            result.put("serialNumber", serial);
            call.resolve(result);
        }
    }

    private void doWrite(Tag tag, PluginCall call) {
        try {
            NdefMessage message = buildMessage(call);
            Ndef ndef = Ndef.get(tag);
            if (ndef != null) {
                ndef.connect();
                try {
                    if (!ndef.isWritable()) {
                        finishWrite(call, "Der Tag ist schreibgeschützt.", null);
                        return;
                    }
                    int size = message.toByteArray().length;
                    if (ndef.getMaxSize() < size) {
                        finishWrite(call, "Der Tag ist zu klein (" + ndef.getMaxSize() + " Byte, benötigt " + size + " Byte).", null);
                        return;
                    }
                    ndef.writeNdefMessage(message);
                } finally {
                    try {
                        ndef.close();
                    } catch (Exception ignored) {
                    }
                }
                finishWrite(call, null, serialOf(tag));
                return;
            }
            NdefFormatable formatable = NdefFormatable.get(tag);
            if (formatable != null) {
                formatable.connect();
                try {
                    formatable.format(message);
                } finally {
                    try {
                        formatable.close();
                    } catch (Exception ignored) {
                    }
                }
                finishWrite(call, null, serialOf(tag));
                return;
            }
            finishWrite(call, "Dieser Tag unterstützt kein NDEF und kann nicht beschrieben werden.", null);
        } catch (FormatException e) {
            finishWrite(call, "Ungültiges Datenformat: " + e.getMessage(), null);
        } catch (Exception e) {
            finishWrite(call, "Schreiben fehlgeschlagen: " + e.getMessage(), null);
        }
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
    }
}
