#include <jni.h>
#include <string>
#include <vector>
#include <fstream>
#include <sstream>
#include <algorithm>
#include <cstdint>
#include <cstring>

#include "whisper.h"

static std::string jstring_to_string(JNIEnv *env, jstring value) {
    if (!value) return std::string();
    const char *chars = env->GetStringUTFChars(value, nullptr);
    std::string out = chars ? chars : "";
    if (chars) env->ReleaseStringUTFChars(value, chars);
    return out;
}

static bool read_wav_mono_f32(const std::string &path, std::vector<float> &pcm) {
    std::ifstream in(path, std::ios::binary);
    if (!in) return false;
    std::vector<uint8_t> data((std::istreambuf_iterator<char>(in)), {});
    if (data.size() < 44) return false;
    if (std::memcmp(data.data(), "RIFF", 4) != 0 || std::memcmp(data.data() + 8, "WAVE", 4) != 0) return false;

    uint16_t audio_format = 0;
    uint16_t channels = 0;
    uint32_t sample_rate = 0;
    uint16_t bits_per_sample = 0;
    size_t data_offset = 0;
    size_t data_size = 0;

    size_t off = 12;
    while (off + 8 <= data.size()) {
        char chunk_id[5] = {0,0,0,0,0};
        std::memcpy(chunk_id, data.data() + off, 4);
        uint32_t chunk_size = *reinterpret_cast<uint32_t*>(data.data() + off + 4);
        size_t chunk_data = off + 8;
        if (std::strncmp(chunk_id, "fmt ", 4) == 0 && chunk_data + 16 <= data.size()) {
            audio_format = *reinterpret_cast<uint16_t*>(data.data() + chunk_data + 0);
            channels = *reinterpret_cast<uint16_t*>(data.data() + chunk_data + 2);
            sample_rate = *reinterpret_cast<uint32_t*>(data.data() + chunk_data + 4);
            bits_per_sample = *reinterpret_cast<uint16_t*>(data.data() + chunk_data + 14);
        } else if (std::strncmp(chunk_id, "data", 4) == 0) {
            data_offset = chunk_data;
            data_size = std::min<size_t>(chunk_size, data.size() - chunk_data);
            break;
        }
        off = chunk_data + chunk_size + (chunk_size % 2);
    }

    if (!data_offset || audio_format != 1 || bits_per_sample != 16 || sample_rate != 16000 || (channels != 1 && channels != 2)) {
        return false;
    }

    size_t samples = data_size / sizeof(int16_t) / channels;
    pcm.resize(samples);
    const int16_t *src = reinterpret_cast<const int16_t*>(data.data() + data_offset);
    for (size_t i = 0; i < samples; ++i) {
        int sample = 0;
        for (int ch = 0; ch < channels; ++ch) sample += src[i * channels + ch];
        float f = static_cast<float>(sample) / static_cast<float>(channels) / 32768.0f;
        pcm[i] = std::max(-1.0f, std::min(1.0f, f));
    }
    return true;
}

extern "C"
JNIEXPORT jstring JNICALL
Java_com_earlighter_whisperruntime_WhisperNativeBridge_transcribeWav(JNIEnv *env, jclass,
                                                                     jstring modelPath,
                                                                     jstring wavPath,
                                                                     jstring language,
                                                                     jint maxLen,
                                                                     jint threads) {
    std::string model_path = jstring_to_string(env, modelPath);
    std::string wav_path = jstring_to_string(env, wavPath);
    std::string lang = jstring_to_string(env, language);
    if (lang.empty()) lang = "en";

    std::vector<float> pcm;
    if (!read_wav_mono_f32(wav_path, pcm)) {
        return env->NewStringUTF("");
    }

    whisper_context_params cparams = whisper_context_default_params();
    struct whisper_context *ctx = whisper_init_from_file_with_params(model_path.c_str(), cparams);
    if (!ctx) {
        return env->NewStringUTF("");
    }

    whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    params.print_progress = false;
    params.print_realtime = false;
    params.print_timestamps = false;
    params.print_special = false;
    params.translate = false;
    params.language = lang.c_str();
    params.n_threads = threads > 0 ? threads : 2;
    if (maxLen > 0) params.max_len = maxLen;

    int rc = whisper_full(ctx, params, pcm.data(), (int)pcm.size());
    std::string out;
    if (rc == 0) {
        const int n = whisper_full_n_segments(ctx);
        std::ostringstream oss;
        for (int i = 0; i < n; ++i) {
            const char *txt = whisper_full_get_segment_text(ctx, i);
            if (txt && txt[0]) {
                if (!out.empty()) oss << ' ';
                oss << txt;
            }
        }
        out = oss.str();
    }

    whisper_free(ctx);
    return env->NewStringUTF(out.c_str());
}
