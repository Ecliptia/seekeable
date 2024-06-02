<h4 align="right"><a href="https://github.com/ForeverSc/web-demuxer/blob/main/README.md">English</a> | <strong>简体中文</strong></h4>
<h1 align="center">Web-Demuxer</h1>
<p align="center">使用WebAssembly在浏览器中对媒体文件进行解封装, 专门为WebCodecs设计</p>

## Purpose
WebCodecs只提供了decode的能力，但没有提供demux的能力。有一些JS解封装mp4box.js很酷，但它只支持mp4，Web-Demuxer的目的是一次性支持更多媒体格式

## Features
- 🪄 专门为WebCodecs设计，API对于WebCodecs开发而言十分友好，可以轻松实现媒体文件的解封装
- 📦 一次性支持多种媒体格式，比如mov/mp4/mkv/webm/flv/m4v/wmv/avi等等
- 🧩 支持自定义打包，可以调整配置，打包出指定格式的demuxer

## Install
```bash
npm install web-demuxer
```

## Usage
```typescript
import { WebDemuxer } from "web-demuxer"

const demuxer = new WebDemuxer({
  // ⚠️ 你需要将npm包中dist/wasm-files文件放到类似public的静态目录下，保证wasm-files中的js和wasm在同一目录下
  wasmLoaderPath: "https://cdn.jsdelivr.net/npm/web-demuxer@latest/dist/wasm-files/ffmpeg.js",
})

// 以获取指定时间点的视频帧为例
async function seek(time) {
  // 1. 加载视频文件
  await demuxer.load(file);

  // 2. 解封装视频文件并生成WebCodecs所需的VideoDecoderConfig和EncodedVideoChunk
  const videoDecoderConfig = await demuxer.getVideoDecoderConfig();
  const videoChunk = await demuxer.seekEncodedVideoChunk(seekTime);

  // 3. 通过WebCodecs去解码视频帧
  const decoder = new VideoDecoder({
    output: (frame) => {
      // draw frame...
      frame.close();
    },
    error: (e) => {
      console.error('video decoder error:', e);
    }
  });

  decoder.configure(videoDecoderConfig);
  decoder.decode(videoChunk);
  decoder.flush();
}
```

## 案例
- [Seek Video Frame](https://foreversc.github.io/web-demuxer/#example-seek) ｜ [code](https://github.com/ForeverSc/web-demuxer/blob/main/index.html#L96)
- [Play Video](https://foreversc.github.io/web-demuxer/#example-play) ｜ [code](https://github.com/ForeverSc/web-demuxer/blob/main/index.html#L123)

## API
TODO: 待补充，你可以先看`src/web-demuxer.ts`中的具体实现与`index.html`的使用案例

### `getVideoDecoderConfig`
### `seekEncodedVideoChunk`
### `readAVPacket`
### `getAVStream`
### `getAVPacket`

## Custom Demuxer
TODO

## License
MIT
