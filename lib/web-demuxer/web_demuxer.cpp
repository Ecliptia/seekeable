#include <string>
#include <sstream>
#include <cstdint>
#include <vector>
#include <map>
#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>

using namespace emscripten;

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/avutil.h>
#include <libavcodec/codec_id.h>
#include "audio_codec_string.h"
}

int read_av_packet(intptr_t context_handle, double start, double end, int type, int wanted_stream_nb, int seek_flag, val js_caller);

typedef struct DemuxerContext {
    AVFormatContext *fmt_ctx;
    AVIOContext *avio_ctx;
    val io_handler;
    uint8_t *avio_ctx_buffer;
} DemuxerContext;

std::map<intptr_t, DemuxerContext*> context_map;

int read_packet(void *opaque, uint8_t *buf, int buf_size) {
    DemuxerContext *ctx = (DemuxerContext *)opaque;
    val result = ctx->io_handler.call<val>("read", buf_size).await();
    val buffer = result["buffer"];
    int bytes_read = result["bytesRead"].as<int>();
    if (bytes_read > 0) {
        val memoryView = val(typed_memory_view(bytes_read, buf));
        memoryView.call<void>("set", buffer);
    }
    return bytes_read > 0 ? bytes_read : AVERROR_EOF;
}

int64_t seek(void *opaque, int64_t offset, int whence) {
    DemuxerContext *ctx = (DemuxerContext *)opaque;
    if (whence == AVSEEK_SIZE) {
        double size_double = ctx->io_handler.call<val>("getSize").await().as<double>();
        int64_t size_i64 = (int64_t)size_double;
        return size_i64;
    }
    double new_pos_double = ctx->io_handler.call<val>("seek", (double)offset, (double)whence).await().as<double>();
    int64_t new_pos_i64 = (int64_t)new_pos_double;
    return new_pos_i64;
}

typedef struct Tag {
    std::string key;
    std::string value;
} Tag;

typedef struct WebAVStream {
    int index;
    int id;
    int codec_type;
    std::string codec_type_string;
    std::string codec_name;
    std::string codec_string;
    std::string profile;
    int level;
    std::string bit_rate;
    int extradata_size;
    std::vector<uint8_t> extradata;
    val get_extradata() const {
        return val(typed_memory_view(extradata.size(), extradata.data()));
    }
    int channels;
    int sample_rate;
    std::string sample_fmt;
    double start_time;
    double duration;
    std::string nb_frames;
    std::string mime_type;
    std::vector<Tag> tags;
    val get_tags() const {
        val tags = val::object();
        for (const Tag &tag : this->tags) {
            tags.set(tag.key, tag.value);
        }
        return tags;
    }
} WebAVStream;

typedef struct WebAVPacket {
    int stream_index;
    int keyframe;
    double timestamp;
    double duration;
    int size;
    std::vector<uint8_t> data;
    val get_data() const {
        return val(typed_memory_view(data.size(), data.data()));
    }
} WebAVPacket;

typedef struct WebMediaInfo {
    std::string format_name;
    double start_time;
    double duration;
    std::string bit_rate;
    int nb_streams;
    int nb_chapters;
    int flags;
    std::vector<WebAVStream> streams;
} WebMediaInfo;

std::string gen_rational_str(AVRational rational, char sep) {
    std::ostringstream oss;
    oss << rational.num << sep << rational.den;
    return oss.str();
}

inline std::string safe_str(const char* str) {
    return str ? str : "";
}

std::string get_audio_mime_type(AVCodecID codec_id) {
    switch (codec_id) {
        case AV_CODEC_ID_MP3:
            return "audio/mpeg";
        case AV_CODEC_ID_AAC:
            return "audio/aac";
        case AV_CODEC_ID_AC3:
            return "audio/ac3";
        case AV_CODEC_ID_EAC3:
            return "audio/eac3";
        case AV_CODEC_ID_FLAC:
            return "audio/flac";
        case AV_CODEC_ID_VORBIS:
            return "audio/vorbis";
        case AV_CODEC_ID_OPUS:
            return "audio/opus";
        case AV_CODEC_ID_PCM_S16LE:
        case AV_CODEC_ID_PCM_S16BE:
        case AV_CODEC_ID_PCM_U16LE:
        case AV_CODEC_ID_PCM_U16BE:
        case AV_CODEC_ID_PCM_ALAW:
        case AV_CODEC_ID_PCM_MULAW:
            return "audio/wav";
        default:
            return "application/octet-stream";
    }
}
void gen_web_packet(WebAVPacket &web_packet, AVPacket *packet, AVStream *stream) {
    double packet_timestamp = 0;
    if (packet->pts != AV_NOPTS_VALUE) {
        packet_timestamp = packet->pts * av_q2d(stream->time_base);
    } else if (packet->dts != AV_NOPTS_VALUE) {
        packet_timestamp = packet->dts * av_q2d(stream->time_base);
    }
    web_packet.stream_index = packet->stream_index;
    web_packet.keyframe = packet->flags & AV_PKT_FLAG_KEY;
    web_packet.timestamp = packet_timestamp;
    web_packet.duration = packet->duration * av_q2d(stream->time_base);
    web_packet.size = packet->size;
    if (packet->size > 0) {
        web_packet.data = std::vector<uint8_t>(packet->data, packet->data + packet->size);
    }
    else {
        web_packet.data = std::vector<uint8_t>();
    }
}

void gen_web_stream(WebAVStream &web_stream, AVStream *stream, AVFormatContext *fmt_ctx) {
    web_stream.index = stream->index;
    web_stream.id = stream->id;
    AVCodecParameters *par = stream->codecpar;
    web_stream.codec_type = (int)par->codec_type;
    web_stream.codec_type_string = safe_str(av_get_media_type_string(par->codec_type));
    const AVCodecDescriptor* desc = avcodec_descriptor_get(par->codec_id);
    web_stream.codec_name = safe_str(desc ? desc->name : "");

    char codec_string[40];
    if (par->codec_type == AVMEDIA_TYPE_AUDIO) {
        web_stream.channels = par->ch_layout.nb_channels;
        web_stream.sample_rate = par->sample_rate;
        web_stream.sample_fmt = safe_str(av_get_sample_fmt_name((AVSampleFormat)par->format));
        set_audio_codec_string(codec_string, sizeof(codec_string), par);
        web_stream.mime_type = get_audio_mime_type(par->codec_id);
    } else {
        strcpy(codec_string, "undf");
    }
    web_stream.codec_string = safe_str(codec_string);
    web_stream.profile = safe_str(avcodec_profile_name(par->codec_id, par->profile));
    web_stream.level = par->level;
    web_stream.bit_rate = std::to_string(par->bit_rate);
    web_stream.extradata_size = par->extradata_size;
    if (par->extradata_size > 0) {
        web_stream.extradata = std::vector<uint8_t>(par->extradata, par->extradata + par->extradata_size);
    } else {
        web_stream.extradata = std::vector<uint8_t>();
    }
    web_stream.start_time = stream->start_time * av_q2d(stream->time_base);
    web_stream.duration = stream->duration > 0 ? stream->duration * av_q2d(stream->time_base) : fmt_ctx->duration * av_q2d(AV_TIME_BASE_Q);
    int64_t nb_frames = stream->nb_frames;
    if (nb_frames == 0 && stream->avg_frame_rate.den != 0) {
        nb_frames = (fmt_ctx->duration * (double)stream->avg_frame_rate.num) / ((double)stream->avg_frame_rate.den * AV_TIME_BASE);
    }
    web_stream.nb_frames = std::to_string(nb_frames);
    AVDictionaryEntry *tag = NULL;
    while ((tag = av_dict_get(stream->metadata, "", tag, AV_DICT_IGNORE_SUFFIX))) {
        Tag t = { .key = safe_str(tag->key), .value = safe_str(tag->value) };
        web_stream.tags.push_back(t);
    }
}

intptr_t open_source(val io_handler, int buffer_size) {
    av_log_set_level(AV_LOG_QUIET);
    DemuxerContext *ctx = new DemuxerContext();
    ctx->io_handler = io_handler;
    ctx->fmt_ctx = avformat_alloc_context();
    ctx->avio_ctx_buffer = (uint8_t *)av_malloc(buffer_size);
    ctx->avio_ctx = avio_alloc_context(
        ctx->avio_ctx_buffer, buffer_size, 0, ctx,
        &read_packet, NULL, &seek
    );

    if (!ctx->avio_ctx) {
        av_free(ctx->avio_ctx_buffer);
        avformat_free_context(ctx->fmt_ctx);
        delete ctx;
        throw std::runtime_error("Cannot allocate AVIOContext");
    }

    ctx->fmt_ctx->pb = ctx->avio_ctx;

    int ret = avformat_open_input(&ctx->fmt_ctx, NULL, NULL, NULL);
    if (ret < 0) {
        char errbuf[AV_ERROR_MAX_STRING_SIZE];
        av_strerror(ret, errbuf, AV_ERROR_MAX_STRING_SIZE);
        av_free(ctx->avio_ctx->buffer);
        avio_context_free(&ctx->avio_ctx);
        avformat_free_context(ctx->fmt_ctx);
        delete ctx;
        throw std::runtime_error("Cannot open input source");
    }

    if (avformat_find_stream_info(ctx->fmt_ctx, NULL) < 0) {
        avformat_close_input(&ctx->fmt_ctx);
        delete ctx;
        throw std::runtime_error("Cannot find stream information");
    }

    intptr_t handle = reinterpret_cast<intptr_t>(ctx);
    context_map[handle] = ctx;
    return handle;
}

void close_source(intptr_t context_handle) {
    if (context_map.find(context_handle) == context_map.end()) {
        return;
    }
    DemuxerContext *ctx = context_map[context_handle];
    avformat_close_input(&ctx->fmt_ctx);
    delete ctx;
    context_map.erase(context_handle);
}

WebMediaInfo get_media_info(intptr_t context_handle) {
    if (context_map.find(context_handle) == context_map.end()) {
        throw std::runtime_error("Invalid context handle");
    }
    DemuxerContext *ctx = context_map[context_handle];
    AVFormatContext *fmt_ctx = ctx->fmt_ctx;

    int num_streams = fmt_ctx->nb_streams;
    WebMediaInfo media_info = {
        .format_name = fmt_ctx->iformat->name,
        .start_time = fmt_ctx->start_time * av_q2d(AV_TIME_BASE_Q),
        .duration = fmt_ctx->duration * av_q2d(AV_TIME_BASE_Q),
        .bit_rate = std::to_string(fmt_ctx->bit_rate),
        .nb_streams = num_streams,
        .nb_chapters = (int)fmt_ctx->nb_chapters,
        .flags = fmt_ctx->flags,
        .streams = std::vector<WebAVStream>(num_streams),
    };

    for (int stream_index = 0; stream_index < num_streams; stream_index++) {
        AVStream *stream = fmt_ctx->streams[stream_index];
        gen_web_stream(media_info.streams[stream_index], stream, fmt_ctx);
    }
    return media_info;
}

WebAVPacket get_av_packet(intptr_t context_handle, int type, int wanted_stream_nb, double timestamp, int seek_flag) {
    if (context_map.find(context_handle) == context_map.end()) {
        throw std::runtime_error("Invalid context handle");
    }
    DemuxerContext *demux_ctx = context_map[context_handle];
    AVFormatContext *fmt_ctx = demux_ctx->fmt_ctx;

    int stream_index = av_find_best_stream(fmt_ctx, (AVMediaType)type, wanted_stream_nb, -1, NULL, 0);
    if (stream_index < 0) {
        throw std::runtime_error("Cannot find wanted stream in the input file");
    }

    AVPacket *packet = av_packet_alloc();
    if (!packet) {
        throw std::runtime_error("Cannot allocate packet");
    }

    int64_t int64_timestamp = (int64_t)(timestamp * AV_TIME_BASE);
    int64_t seek_time_stamp = av_rescale_q(int64_timestamp, AV_TIME_BASE_Q, fmt_ctx->streams[stream_index]->time_base);

    if (av_seek_frame(fmt_ctx, stream_index, seek_time_stamp, seek_flag) < 0) {
        av_packet_free(&packet);
        throw std::runtime_error("Cannot seek to the specified timestamp");
    }

    while (av_read_frame(fmt_ctx, packet) >= 0) {
        if (packet->stream_index == stream_index) {
            break;
        }
        av_packet_unref(packet);
    }

    if (!packet->data) {
        av_packet_free(&packet);
        throw std::runtime_error("Failed to get av packet at timestamp");
    }

    WebAVPacket web_packet;
    gen_web_packet(web_packet, packet, fmt_ctx->streams[stream_index]);

    av_packet_unref(packet);
    av_packet_free(&packet);

    return web_packet;
}

int read_av_packet(intptr_t context_handle, double start, double end, int type, int wanted_stream_nb, int seek_flag, val js_caller) {
    if (context_map.find(context_handle) == context_map.end()) {
        throw std::runtime_error("Invalid context handle");
    }
    DemuxerContext *demux_ctx = context_map[context_handle];
    AVFormatContext *fmt_ctx = demux_ctx->fmt_ctx;

    int stream_index = av_find_best_stream(fmt_ctx, (AVMediaType)type, wanted_stream_nb, -1, NULL, 0);

    if (stream_index < 0) {
        throw std::runtime_error("Cannot find wanted stream in the input file");
    }

    AVPacket *packet = NULL;
    packet = av_packet_alloc();

    if (!packet) {
        throw std::runtime_error("Cannot allocate packet");
    }

    if (start > 0) {
        int64_t start_timestamp = (int64_t)(start * AV_TIME_BASE);
        int64_t rescaled_start_time_stamp = av_rescale_q(start_timestamp, AV_TIME_BASE_Q, fmt_ctx->streams[stream_index]->time_base);

        if (av_seek_frame(fmt_ctx, stream_index, rescaled_start_time_stamp, seek_flag) < 0) {
            av_packet_free(&packet);
            throw std::runtime_error("Cannot seek to the specified timestamp");
        }
    }

    while (av_read_frame(fmt_ctx, packet) >= 0) {
        if (packet->stream_index == stream_index) {
            WebAVPacket web_packet;

            gen_web_packet(web_packet, packet, fmt_ctx->streams[stream_index]);

            if (end > 0 && web_packet.timestamp > end) {
                break;
            }

            val result = js_caller.call<val>("sendAVPacket", web_packet).await();
            int send_result = result.as<int>();

            if (send_result == 0) {
                break;
            }
        }
        av_packet_unref(packet);
    }

    js_caller.call<val>("sendAVPacket", 0).await();

    av_packet_unref(packet);
    av_packet_free(&packet);

    return 1;
}

void set_av_log_level(int level) {
    av_log_set_level(level);
}

EMSCRIPTEN_BINDINGS(web_demuxer) {
    value_object<Tag>("Tag")
        .field("key", &Tag::key)
        .field("value", &Tag::value);

    class_<WebAVStream>("WebAVStream")
        .constructor<>()
        .property("index", &WebAVStream::index)
        .property("id", &WebAVStream::id)
        .property("codec_type", &WebAVStream::codec_type)
        .property("codec_type_string", &WebAVStream::codec_type_string)
        .property("codec_name", &WebAVStream::codec_name)
        .property("codec_string", &WebAVStream::codec_string)
        .property("profile", &WebAVStream::profile)
        .property("level", &WebAVStream::level)
        .property("channels", &WebAVStream::channels)
        .property("sample_rate", &WebAVStream::sample_rate)
        .property("sample_fmt", &WebAVStream::sample_fmt)
        .property("bit_rate", &WebAVStream::bit_rate)
        .property("extradata_size", &WebAVStream::extradata_size)
        .property("extradata", &WebAVStream::get_extradata)
        .property("start_time", &WebAVStream::start_time)
        .property("duration", &WebAVStream::duration)
        .property("nb_frames", &WebAVStream::nb_frames)
        .property("mime_type", &WebAVStream::mime_type)
        .property("tags", &WebAVStream::get_tags);

    value_object<WebMediaInfo>("WebMediaInfo")
        .field("format_name", &WebMediaInfo::format_name)
        .field("start_time", &WebMediaInfo::start_time)
        .field("duration", &WebMediaInfo::duration)
        .field("bit_rate", &WebMediaInfo::bit_rate)
        .field("nb_streams", &WebMediaInfo::nb_streams)
        .field("nb_chapters", &WebMediaInfo::nb_chapters)
        .field("flags", &WebMediaInfo::flags)
        .field("streams", &WebMediaInfo::streams);

    class_<WebAVPacket>("WebAVPacket")
        .constructor<>()
        .property("stream_index", &WebAVPacket::stream_index)
        .property("keyframe", &WebAVPacket::keyframe)
        .property("timestamp", &WebAVPacket::timestamp)
        .property("duration", &WebAVPacket::duration)
        .property("size", &WebAVPacket::size)
        .property("data", &WebAVPacket::get_data);

    function("open_source", select_overload<intptr_t(val, int)>(&open_source));
    function("close_source", &close_source);
    function("get_media_info", &get_media_info, return_value_policy::take_ownership());
    function("get_av_packet", &get_av_packet, return_value_policy::take_ownership());
    function("read_av_packet", &read_av_packet);

    function("set_av_log_level", &set_av_log_level);

    register_vector<uint8_t>("vector<uint8_t>");
    register_vector<Tag>("vector<Tag>");
    register_vector<WebAVStream>("vector<WebAVStream>");
}
