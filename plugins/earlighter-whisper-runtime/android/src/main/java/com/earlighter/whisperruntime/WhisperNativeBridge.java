package com.earlighter.whisperruntime;

public class WhisperNativeBridge {
    private static boolean loaded = false;

    static {
        try {
            System.loadLibrary("earlighter_whisper_runtime");
            loaded = true;
        } catch (Throwable ignored) {
            loaded = false;
        }
    }

    public static boolean isLoaded() {
        return loaded;
    }

    public static native String transcribeWav(String modelPath, String wavPath, String language, int maxLen, int threads);
}
