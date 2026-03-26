package com.earlighter.whisperruntime;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "EarlighterWhisperRuntime")
public class EarlighterWhisperRuntimePlugin extends Plugin {
    @PluginMethod
    public void isReady(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", WhisperNativeBridge.isLoaded());
        call.resolve(ret);
    }

    @PluginMethod
    public void transcribeWav(PluginCall call) {
        String modelPath = call.getString("modelPath");
        String wavPath = call.getString("wavPath");
        String language = call.getString("language", "en");
        int maxLen = call.getInt("maxLen", 0);
        int threads = call.getInt("threads", 2);

        if (modelPath == null || modelPath.isEmpty()) {
            call.reject("Missing modelPath");
            return;
        }
        if (wavPath == null || wavPath.isEmpty()) {
            call.reject("Missing wavPath");
            return;
        }

        try {
            String transcript = WhisperNativeBridge.transcribeWav(modelPath, wavPath, language, maxLen, threads);
            JSObject ret = new JSObject();
            ret.put("transcript", transcript == null ? "" : transcript);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject(t.getMessage(), t);
        }
    }
}
