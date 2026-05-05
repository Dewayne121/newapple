import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// expo-av only on native — not available / broken on web
let NativeVideo = null;
if (Platform.OS !== 'web') {
  try { NativeVideo = require('expo-av').Video; } catch {}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(sec) {
  if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// VideoPlayer — proprietary custom viewer
//
//   • Web:  HTML5 <video> via createElement (no expo-av)
//   • Native: expo-av Video with custom overlay controls
//
//   Props:  source (string uri | { uri }), style, showWatermark, autoPlay
// ---------------------------------------------------------------------------
export default function VideoPlayer({
  source,
  style,
  showWatermark = true,
  autoPlay = false,
}) {
  const uri = typeof source === 'string' ? source : source?.uri;

  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [ended, setEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [barWidth, setBarWidth] = useState(1);

  const webRef = useRef(null);
  const nativeRef = useRef(null);
  const hideTimer = useRef(null);
  const playingRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  playingRef.current = playing;

  // ── Auto-hide controls ──
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playingRef.current) setControlsVisible(false);
    }, 3500);
  }, []);

  // Animate controls in/out
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: controlsVisible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [controlsVisible]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  // ── Tap screen → toggle controls ──
  const handleScreenTap = useCallback(() => {
    setControlsVisible(prev => {
      if (!prev) scheduleHide();
      return !prev;
    });
  }, [scheduleHide]);

  // ── Play / Pause ──
  const togglePlay = useCallback((e) => {
    e?.stopPropagation?.();

    if (Platform.OS === 'web') {
      const el = webRef.current;
      if (!el) return;
      if (playingRef.current) {
        el.pause();
        setPlaying(false);
        setControlsVisible(true);
      } else {
        el.play().catch(() => {});
        setPlaying(true);
        setEnded(false);
        scheduleHide();
      }
    } else {
      if (playingRef.current) {
        nativeRef.current?.pauseAsync();
        setPlaying(false);
        setControlsVisible(true);
      } else {
        nativeRef.current?.playAsync();
        setPlaying(true);
        setEnded(false);
        scheduleHide();
      }
    }
  }, [scheduleHide]);

  // ── Seek ──
  const seekTo = useCallback((fraction) => {
    const clamped = Math.max(0, Math.min(1, fraction));
    const time = clamped * duration;
    setCurrentTime(time);
    if (Platform.OS === 'web') {
      if (webRef.current) webRef.current.currentTime = time;
    } else {
      nativeRef.current?.setPositionAsync(time * 1000);
    }
  }, [duration]);

  const handleSeekPress = useCallback((evt) => {
    const x = evt.nativeEvent.locationX;
    if (x !== undefined && barWidth > 0) seekTo(x / barWidth);
  }, [barWidth, seekTo]);

  // ── Replay ──
  const handleReplay = useCallback((e) => {
    e?.stopPropagation?.();
    if (Platform.OS === 'web') {
      const el = webRef.current;
      if (el) { el.currentTime = 0; el.play().catch(() => {}); }
    } else {
      nativeRef.current?.setPositionAsync(0);
      nativeRef.current?.playAsync();
    }
    setPlaying(true);
    setEnded(false);
    scheduleHide();
  }, [scheduleHide]);

  // ── Native status callback ──
  const onNativeStatus = useCallback((status) => {
    if (!status.isLoaded) return;
    setLoaded(true);
    setBuffering(status.isBuffering);
    setCurrentTime(status.positionMillis / 1000);
    setDuration(status.durationMillis / 1000);
    if (status.didJustFinish) {
      setPlaying(false);
      setEnded(true);
      setControlsVisible(true);
    }
  }, []);

  const progress = duration > 0 ? currentTime / duration : 0;

  // ── RENDER ──
  return (
    <View style={[s.root, style]}>
      {/* ---- Video element ---- */}
      {Platform.OS === 'web' ? (
        React.createElement('video', {
          ref: webRef,
          src: uri,
          style: {
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            backgroundColor: '#000',
            display: 'block',
          },
          playsInline: true,
          preload: 'auto',
          onClick: handleScreenTap,
          onDoubleClick: togglePlay,
          onLoadedMetadata: (e) => {
            setDuration(e.target.duration);
            setLoaded(true);
          },
          onTimeUpdate: (e) => setCurrentTime(e.target.currentTime),
          onEnded: () => {
            setPlaying(false);
            setEnded(true);
            setControlsVisible(true);
          },
          onWaiting: () => setBuffering(true),
          onPlaying: () => { setBuffering(false); setPlaying(true); },
          onPause: () => setPlaying(false),
          onCanPlay: () => { setBuffering(false); setLoaded(true); },
        })
      ) : NativeVideo ? (
        <NativeVideo
          ref={nativeRef}
          source={{ uri }}
          style={s.videoEl}
          resizeMode="contain"
          shouldPlay={autoPlay}
          onPlaybackStatusUpdate={onNativeStatus}
          onTouchEnd={handleScreenTap}
        />
      ) : (
        <View style={s.placeholder}>
          <Text style={{ color: '#52525b' }}>Video unavailable</Text>
        </View>
      )}

      {/* ---- Loading spinner ---- */}
      {(!loaded || buffering) && (
        <View style={s.spinner} pointerEvents="none">
          <ActivityIndicator size="large" color="#DC2626" />
        </View>
      )}

      {/* ---- Ended replay overlay ---- */}
      {ended && (
        <TouchableOpacity style={s.replayLayer} onPress={handleReplay} activeOpacity={0.8}>
          <View style={s.replayCircle}>
            <Ionicons name="refresh" size={32} color="#fff" />
          </View>
        </TouchableOpacity>
      )}

      {/* ---- Center play/pause (only when not ended) ---- */}
      {!ended && (
        <Animated.View
          style={[s.centerLayer, { opacity: fadeAnim }]}
          pointerEvents={controlsVisible ? 'auto' : 'none'}
        >
          {controlsVisible && !playing && (
            <TouchableOpacity onPress={togglePlay} activeOpacity={0.8}>
              <View style={s.centerCircle}>
                <Ionicons name="play" size={34} color="#fff" style={{ marginLeft: 3 }} />
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* ---- Bottom bar ---- */}
      <Animated.View
        style={[s.bottomBar, { opacity: fadeAnim }]}
        pointerEvents={controlsVisible ? 'auto' : 'none'}
      >
        {/* Seek track */}
        <TouchableOpacity
          style={s.seekHit}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width || 1)}
          onPress={handleSeekPress}
          activeOpacity={1}
        >
          <View style={s.track}>
            <View style={[s.trackFill, { width: `${(progress * 100).toFixed(2)}%` }]} />
          </View>
          <View style={[s.thumb, { left: `${(progress * 100).toFixed(2)}%` }]} />
        </TouchableOpacity>

        {/* Row: play/pause + time */}
        <View style={s.ctrlRow}>
          <TouchableOpacity onPress={togglePlay} style={s.ctrlBtn} activeOpacity={0.7}>
            <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#fafafa" />
          </TouchableOpacity>
          <Text style={s.time}>{fmt(currentTime)} / {fmt(duration)}</Text>
        </View>
      </Animated.View>

      {/* ---- Watermark ---- */}
      {showWatermark && (
        <View style={s.watermark} pointerEvents="none">
          <Image
            source={require('../../assets/logo.png')}
            style={s.wmLogo}
            resizeMode="contain"
          />
          <Text style={s.wmText}>UNYIELD</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  videoEl: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0b',
  },

  // Loading
  spinner: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  // Center play/pause
  centerLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Replay
  replayLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  replayCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(220, 38, 38, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 14,
  },

  // Seek bar
  seekHit: {
    height: 28,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: '#DC2626',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC2626',
    marginTop: -6,
    marginLeft: -6,
    elevation: 4,
  },

  // Controls row
  ctrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  ctrlBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  time: {
    fontSize: 11,
    fontFamily: 'SpaceGroteskSemiBold',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.3,
  },

  // Watermark
  watermark: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  wmLogo: {
    width: 24,
    height: 24,
    tintColor: 'rgba(255, 255, 255, 0.6)',
  },
  wmText: {
    fontSize: 11,
    fontFamily: 'SpaceGroteskBold',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 2,
  },
});
