// 实现跨页面音乐继续播放
// 页面的 audio 元素需设置 id="bgMusic"，按音频 src 分别记忆播放进度
(function () {
  var KEY_PREFIX = 'bgMusic_time_';

  function getKey(audio) {
    var src = audio.currentSrc || audio.src || '';
    // 带 <source> 的 audio，src 属性可能为空，取第一个 source
    if (!src) {
      var s = audio.querySelector('source');
      if (s) src = s.src || '';
    }
    try {
      src = src.split('/').pop() || 'unknown';
    } catch (e) {}
    return KEY_PREFIX + src;
  }

  function setupMusic() {
    var audio = document.getElementById('bgMusic');
    if (!audio) return;

    // 让浏览器尽早加载音频，减少跳转后的等待时间
    audio.preload = 'auto';

    var key = getKey(audio);
    var savedTime = null;
    try {
      savedTime = sessionStorage.getItem(key);
    } catch (e) {}
    var targetTime = savedTime !== null ? parseFloat(savedTime) : 0;
    if (isNaN(targetTime) || !isFinite(targetTime) || targetTime < 0) {
      targetTime = 0;
    }

    var started = false;
    var gestureAttached = false;

    function attachGestureFallback() {
      if (gestureAttached) return;
      gestureAttached = true;
      // 自动播放被阻止时，等待用户第一次交互后播放（兼容 iOS Safari）
      function resume() {
        audio.play();
        document.removeEventListener('click', resume);
        document.removeEventListener('touchend', resume);
        document.removeEventListener('keydown', resume);
      }
      document.addEventListener('click', resume);
      document.addEventListener('touchend', resume);
      document.addEventListener('keydown', resume);
    }

    function startPlay() {
      if (started) return;
      started = true;

      // 先恢复播放位置，再播放，避免"先从0开始再跳"的卡顿感
      if (targetTime > 0) {
        try {
          if (!audio.duration || !isFinite(audio.duration) || targetTime < audio.duration) {
            audio.currentTime = targetTime;
          }
        } catch (e) {}
      }

      var p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () {
          attachGestureFallback();
        });
      }
    }

    // 必须等 metadata 加载完成后再设置 currentTime，否则 seek 会失败或导致卡顿
    if (audio.readyState >= 1) {
      startPlay();
    } else {
      audio.addEventListener('loadedmetadata', startPlay, { once: true });
      // 兜底：若 metadata 事件未及时触发，1 秒后强制启动
      setTimeout(function () {
        if (!started) startPlay();
      }, 1000);
    }
    // 加载失败（如 404）时也挂上交互兜底，保证点一下页面就有声音
    audio.addEventListener('error', attachGestureFallback);

    // 保存当前播放位置
    function saveTime() {
      if (audio.paused && audio.currentTime === 0) return;
      try {
        sessionStorage.setItem(key, audio.currentTime);
      } catch (e) {}
    }

    window.addEventListener('beforeunload', saveTime);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) saveTime();
    });
    // 每秒保存一次，防止页面意外关闭丢失进度
    setInterval(saveTime, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMusic);
  } else {
    setupMusic();
  }
})();
