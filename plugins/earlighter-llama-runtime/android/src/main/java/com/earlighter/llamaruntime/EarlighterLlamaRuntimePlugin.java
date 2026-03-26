package com.earlighter.llamaruntime;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "EarlighterLlamaRuntime")
public class EarlighterLlamaRuntimePlugin extends Plugin {
    @PluginMethod
    public void isReady(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", LlamaNativeBridge.isLoaded());
        call.resolve(ret);
    }

    @PluginMethod
    public void processText(PluginCall call) {
        String modelPath = call.getString("modelPath");
        String input = call.getString("input", "");
        String mode = call.getString("mode", "verbatim");
        int nCtx = call.getInt("nCtx", 1024);
        int threads = call.getInt("threads", 2);

        if (modelPath == null || modelPath.isEmpty()) {
            call.reject("Missing modelPath");
            return;
        }

        try {
            String text = LlamaNativeBridge.processText(modelPath, input, mode, nCtx, threads);
            JSObject ret = new JSObject();
            ret.put("text", text == null ? "" : text);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject(t.getMessage(), t);
        }
    }
}
