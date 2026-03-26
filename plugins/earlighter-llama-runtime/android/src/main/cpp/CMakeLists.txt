cmake_minimum_required(VERSION 3.22.1)
project(earlighter_llama_runtime)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(LLAMA_DIR ${CMAKE_CURRENT_SOURCE_DIR}/third_party/llama.cpp)
if (NOT EXISTS ${LLAMA_DIR}/CMakeLists.txt)
    message(FATAL_ERROR "llama.cpp source is missing. Put the full source tree into android/src/main/cpp/third_party/llama.cpp/")
endif()

add_subdirectory(${LLAMA_DIR} ${CMAKE_CURRENT_BINARY_DIR}/llama_build)

add_library(earlighter_llama_runtime SHARED earlighter_llama_jni.cpp)

target_include_directories(earlighter_llama_runtime PRIVATE
    ${LLAMA_DIR}/include
    ${LLAMA_DIR}/ggml/include
)

target_link_libraries(earlighter_llama_runtime
    llama
    log
    android
)
