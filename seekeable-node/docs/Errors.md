# Error Handling in `@ecliptia/seekeable-node`

The `@ecliptia/seekeable-node` library uses a custom error class, `SeekeableError`, to provide more specific information about issues that may arise during its operation. This allows for more robust error handling in your applications.

## `SeekeableError` Class

All errors originating directly from the `SeekeableNode` library will be instances of `SeekeableError`.

### Properties

- `message` (string): A human-readable description of the error.
- `code` (string): A unique, machine-readable code identifying the type of error. This is useful for programmatic error handling.
- `url` (string, optional): If the error is related to a specific URL (e.g., network issues, file not found), this property will contain the URL.

### Example Error Handling

```javascript
import { SeekeableNode, SeekeableError } from '@ecliptia/seekeable-node';

async function processMedia(url) {
  const seekeable = new SeekeableNode();
  try {
    await seekeable.load(url);
    // ... perform other operations ...
  } catch (error) {
    if (error instanceof SeekeableError) {
      console.error(`SeekeableError caught:`);
      console.error(`  Code: ${error.code}`);
      console.error(`  Message: ${error.message}`);
      if (error.url) {
        console.error(`  URL: ${error.url}`);
      }

      switch (error.code) {
        case 'WASM_LOAD_FAILED':
          console.error('The WebAssembly module could not be loaded. Check your installation and environment.');
          break;
        case 'SOURCE_OPEN_FAILED':
          console.error('Failed to open the media source. The URL might be invalid or inaccessible.');
          break;
        case 'FILE_NOT_FOUND':
          console.error('The remote media file was not found (HTTP 404).');
          break;
        case 'NETWORK_ERROR':
          console.error('A network issue prevented access to the media file.');
          break;
        case 'RANGE_NOT_SUPPORTED':
          console.error('The server does not support byte-range requests, which are required for seeking.');
          break;
        case 'SEEK_OUT_OF_BOUNDS':
          console.error('Attempted to seek to a position outside the file boundaries.');
          break;
        case 'NO_AUDIO_STREAM':
          console.error('No audio stream was found in the provided media file.');
          break;
        case 'FILE_READ_ERROR':
          console.error('An error occurred while reading a chunk of the file.');
          break;
        default:
          console.error('An unexpected SeekeableError occurred.');
      }
    } else {
      console.error('An unexpected error occurred:', error);
    }
  } finally {
    seekeable.destroy();
  }
}

// Example usage with a potentially problematic URL
processMedia('http://example.com/non-existent-audio.mp3');
processMedia('http://localhost:8000/audio.mp4'); // Assuming a local server
```

## Error Codes Reference

Here is a list of common `code` values you might encounter:

| Code                  | Description                                                                 |
| :-------------------- | :-------------------------------------------------------------------------- |
| `UNKNOWN_ERROR`       | A generic error occurred that does not fit other categories.                |
| `WASM_LOAD_FAILED`    | The WebAssembly module failed to load or initialize.                        |
| `SOURCE_OPEN_FAILED`  | The media source could not be opened by the WASM demuxer.                   |
| `FILE_NOT_FOUND`      | The remote media file was not found (e.g., HTTP 404 status).                |
| `NETWORK_ERROR`       | A general network issue occurred during HTTP requests.                      |
| `RANGE_NOT_SUPPORTED` | The remote server does not support HTTP byte-range requests.                |
| `SEEK_OUT_OF_BOUNDS`  | A seek operation was attempted to a position outside the file's valid range.|
| `NO_AUDIO_STREAM`     | No audio stream was detected in the loaded media file.                      |
| `FILE_READ_ERROR`     | An error occurred while attempting to read data from the remote file.       |

By checking the `code` property of a `SeekeableError` instance, you can implement specific logic to handle different failure scenarios gracefully.
