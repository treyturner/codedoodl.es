// The supported browsers provide transforms, RAF and ES array/DOM APIs natively.
// Only input capability and codec choice need detection in this application.
(() => {
  const hover = matchMedia('(hover: hover)').matches;
  const video = document.createElement('video');
  const canPlay = type => video.canPlayType(type).replace(/^no$/, '');
  window.Features = Object.freeze({
    hover,
    video: Object.freeze({
      webm: canPlay('video/webm; codecs="vp8, vorbis"'),
      h264: canPlay('video/mp4; codecs="avc1.42E01E"'),
    }),
  });
  document.documentElement.classList.replace('no-js', 'js');
  document.documentElement.classList.add(hover ? 'can-hover' : 'no-hover');
})();
