# Usage Guide for `@ecliptia/seekeable-node`

This guide provides practical examples of how to use the `@ecliptia/seekeable-node` library.

## Basic Setup

First, import the necessary classes from the library:

```javascript
import { SeekeableNode, AV_MEDIA_TYPE_AUDIO } from '@ecliptia/seekeable-node';
```

## Loading a Media File

Before you can perform any operations, you need to load a remote media file.

```javascript
const seekeable = new SeekeableNode();

async function loadMedia(url) {
  try {
    await seekeable.load(url);
    console.log('Media loaded successfully!');
  } catch (error) {
    console.error('Failed to load media:', error.message);
  }
}

// Example usage:
loadMedia('https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3');
```

## Getting Media Information

Once a media file is loaded, you can retrieve detailed information about its streams.

```javascript
async function getInfo() {
  try {
    const mediaInfo = await seekeable.getMediaInfo();
    console.log('Media Info:', mediaInfo);

    // Accessing audio stream details
    for (const stream of mediaInfo.streams) {
      if (stream.codec_type === AV_MEDIA_TYPE_AUDIO) {
        console.log('Audio Stream Codec:', stream.codec_name);
        console.log('Sample Rate:', stream.sample_rate);
        console.log('Channels:', stream.channels);
        console.log('Duration:', mediaInfo.duration, 'seconds');
        break;
      }
    }
  } catch (error) {
    console.error('Failed to get media info:', error.message);
  }
}

// After loading media:
// loadMedia('your-audio-url.mp3').then(() => getInfo());
```

## Seeking and Retrieving a Single Audio Packet

You can seek to a specific timestamp and get a single compressed audio packet.

```javascript
async function getPacketAtTime(timeInSeconds) {
  try {
    const packet = await seekeable.getAVPacket(timeInSeconds);
    if (packet && packet.data) {
      console.log(`Packet at ${packet.timestamp}s, size: ${packet.size} bytes`);
      // `packet.data` is a Uint8Array containing the raw compressed audio data
      // You can write this to a file or process it further.
    } else {
      console.log(`No packet found at ${timeInSeconds}s.`);
    }
  } catch (error) {
    console.error('Failed to get audio packet:', error.message);
  }
}

// After loading media:
// loadMedia('your-audio-url.mp3').then(() => getPacketAtTime(30)); // Get packet at 30 seconds
```

## Streaming Audio Packets

For continuous playback or processing, you can create a Node.js Readable stream that emits audio packets.

```javascript
import { createWriteStream } from 'fs';

async function streamAudio(startTime, endTime, outputFilePath) {
  try {
    const { stream: audioStream, type: mimeType } = seekeable.createAVStream(startTime, endTime);
    console.log(`Streaming audio from ${startTime}s to ${endTime}s. MIME Type: ${mimeType}`);

    const writeStream = createWriteStream(outputFilePath);

    audioStream.on('data', (packet) => {
      if (packet && packet.data) {
        writeStream.write(packet.data);
      }
    });

    audioStream.on('end', () => {
      writeStream.end();
      console.log(`Audio stream finished. Output saved to ${outputFilePath}`);
    });

    audioStream.on('error', (error) => {
      console.error('Audio stream error:', error.message);
      writeStream.end();
    });

    // Wait for the stream to finish
    await new Promise((resolve) => audioStream.on('end', resolve));

  } catch (error) {
    console.error('Failed to create audio stream:', error.message);
  }
}

// Example: Stream 10 seconds of audio starting from 5 seconds
// loadMedia('your-audio-url.mp3').then(() => streamAudio(5, 15, 'output.mp3'));
```

## Cleaning Up Resources

It's important to call `destroy()` when you are finished with a `SeekeableNode` instance to release WASM resources.

```javascript
// After all operations are done:
seekeable.destroy();
console.log('Resources cleaned up.');
```

## Complete Example

```javascript
import { SeekeableNode, AV_MEDIA_TYPE_AUDIO } from '@ecliptia/seekeable-node';
import { createWriteStream } from 'fs';

async function main() {
  const audioUrl = 'https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3';
  const seekeable = new SeekeableNode();

  try {
    // 1. Load the media file
    await seekeable.load(audioUrl);
    console.log('Media loaded successfully!');

    // 2. Get media information
    const mediaInfo = await seekeable.getMediaInfo();
    console.log('Media Info:', mediaInfo.format_name, 'Duration:', mediaInfo.duration, 's');

    // 3. Get a single packet at 30 seconds
    const packet = await seekeable.getAVPacket(30);
    if (packet && packet.data) {
      console.log(`Packet at ${packet.timestamp}s, size: ${packet.size} bytes`);
      // fs.writeFileSync('single_packet.mp3', packet.data); // Uncomment to save
    }

    // 4. Stream a segment of audio
    const startTime = 10;
    const endTime = 20;
    const outputFilePath = 'streamed_audio_segment.mp3';

    const { stream: audioStream, type: mimeType } = seekeable.createAVStream(startTime, endTime);
    console.log(`Streaming audio from ${startTime}s to ${endTime}s. MIME Type: ${mimeType}`);

    const writeStream = createWriteStream(outputFilePath);

    audioStream.on('data', (p) => {
      if (p && p.data) {
        writeStream.write(p.data);
      }
    });

    audioStream.on('end', () => {
      writeStream.end();
      console.log(`Audio stream finished. Output saved to ${outputFilePath}`);
    });

    audioStream.on('error', (error) => {
      console.error('Audio stream error:', error.message);
      writeStream.end();
    });

    await new Promise((resolve) => audioStream.on('end', resolve));

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    // 5. Clean up resources
    seekeable.destroy();
    console.log('Resources cleaned up.');
  }
}

main();
