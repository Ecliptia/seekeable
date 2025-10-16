
import { SeekeableNode, SeekeableError, AV_MEDIA_TYPE_AUDIO } from './src/index.js';
import * as fsPromises from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';

const SEEK_TIMES = [15, 45, 90]; // Times in seconds to seek to

const TEST_FILES = [
  { url: 'https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3', type: 'audio/mpeg', codec: 'mp3' },
  // { url: 'https://filesamples.com/samples/audio/aac/sample1.aac', type: 'audio/aac', codec: 'aac' }, // Removido temporariamente
  { url: 'https://www.learningcontainer.com/wp-content/uploads/2020/02/Sample-FLAC-File.flac', type: 'audio/flac', codec: 'flac' },
  // { url: 'https://file-examples.com/storage/fe/2017/11/file_example_OOG_128_kbps_2min2s.ogg', type: 'audio/ogg', codec: 'vorbis' }, // Removido temporariamente
  { url: 'https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba-online-audio-converter.com_-1.wav', type: 'audio/wav', codec: 'pcm_s16le' }, // Codec pode variar, verificar
  { url: 'https://raw.githubusercontent.com/1Lucas1apk/lab/refs/heads/master/sample1.opus', type: 'audio/opus', codec: 'opus' },
  { url: 'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4', type: 'audio/mp4', codec: 'aac' } // MP4 com áudio AAC
];

async function runTestsForURL(file, bufferSize = 32768) {
  console.log(`\nInitializing SeekeableNode for URL: ${file.url} with buffer size: ${bufferSize}...`);
  const seekeable = new SeekeableNode();

  try {
    await seekeable.load(file.url, bufferSize);
    console.log('Source loaded successfully.');

    console.log('\nFetching media info to determine codecs...');
    const mediaInfo = await seekeable.getMediaInfo();
    let audioStreamInfo = null;
    for (let i = 0; i < mediaInfo.streams.size(); i++) {
      const stream = mediaInfo.streams.get(i);
      if (stream.codec_type_string === 'audio') {
        audioStreamInfo = stream;
        break;
      }
    }
    
    if (!audioStreamInfo) {
      throw new SeekeableError('No audio stream found in the file.', 'NO_AUDIO_STREAM');
    }

    const audioCodec = audioStreamInfo ? audioStreamInfo.codec_name : 'none';
    console.log(`Audio stream found. Codec: ${audioCodec}. Expected: ${file.codec}. Test seeks will be saved as .[codec] files.`);
    if (audioCodec !== file.codec) {
      console.warn(`  ⚠️ Warning: Detected codec (${audioCodec}) does not match expected codec (${file.codec}).`);
    }

    // Test getAVPacket for audio
    for (const time of SEEK_TIMES) {
      console.log(`\nSeeking to ${time}s and fetching ${audioCodec} packet...`);
      const packet = await seekeable.getAVPacket(time);

      if (packet && packet.size > 0) {
        const outputFilename = `seek-${time}s.${audioCodec}`;
        await fsPromises.writeFile(outputFilename, packet.data);
        console.log(`  ✅ Success! Packet timestamp: ${packet.timestamp.toFixed(3)}s. Saved ${packet.size} bytes to ${outputFilename}`);
      } else {
        console.log(`  ❌ Failed to retrieve a valid ${audioCodec} packet for time ${time}s.`);
      }
    }

    // Test AV stream for audio
    console.log('\nTesting AV stream for audio...');
    const audioStreamStartTime = 10; // Start streaming from 10 seconds
    const audioStreamEndTime = 20;   // End streaming at 20 seconds
    const audioOutputStreamFilename = `stream-${audioStreamStartTime}s-to-${audioStreamEndTime}s.${audioCodec}`;
    const audioWriteStream = createWriteStream(audioOutputStreamFilename);

    const { stream: audioAVStream, type: audioMimeType } = seekeable.createAVStream(audioStreamStartTime, audioStreamEndTime);
    console.log(`  Audio stream MIME type: ${audioMimeType}. Expected: ${file.type}`);
    if (audioMimeType !== file.type) {
      console.warn(`  ⚠️ Warning: Detected MIME type (${audioMimeType}) does not match expected MIME type (${file.type}).`);
    }
    if (audioMimeType === 'application/octet-stream') {
      console.warn('  ⚠️ Warning: Audio MIME type is generic. Codec-specific MIME type not determined.');
    }

    let totalAudioBytesStreamed = 0;
    let lastAudioPacketTimestamp = 0;

    audioAVStream.on('data', (packet) => {
      if (packet && packet.data && packet.data.length > 0) {
        audioWriteStream.write(packet.data);
        totalAudioBytesStreamed += packet.data.length;
        lastAudioPacketTimestamp = packet.timestamp;
      }
    });

    audioAVStream.on('end', () => {
      audioWriteStream.end();
      console.log(`  ✅ Audio stream finished. Total bytes streamed: ${totalAudioBytesStreamed}. Last packet timestamp: ${lastAudioPacketTimestamp.toFixed(3)}s. Saved to ${audioOutputStreamFilename}`);
    });

    audioAVStream.on('error', (err) => {
      console.error(`  ❌ Audio stream error:`, err);
      audioWriteStream.end();
    });

    // Wait for the audio stream to finish
    await new Promise((resolve) => {
      audioAVStream.on('end', resolve);
      audioAVStream.on('error', resolve); // Resolve even on error to unblock the test
    });

  } catch (error) {
    console.error('\nAn error occurred during the test:');
    if (error instanceof SeekeableError) {
      console.error(`  Code: ${error.code}`);
      console.error(`  Message: ${error.message}`);
      if (error.url) {
        console.error(`  URL: ${error.url}`);
      }
    } else {
      console.error(error);
    }
  } finally {
    console.log('\nCleaning up resources...');
    seekeable.destroy();
    console.log('Test finished.');
  }
}

(async function runAllTests() {
  for (const file of TEST_FILES) {
    await runTestsForURL(file);
  }
  // Teste com bufferSize menor para simular a preocupação do usuário
  await runTestsForURL(TEST_FILES[0], 4096); // Testando MP3 com buffer de 4KB
})();
