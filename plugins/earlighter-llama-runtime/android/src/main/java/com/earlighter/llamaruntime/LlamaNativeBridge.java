package com.earlighter.llamaruntime;

public class LlamaNativeBridge {
    private static boolean loaded = false;

    static {
        try {
            System.loadLibrary("earlighter_llama_runtime");
            loaded = true;
        } catch (Throwable ignored) {
            loaded = false;
        }
    }

    public static boolean isLoaded() {
        return loaded;
    }

    public static native String processText(String modelPath, String input, String mode, int nCtx, int threads);
}
