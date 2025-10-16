import { fetch } from 'undici';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import fs from 'fs/promises';
import createModule from '../dist/web-demuxer.js';

export class SeekeableError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', url = null) {
    super(message);
    this.name = 'SeekeableError';
    this.code = code;
    this.url = url;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEEK_SET = 0;
const SEEK_CUR = 1;
const SEEK_END = 2;
export const AV_MEDIA_TYPE_AUDIO = 1;
const AVSEEK_FLAG_BACKWARD = 1;

function convertWasmAVPacketToJS(avPacket, mediaInfo) {
  const data = new Uint8Array(avPacket.data);
  const streamInfo = mediaInfo.streams.get(avPacket.stream_index);
  const result = {
    stream_index: avPacket.stream_index,
    codec_name: streamInfo ? streamInfo.codec_name : 'unknown',
    keyframe: avPacket.keyframe,
    timestamp: avPacket.timestamp,
    duration: avPacket.duration,
    size: avPacket.size,
    data: data,
  };
  return result;
}

class NodeHttpIOHandler {
  constructor(url) {
    this.url = url;
    this.pos = 0;
    this.fileSize = -1;
  }

  async getSize() {
    if (this.fileSize === -1) {
      try {
        const headResponse = await fetch(this.url, { method: 'HEAD' });
        if (headResponse.status === 404) {
          throw new SeekeableError('File not found on remote server.', 'FILE_NOT_FOUND', this.url);
        } else if (!headResponse.ok) {
          throw new SeekeableError(`Network error: ${headResponse.status} ${headResponse.statusText}`, 'NETWORK_ERROR', this.url);
        }
        const contentLength = headResponse.headers.get('content-length');

        const acceptRanges = headResponse.headers.get('accept-ranges');
        if (acceptRanges !== 'bytes') {
          throw new SeekeableError('Server does not support byte-range requests. Seeking is not possible.', 'RANGE_NOT_SUPPORTED', this.url);
        }

        if (contentLength) {
          this.fileSize = parseInt(contentLength, 10);
        } else {
          const rangeResponse = await fetch(this.url, { headers: { Range: 'bytes=0-0' } });
          if (rangeResponse.status === 404) {
            throw new SeekeableError('File not found on remote server.', 'FILE_NOT_FOUND', this.url);
          } else if (!rangeResponse.ok) {
            throw new SeekeableError(`Network error: ${rangeResponse.status} ${rangeResponse.statusText}`, 'NETWORK_ERROR', this.url);
          }
          const contentRange = rangeResponse.headers.get('content-range');
          if (contentRange) {
            const match = contentRange.match(/\/(\d+)$/);
            if (match) {
              this.fileSize = parseInt(match[1], 10);
            } else {
              this.fileSize = Infinity;
            }
          } else {
            this.fileSize = Infinity;
          }
        }
      } catch (e) {
        if (e instanceof SeekeableError) {
          throw e;
        } else {
          throw new SeekeableError(`Network error during file size determination: ${e.message}`, 'NETWORK_ERROR', this.url);
        }
      }
    }
    return this.fileSize;
  }

  async read(size) {
    await this.getSize();

    const bytesToRead = Math.min(size, this.fileSize - this.pos);

    if (bytesToRead <= 0 && this.fileSize !== Infinity) {
      return { buffer: new Uint8Array(0), bytesRead: 0 };
    }

    const end = this.pos + bytesToRead - 1;
    const rangeHeader = `bytes=${this.pos}-${end}`;

    try {
      const response = await fetch(this.url, {
        headers: { Range: rangeHeader },
      });
      if (response.status === 404) {
        throw new SeekeableError('File not found on remote server during read.', 'FILE_NOT_FOUND', this.url);
      } else if (!response.ok) {
        throw new SeekeableError(`Network error during read: ${response.status} ${response.statusText}`, 'NETWORK_ERROR', this.url);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      this.pos += buffer.byteLength;
      return { buffer, bytesRead: buffer.byteLength };
    } catch (e) {
      if (e instanceof SeekeableError) {
        throw e;
      } else {
        throw new SeekeableError(`Error reading file chunk from remote server: ${e.message}`, 'FILE_READ_ERROR', this.url);
      }
    }
  }

  async seek(offset, whence) {
    await this.getSize();
    let newPos = -1;
    if (whence === SEEK_SET) {
      newPos = offset;
    } else if (whence === SEEK_CUR) {
      newPos = this.pos + offset;
    } else if (whence === SEEK_END) {
      newPos = this.fileSize + offset;
    }

    if (newPos < 0 || (this.fileSize !== Infinity && newPos > this.fileSize)) {
      throw new SeekeableError('Seek position out of bounds.', 'SEEK_OUT_OF_BOUNDS');
    }
    this.pos = newPos;
    return this.pos;
  }
}

class AVStream extends Readable {
  constructor(module, contextPtr, startTime, endTime, mediaType, mimeType) {
    super({ objectMode: true });
    this.module = module;
    this.contextPtr = contextPtr;
    this.startTime = startTime;
    this.endTime = endTime;
    this.mediaType = mediaType;
    this.mimeType = mimeType;
    this.reading = false;
    this.finished = false;
  }

  async _read(size) {
    if (this.finished || this.reading) {
      return;
    }
    this.reading = true;

    try {
      await this.module.read_av_packet(
        this.contextPtr,
        this.startTime,
        this.endTime,
        this.mediaType,
        -1,
        AVSEEK_FLAG_BACKWARD,
        this
      );
      this.finished = true;
      this.push(null);
    } catch (e) {
      this.emit('error', e);
      this.finished = true;
      this.push(null);
    } finally {
      this.reading = false;
    }
  }

  async sendAVPacket(packet) {
    if (packet === 0) {
      return 0;
    }
    const canContinue = this.push(packet);
    return canContinue ? 1 : 0;
  }
}

export class SeekeableNode {
  constructor() {
    this.module = null;
    this.contextPtr = null;
    this.moduleLoadStatus = this._initializeModule();
  }

  async _initializeModule() {
    try {
      this.module = await createModule({
        print: () => {},
        printErr: () => {},
        locateFile: (relativePath, prefix) => {
          if (relativePath.endsWith('.wasm')) {
            const wasmPath = path.resolve(__dirname, '..', 'dist', 'web-demuxer.wasm');
            return wasmPath;
          }
          return prefix + relativePath;
        },
      });
    } catch (e) {
      throw new SeekeableError(`Failed to load WASM module: ${e.message}`, 'WASM_LOAD_FAILED');
    }
  }
  
  async load(url, bufferSize = 32768) {
    await this.moduleLoadStatus;
    if (this.contextPtr) {
      this.destroy();
    }
    this.bufferSize = bufferSize;
    const ioHandler = new NodeHttpIOHandler(url);
    
    try {
      this.contextPtr = await this.module.open_source(ioHandler, this.bufferSize);
    } catch (e) {
      throw new SeekeableError(`Failed to open source via WASM module: ${e.message}`, 'SOURCE_OPEN_FAILED');
    }
    
    if (this.contextPtr === 0) {
      throw new SeekeableError('Failed to open source via WASM module. Check URL and network.', 'SOURCE_OPEN_FAILED');
    }
  }

  async getMediaInfo() {
    await this._ensureLoaded();
    return this.module.get_media_info(this.contextPtr);
  }

  async getAVPacket(timeInSeconds) {
    await this._ensureLoaded();
    const mediaType = AV_MEDIA_TYPE_AUDIO;
    const streamIndex = -1;
    
    const wasmPacket = this.module.get_av_packet(
      this.contextPtr,
      mediaType,
      streamIndex,
      timeInSeconds,
      AVSEEK_FLAG_BACKWARD
    );
    return wasmPacket;
  }

  createAVStream(startTimeInSeconds, endTimeInSeconds = 0) {
    this._ensureLoaded();
    const mediaType = AV_MEDIA_TYPE_AUDIO;
    const mediaInfo = this.module.get_media_info(this.contextPtr);
    let streamMimeType = 'application/octet-stream';

    for (let i = 0; i < mediaInfo.streams.size(); i++) {
      const stream = mediaInfo.streams.get(i);
      if (stream.codec_type === mediaType) {
        streamMimeType = stream.mime_type;
        break;
      }
    }

    return {
      stream: new AVStream(this.module, this.contextPtr, startTimeInSeconds, endTimeInSeconds, mediaType, streamMimeType),
      type: streamMimeType,
    };
  }

  destroy() {
    if (this.contextPtr) {
      this.module.close_source(this.contextPtr);
      this.contextPtr = null;
    }
  }

  async _ensureLoaded() {
    await this.moduleLoadStatus;
  }
}