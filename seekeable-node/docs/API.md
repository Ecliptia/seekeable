# API Documentation for `@ecliptia/seekeable-node`

This document provides a detailed reference for the classes and methods available in the `@ecliptia/seekeable-node` library.

## `SeekeableNode` Class

The main class for interacting with the demuxer.

### `new SeekeableNode()`

Creates a new instance of the `SeekeableNode` demuxer. The WASM module is initialized asynchronously upon instantiation.

**Returns:** `SeekeableNode` - A new instance of the demuxer.

### `async load(url: string, bufferSize?: number)`

Loads a remote media file for processing. This method must be called before any other media-related operations.

- `url` (string): The URL of the media file to load.
- `bufferSize` (number, optional): The size of the internal buffer used for I/O operations in bytes. Defaults to `32768` (32KB).

**Returns:** `Promise<void>`

**Throws:** `SeekeableError` with code `SOURCE_OPEN_FAILED` if the source cannot be opened, or `WASM_LOAD_FAILED` if the WASM module fails to load.

### `async getMediaInfo()`

Retrieves detailed information about the media streams in the loaded file.

**Returns:** `Promise<object>` - An object containing media information, including:
  - `format_name` (string): The name of the media format (e.g., "mp3", "flac").
  - `start_time` (number): The start time of the media in seconds.
  - `duration` (number): The duration of the media in seconds.
  - `bit_rate` (string): The overall bit rate of the media.
  - `nb_streams` (number): The number of streams (audio, video, etc.) in the media.
  - `nb_chapters` (number): The number of chapters in the media.
  - `flags` (number): Format flags.
  - `streams` (Array<WebAVStream>): An array of `WebAVStream` objects, each describing a stream.

### `async getAVPacket(timeInSeconds: number)`

Seeks to a specific time in the audio stream and returns a single compressed audio packet.

- `timeInSeconds` (number): The time (in seconds) to seek to.

**Returns:** `Promise<object>` - An object representing the audio packet, including:
  - `stream_index` (number): The index of the stream this packet belongs to.
  - `codec_name` (string): The name of the codec used for this stream.
  - `keyframe` (boolean): `true` if this is a keyframe, `false` otherwise.
  - `timestamp` (number): The timestamp of the packet in seconds.
  - `duration` (number): The duration of the packet in seconds.
  - `size` (number): The size of the packet data in bytes.
  - `data` (Uint8Array): The raw compressed audio data of the packet.

**Throws:** `SeekeableError` with code `NO_AUDIO_STREAM` if no audio stream is found, or other errors if seeking fails.

### `createAVStream(startTimeInSeconds: number, endTimeInSeconds?: number)`

Creates a Node.js Readable stream of audio packets from the loaded media file.

- `startTimeInSeconds` (number): The time (in seconds) to start streaming from.
- `endTimeInSeconds` (number, optional): The time (in seconds) to end streaming at. If `0` or omitted, streams until the end of the file.

**Returns:** `object` - An object containing:
  - `stream` (AVStream): A Node.js `Readable` stream that emits `AVPacket` objects.
  - `type` (string): The MIME type of the audio stream (e.g., "audio/mpeg", "audio/flac").

### `destroy()`

Cleans up and releases the resources used by the WASM context. This should be called when the `SeekeableNode` instance is no longer needed to prevent memory leaks.

**Returns:** `void`

## `AVStream` Class (Internal Readable Stream)

This class is an internal Node.js `Readable` stream returned by `SeekeableNode.createAVStream()`. It emits `AVPacket` objects.

### Events

- `'data'` (event): Emits an `AVPacket` object.
- `'end'` (event): Emitted when the stream has finished.
- `'error'` (event): Emitted if an error occurs during streaming.

## `SeekeableError` Class

Custom error class for specific errors encountered by the library.

### Properties

- `message` (string): A human-readable error message.
- `code` (string): A unique error code (e.g., `FILE_NOT_FOUND`, `NETWORK_ERROR`, `RANGE_NOT_SUPPORTED`, `WASM_LOAD_FAILED`, `SOURCE_OPEN_FAILED`, `NO_AUDIO_STREAM`, `SEEK_OUT_OF_BOUNDS`, `FILE_READ_ERROR`).
- `url` (string, optional): The URL associated with the error, if applicable.

## Constants

- `AV_MEDIA_TYPE_AUDIO`: Constant representing the audio media type.
