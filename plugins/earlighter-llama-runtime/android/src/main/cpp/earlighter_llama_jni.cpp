#include <jni.h>
#include <string>
#include <vector>
#include <sstream>
#include <algorithm>

#include "llama.h"

static std::string jstring_to_string(JNIEnv *env, jstring value) {
    if (!value) return std::string();
    const char *chars = env->GetStringUTFChars(value, nullptr);
    std::string out = chars ? chars : "";
    if (chars) env->ReleaseStringUTFChars(value, chars);
    return out;
}

static std::string sanitize_line(const std::string &s) {
    std::string out = s;
    while (!out.empty() && (out.back() == '
' || out.back() == '' || out.back() == ' ')) out.pop_back();
    return out;
}

extern "C"
JNIEXPORT jstring JNICALL
Java_com_earlighter_llamaruntime_LlamaNativeBridge_processText(JNIEnv *env, jclass,
                                                               jstring modelPath,
                                                               jstring input,
                                                               jstring mode,
                                                               jint nCtx,
                                                               jint threads) {
    std::string model_path = jstring_to_string(env, modelPath);
    std::string text = jstring_to_string(env, input);
    std::string mode_str = jstring_to_string(env, mode);

    llama_backend_init();
    llama_model_params mparams = llama_model_default_params();
    llama_model *model = llama_model_load_from_file(model_path.c_str(), mparams);
    if (!model) {
        llama_backend_free();
        return env->NewStringUTF("");
    }

    llama_context_params cparams = llama_context_default_params();
    cparams.n_ctx = nCtx > 0 ? (uint32_t)nCtx : 1024;
    cparams.n_threads = threads > 0 ? (uint32_t)threads : 2;
    llama_context *ctx = llama_init_from_model(model, cparams);
    if (!ctx) {
        llama_model_free(model);
        llama_backend_free();
        return env->NewStringUTF("");
    }

    std::ostringstream prompt;
    if (mode_str == "summary") {
        prompt << "Summarize the following transcript into one concise bullet point. Ignore broken sentence starts or endings. Transcript: " << text;
    } else {
        prompt << "Clean the following transcript. Keep all complete thoughts. Remove broken sentence starts and broken sentence endings. Return plain cleaned sentences only. Transcript: " << text;
    }
    std::string prompt_text = prompt.str();

    std::vector<llama_token> tokens(prompt_text.size() + 256);
    int n_tokens = llama_tokenize(model, prompt_text.c_str(), (int32_t)prompt_text.size(), tokens.data(), (int32_t)tokens.size(), true, false);
    if (n_tokens < 0) {
        llama_free(ctx);
        llama_model_free(model);
        llama_backend_free();
        return env->NewStringUTF("");
    }
    tokens.resize((size_t)n_tokens);

    llama_batch batch = llama_batch_get_one(tokens.data(), (int32_t)tokens.size());
    if (llama_decode(ctx, batch) != 0) {
        llama_free(ctx);
        llama_model_free(model);
        llama_backend_free();
        return env->NewStringUTF("");
    }

    std::string output;
    const int max_predict = mode_str == "summary" ? 96 : 192;
    for (int i = 0; i < max_predict; ++i) {
        const float *logits = llama_get_logits_ith(ctx, batch.n_tokens - 1);
        if (!logits) break;
        llama_token token = llama_sampler_sample_token_greedy(logits, model);
        if (token == llama_token_eos(model)) break;
        char piece[16];
        int n = llama_token_to_piece(model, token, piece, sizeof(piece), 0, true);
        if (n > 0) output.append(piece, piece + n);
        llama_token next[] = { token };
        batch = llama_batch_get_one(next, 1);
        if (llama_decode(ctx, batch) != 0) break;
    }

    output = sanitize_line(output);
    llama_free(ctx);
    llama_model_free(model);
    llama_backend_free();
    return env->NewStringUTF(output.c_str());
}
