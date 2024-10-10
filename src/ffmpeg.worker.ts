import { FFMpegWorkerMessageType, GetAVPacketMessageData, GetAVPacketsMessageData, GetAVStreamMessageData, GetAVStreamsMessageData, GetMediaInfoMessageData, LoadWASMMessageData, ReadAVPacketMessageData, SetAVLogLevelMessageData, WebAVPacket, WebAVStream } from "./types";

let Module: any; // TODO: rm any

self.postMessage({
  type: "FFmpegWorkerLoaded",
});

self.addEventListener("message", async function (e) {
  const { type, data, msgId } = e.data

  try {
    switch (type) {
      case "LoadWASM":
        return await handleLoadWASM(data);
      case "GetAVStream":
        return handleGetAVStream(data, msgId);
      case "GetAVStreams":
        return handleGetAVStreams(data, msgId);
      case "GetMediaInfo":
        return handleGetMediaInfo(data, msgId);
      case "GetAVPacket":
        return handleGetAVPacket(data, msgId);
      case "GetAVPackets":
        return handleGetAVPackets(data, msgId);
      case "ReadAVPacket":
        return await handleReadAVPacket(data, msgId);
      case "SetAVLogLevel":
        return handleSetAVLogLevel(data, msgId);
      default:
        return;
    }
  } catch (e) {
    self.postMessage({
      type,
      msgId,
      errMsg: e instanceof Error ? e.message : "Unknown Error",
    });
  }
});

async function handleLoadWASM(data: LoadWASMMessageData) {
  const { wasmLoaderPath } = data || {};
  const ModuleLoader = await import(/* @vite-ignore */wasmLoaderPath);
  Module = await ModuleLoader.default();
}

function handleGetAVStream(data: GetAVStreamMessageData, msgId: number) {
  const { source, streamType, streamIndex } = data;
  const result = Module.getAVStream(source, streamType, streamIndex);

  self.postMessage(
    {
      type: FFMpegWorkerMessageType.GetAVStream,
      msgId,
      result,
    },
    [result.extradata.buffer],
  );
}

function handleGetAVStreams(data: GetAVStreamsMessageData, msgId: number) {
  const { source } = data;
  const result = Module.getAVStreams(source);

  self.postMessage(
    {
      type: FFMpegWorkerMessageType.GetAVStreams,
      msgId,
      result,
    },
    result.map((stream: WebAVStream) => stream.extradata.buffer),
  );
}

function handleGetMediaInfo(data: GetMediaInfoMessageData, msgId: number) {
  const { source } = data;
  const result = Module.getMediaInfo(source);

  self.postMessage(
    {
      type: FFMpegWorkerMessageType.GetMediaInfo,
      msgId,
      result,
    },
    result.streams.map((stream: WebAVStream) => stream.extradata.buffer)
  );
}

function handleGetAVPacket(data: GetAVPacketMessageData, msgId: number) {
  const { source, time, streamType, streamIndex, seekFlag } = data;
  const result = Module.getAVPacket(source, time, streamType, streamIndex, seekFlag);

  self.postMessage(
    {
      type: FFMpegWorkerMessageType.GetAVPacket,
      msgId,
      result,
    },
    [result.data.buffer],
  );
}

function handleGetAVPackets(data: GetAVPacketsMessageData, msgId: number) {
  const { source, time, seekFlag } = data;
  const result = Module.getAVPackets(source, time, seekFlag);

  self.postMessage(
    {
      type: FFMpegWorkerMessageType.GetAVPackets,
      msgId,
      result,
    },
    result.map((packet: WebAVPacket) => packet.data.buffer),
  );
}

async function handleReadAVPacket(data: ReadAVPacketMessageData, msgId: number) {
  const { source, start, end, streamType, streamIndex, seekFlag } = data;
  const result = await Module.readAVPacket(
    msgId,
    source,
    start,
    end,
    streamType,
    streamIndex,
    seekFlag
  );

  self.postMessage({
    type: FFMpegWorkerMessageType.ReadAVPacket,
    msgId,
    result,
  });
}

function handleSetAVLogLevel(data: SetAVLogLevelMessageData, msgId: number) {
  const { level } = data

  Module.setAVLogLevel(level);
  self.postMessage({
    type: "SetAVLogLevel",
    msgId,
  })
}