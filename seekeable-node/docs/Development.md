# Development Guide for `@ecliptia/seekeable-node`

This guide provides instructions for setting up the development environment, building the WebAssembly (WASM) module, and contributing to the `@ecliptia/seekeable-node` project.

## Project Structure

The project consists of two main parts:

1.  **`lib/web-demuxer/`**: Contains the C++ source code for the WebAssembly module, which uses FFmpeg to perform media demuxing.
2.  **`seekeable-node/`**: Contains the Node.js wrapper library that interacts with the WASM module.

## Prerequisites

Before you begin, ensure you have the following installed:

-   **Node.js** (LTS version recommended)
-   **npm** (comes with Node.js) or **Yarn**
-   **Emscripten SDK**: This is required to compile the C++ FFmpeg code into WebAssembly. Follow the official Emscripten documentation for installation.
    -   [Emscripten SDK Installation Guide](https://emscripten.org/docs/getting_started/downloads.html)
-   **FFmpeg Libraries**: The Emscripten SDK typically includes pre-built FFmpeg libraries, but you might need to configure them or build them specifically for Emscripten if you require custom features.

## Setting Up the Development Environment

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd seekeable
    ```

2.  **Install Node.js dependencies:**
    ```bash
    cd seekeable-node
    npm install
    # or
    yarn install
    ```

## Building the WebAssembly Module

The WebAssembly module (`web-demuxer.wasm` and `web-demuxer.js`) is generated from the C++ source code in `lib/web-demuxer/`.

1.  **Navigate to the root of the project (where `Makefile` is located):**
    ```bash
    cd C:\Users\1luca\Desktop\seekeable
    ```

2.  **Build the WASM module using `make`:**
    ```bash
    make
    ```
    This command will:
    -   Compile the C++ source files (`web_demuxer.cpp`, `audio_codec_string.c`, `video_codec_string.c`) using Emscripten.
    -   Link against the necessary FFmpeg libraries.
    -   Generate `web-demuxer.wasm` and `web-demuxer.js` in the `dist/` directory of the `seekeable-node` package.

    **Troubleshooting `make`:**
    -   Ensure your Emscripten environment is activated (e.g., by running `source path/to/emsdk/emsdk_env.sh`).
    -   Check the `Makefile` for specific Emscripten flags or FFmpeg library paths.

## Running Tests

Tests for the Node.js wrapper are located in `seekeable-node/test.js`.

1.  **Navigate to the `seekeable-node` directory:**
    ```bash
    cd seekeable-node
    ```

2.  **Run the tests:**
    ```bash
    node test.js
    ```
    The tests will attempt to load various remote audio files, seek to specific timestamps, and stream audio segments. Ensure you have an active internet connection for the tests to pass.

## Contributing

We welcome contributions to `@ecliptia/seekeable-node`! If you'd like to contribute, please follow these steps:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes, ensuring they adhere to the project's coding style.
4.  Write or update tests to cover your changes.
5.  Ensure all tests pass and the WASM module builds successfully.
6.  Submit a pull request with a clear description of your changes.

## Code Style

Please adhere to the existing code style for both C++ and JavaScript files. For JavaScript, ESLint is recommended. For C++, follow standard C++ best practices and FFmpeg's coding style where applicable.

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.
