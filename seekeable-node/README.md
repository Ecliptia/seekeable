# @ecliptia/seekeable-node

A Node.js demuxer for seeking remote media files (audio only).

## Overview

`@ecliptia/seekeable-node` is a powerful Node.js library designed to efficiently demux and seek within remote media files, with a primary focus on audio streams. It leverages WebAssembly (WASM), media processing, providing a robust and performant solution for applications requiring direct access to media packets.

This library is particularly useful for:
- Building custom audio streaming services.
- Analyzing audio files without downloading the entire content.
- Implementing features like fast-forward, rewind, and precise seeking in audio playback.

## Features

- **Remote File Seeking:** Efficiently seek to any timestamp within a remote audio file using HTTP byte-range requests.
- **WASM-powered Demuxing:** Utilizes a WebAssembly module compiled from FFmpeg for high-performance media demuxing.
- **Audio Stream Extraction:** Focuses on extracting audio packets, providing detailed information about audio streams (codec, sample rate, channels, etc.).
- **Node.js Stream Integration:** Provides a Node.js Readable stream for continuous audio packet delivery, enabling seamless integration with existing Node.js stream pipelines.
- **Error Handling:** Comprehensive error handling with custom `SeekeableError` types for better debugging and application control.

## Installation

```bash
npm install @ecliptia/seekeable-node
# or
yarn add @ecliptia/seekeable-node
```

## Usage

For detailed usage examples, please refer to the [Usage Guide](docs/Usage.md).

## API Documentation

For a complete reference of the available classes and methods, please refer to the [API Documentation](docs/API.md).

## Error Handling

For a list of custom error codes and their meanings, please refer to the [Error Handling Guide](docs/Errors.md).

## Development

For information on how to set up the development environment, build the WASM module, and contribute to the project, please refer to the [Development Guide](docs/Development.md).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
