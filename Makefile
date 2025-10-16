FFMPEG_CONFIGURE_ARGS = \
	--target-os=none \
	--arch=x86_32 \
	--cc=emcc \
	--ranlib=emranlib \
	--disable-all \
	--disable-asm \
	--enable-avcodec \
	--enable-avformat \
	--enable-swresample \
	--enable-protocol=file

FFMPEG_DEV_CONFIGURE_ARGS = \
	--enable-debug=3  \
	--disable-stripping

MINI_DEMUX_ARGS = \
	--enable-demuxer=mov,mp4,m4a,3gp,3g2,matroska,webm,m4v

DEMUX_ARGS = \
	--enable-decoder=aac,mp3,flac,vorbis,opus \
	--enable-demuxer=mov,mp4,m4a,3gp,3g2,matroska,webm,mp3,ogg,flac,wav

WEB_DEMUXER_ARGS = \
	emcc ./lib/web-demuxer/*.c ./lib/web-demuxer/*.cpp \
		-lembind \
		-I./lib/FFmpeg \
		-L./lib/FFmpeg/libavformat -lavformat \
		-L./lib/FFmpeg/libavutil -lavutil \
		-L./lib/FFmpeg/libavcodec -lavcodec \
		-L./lib/FFmpeg/libswresample -lswresample \
		--post-js ./lib/web-demuxer/post.js \
		-O3 \
		-s EXPORT_ES6=1 \
		-s INVOKE_RUN=0 \
		-s ENVIRONMENT=node \
		-s ASYNCIFY \
		-s ALLOW_MEMORY_GROWTH=1


WEB_DEMUXER_DEV_ARGS = \
	-O0 \
	-g


clean:
	cd lib/FFmpeg && \
	make clean && \
	make distclean

ffmpeg-lib-mini:
	cd lib/FFmpeg && \
	emconfigure ./configure $(FFMPEG_CONFIGURE_ARGS) $(MINI_DEMUX_ARGS) && \
	emmake make

ffmpeg-lib:
	cd lib/FFmpeg && \
	emconfigure ./configure $(FFMPEG_CONFIGURE_ARGS) $(DEMUX_ARGS) && \
	emmake make

ffmpeg-lib-dev:
	cd lib/FFmpeg && \
	emconfigure ./configure $(FFMPEG_CONFIGURE_ARGS) $(DEMUX_ARGS) $(FFMPEG_DEV_CONFIGURE_ARGS) && \
	emmake make

web-demuxer: 
	$(WEB_DEMUXER_ARGS) -o ./seekeable-node/dist/web-demuxer.js
	
web-demuxer-mini:
	$(WEB_DEMUXER_ARGS) -o ./seekeable-node/dist/web-demuxer-mini.js

web-demuxer-dev:
	$(WEB_DEMUXER_ARGS) $(WEB_DEMUXER_DEV_ARGS) -o ./seekeable-node/dist/web-demuxer.js