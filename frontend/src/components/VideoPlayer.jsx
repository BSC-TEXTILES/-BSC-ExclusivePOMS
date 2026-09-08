import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

// Professional video player — custom controls (play/pause, seek, volume,
// fullscreen, speed), loading/error/empty states, responsive 16:9 container.
export function formatDuration(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined || Number.isNaN(Number(totalSeconds))) return '—';
  const s = Math.round(Number(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}:${String(r).padStart(2, '0')}`;
}

function fmtTime(sec) {
  if (!Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoPlayer({ src, poster, title, autoPlay = false }) {
  const videoRef = useRef(null);
  const wrapRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState(false);
  const [rate, setRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Reset state when the source changes
  useEffect(() => {
    setPlaying(false); setProgress(0); setCurrent(0); setDuration(0); setError(false); setBuffering(true);
  }, [src]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => setError(true)); } else { v.pause(); }
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setCurrent(v.currentTime);
    setProgress((v.currentTime / v.duration) * 100);
  };

  const seek = (e) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
  };

  const changeVolume = (e) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setMuted(val === 0);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else wrapRef.current?.requestFullscreen?.().catch(() => {});
  };

  const changeSpeed = (e) => {
    const val = Number(e.target.value);
    setRate(val);
    if (videoRef.current) videoRef.current.playbackRate = val;
  };

  if (!src) {
    return (
      <div className="vp-empty">
        <Icon name="video" size={40} />
        <p>No video available.</p>
        <span>Upload or add a video to display it here.</span>
      </div>
    );
  }

  return (
    <div className={`vp-wrap ${fullscreen ? 'fs' : ''}`} ref={wrapRef}>
      <div className="vp-stage" onClick={togglePlay} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePlay(); } }}
        aria-label={playing ? 'Pause video' : 'Play video'}>
        <video
          ref={videoRef}
          src={src}
          poster={poster || undefined}
          autoPlay={autoPlay}
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => { setDuration(e.target.duration); setBuffering(false); }}
          onTimeUpdate={onTimeUpdate}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onCanPlay={() => setBuffering(false)}
          onError={() => { setError(true); setBuffering(false); }}
          onEnded={() => setPlaying(false)}
          onClick={(e) => e.stopPropagation()}
        />
        {buffering && !error && (
          <div className="vp-loading"><span className="loading-spinner" /> Loading video…</div>
        )}
        {error && (
          <div className="vp-error">
            <Icon name="video" size={32} />
            <p>Unable to play this video.</p>
            <span>The file may be missing or in an unsupported format.</span>
          </div>
        )}
        {!playing && !buffering && !error && (
          <button className="vp-bigplay" aria-label="Play" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </button>
        )}
      </div>

      <div className="vp-controls" onClick={(e) => e.stopPropagation()}>
        <div className="vp-progress" onClick={seek} role="slider" aria-label="Seek"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div className="vp-progress-buffer" style={{ width: `${progress}%` }} />
          <div className="vp-progress-fill" style={{ width: `${progress}%` }} />
          <div className="vp-progress-knob" style={{ left: `${progress}%` }} />
        </div>
        <div className="vp-bar">
          <button className="vp-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}>
            {playing
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
          </button>
          <button className="vp-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'}>
            {muted || volume === 0
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 5 6 9H2v6h4l5 4V5Z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a11 11 0 0 1 0 14" /></svg>}
          </button>
          <input className="vp-volume" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
            onChange={changeVolume} aria-label="Volume" title="Volume" />
          <span className="vp-time">{fmtTime(current)} / {fmtTime(duration)}</span>
          <span className="vp-spacer" />
          <select className="vp-speed" value={rate} onChange={changeSpeed} aria-label="Playback speed" title="Playback speed">
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
          <button className="vp-btn" onClick={toggleFullscreen} aria-label="Fullscreen" title="Fullscreen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}