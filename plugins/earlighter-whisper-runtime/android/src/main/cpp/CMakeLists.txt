cmake_minimum_required(VERSION 3.22.1)
project(earlighter_whisper_runtime)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(WHISPER_DIR ${CMAKE_CURRENT_SOURCE_DIR}/third_party/whisper.cpp)
if (NOT EXISTS ${WHISPER_DIR}/CMakeLists.txt)
    message(FATAL_ERROR "whisper.cpp source is missing. Put the full source tree into android/src/main/cpp/third_party/whisper.cpp/")
endif()

add_subdirectory(${WHISPER_DIR} ${CMAKE_CURRENT_BINARY_DIR}/whisper_build)

add_library(earlighter_whisper_runtime SHARED earlighter_whisper_jni.cpp)

target_include_directories(earlighter_whisper_runtime PRIVATE
    ${WHISPER_DIR}/include
    ${WHISPER_DIR}/ggml/include
)

target_link_libraries(earlighter_whisper_runtime
    whisper
    log
    android
)
