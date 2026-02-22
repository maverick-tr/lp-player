import { createContext, useState, useRef, useEffect, useCallback } from 'react';
import { useSettings } from '../hooks/useSettings';

export const SoundContext = createContext();

const VINYL_SRC = '/sounds/vynl-drop-crackle.mp3';

const SILENCE_QUOTES = [
  "Life without music is just... debugging in silence.",
  "No music? Just vibes and compiler errors.",
  "Sound off. Pure chaos mode activated.",
  "Who needs music when you have stack traces?",
  "The sound of silence... and npm install.",
  "Music disabled. Productivity mode: questionable.",
  "Running in stealth mode. No tunes detected.",
  "Silence is golden. Errors are red.",
  "No beats, just bytes.",
  "The DJ has left the building.",
  "Audio? Where we're going, we don't need audio.",
  "Muted. But the code still slaps.",
  "Volume: 0. Anxiety: 100.",
  "Playing air guitar in silence.",
  "404: Music not found.",
  "Quiet mode. The bugs can't hear us coming.",
  "No soundtrack today. Just raw determination.",
  "Shh... the code is sleeping.",
  "Music off. Existential dread on.",
  "Deploying in silence like a ninja.",
  "The vinyl is on strike today.",
  "All dressed up, nowhere to groove.",
  "Silent disco for one, please.",
  "Beats per minute: 0. Bugs per minute: unknown.",
  "No tunes. Just you and the terminal.",
];

const GENRE_SEARCH_TERMS = {
  '90s pop': '90s+pop+hits',
  '80s rock': '80s+rock+classics',
  'jazz': 'jazz+classics',
  'classical': 'classical+music',
  'electronic': 'electronic+music',
  'lo-fi': 'lofi+beats',
  'hip hop': 'hip+hop+classics',
  'r&b/soul': 'r%26b+soul+classics',
  'funk': 'funk+music',
  'ambient': 'ambient+music',
};

export function SoundProvider({ children }) {
  const { settings } = useSettings();
  const [phase, setPhase] = useState('idle');
  const [nowPlaying, setNowPlaying] = useState(null);

  // Persistent refs (survive re-renders, not closed between launches)
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const cleanupRef = useRef(null);
  const trackCacheRef = useRef({});

  const soundEnabled = settings?.soundEffects?.enabled !== false;
  const genre = settings?.soundEffects?.genre || '90s pop';

  const fetchRandomTrack = useCallback(async (g) => {
    const searchTerm = GENRE_SEARCH_TERMS[g] || g.replace(/\s+/g, '+');
    // Return from cache if available
    if (trackCacheRef.current[g] && trackCacheRef.current[g].length > 0) {
      const tracks = trackCacheRef.current[g];
      return tracks[Math.floor(Math.random() * tracks.length)];
    }
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${searchTerm}&media=music&limit=50`
      );
      if (!res.ok) return null;
      const data = await res.json();
      const valid = (data.results || []).filter(r => r.previewUrl);
      if (valid.length === 0) return null;
      trackCacheRef.current[g] = valid;
      return valid[Math.floor(Math.random() * valid.length)];
    } catch {
      return null;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, []);

  const triggerLaunchSequence = useCallback(async (tool) => {
    // Clean up any in-flight sequence
    cleanup();

    const isSoundOn = settings?.soundEffects?.enabled !== false;
    const currentGenre = settings?.soundEffects?.genre || '90s pop';

    // If sound is disabled, run visual-only sequence
    if (!isSoundOn) {
      const quote = SILENCE_QUOTES[Math.floor(Math.random() * SILENCE_QUOTES.length)];
      setNowPlaying({ tool, track: null, quote });
      setPhase('slide-out');

      const timers = [];
      timers.push(setTimeout(() => setPhase('hold'), 500));
      timers.push(setTimeout(() => setPhase('slide-back'), 5500));
      timers.push(setTimeout(() => {
        setPhase('idle');
        setNowPlaying(null);
      }, 6000));

      cleanupRef.current = () => {
        timers.forEach(clearTimeout);
        setPhase('idle');
        setNowPlaying(null);
      };
      return;
    }

    // Sound-enabled path: lazy-init AudioContext
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Create analyser
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;
    analyser.connect(ctx.destination);
    analyserRef.current = analyser;

    // Vinyl audio element
    const vinylEl = new Audio();
    vinylEl.crossOrigin = 'anonymous';
    vinylEl.src = VINYL_SRC;
    vinylEl.volume = 1;

    let vinylSource;
    const vinylGain = ctx.createGain();
    vinylGain.gain.value = 0.6;
    vinylGain.connect(analyser);

    // Music audio element
    let musicEl = null;
    let musicSource = null;
    const musicGain = ctx.createGain();
    musicGain.gain.value = 0.4;
    musicGain.connect(analyser);

    // Fetch track in parallel with vinyl setup
    const trackPromise = fetchRandomTrack(currentGenre);

    // Start sequence
    setPhase('slide-out');

    let track = null;
    try {
      track = await trackPromise;
    } catch {
      // iTunes failed — proceed without music
    }

    setNowPlaying({
      tool,
      track: track ? {
        name: track.trackName,
        artist: track.artistName,
        artwork: track.artworkUrl60,
      } : null,
      quote: null,
    });

    // Play vinyl
    try {
      vinylSource = ctx.createMediaElementSource(vinylEl);
      vinylSource.connect(vinylGain);
      await vinylEl.play();
    } catch (e) {
      console.warn('Vinyl playback failed:', e);
    }

    // Play music track
    if (track && track.previewUrl) {
      musicEl = new Audio();
      musicEl.crossOrigin = 'anonymous';
      musicEl.src = track.previewUrl;
      musicEl.volume = 1;
      try {
        musicSource = ctx.createMediaElementSource(musicEl);
        musicSource.connect(musicGain);
        await musicEl.play();
      } catch (e) {
        console.warn('Music playback failed:', e);
      }
    }

    const timers = [];

    // Phase transitions
    timers.push(setTimeout(() => setPhase('hold'), 500));

    // Begin fade at 4s
    timers.push(setTimeout(() => {
      const fadeStart = ctx.currentTime;
      const fadeDuration = 1.5;
      vinylGain.gain.setValueAtTime(vinylGain.gain.value, fadeStart);
      vinylGain.gain.linearRampToValueAtTime(0, fadeStart + fadeDuration);
      musicGain.gain.setValueAtTime(musicGain.gain.value, fadeStart);
      musicGain.gain.linearRampToValueAtTime(0, fadeStart + fadeDuration);
    }, 4000));

    // Slide back at 5.5s
    timers.push(setTimeout(() => setPhase('slide-back'), 5500));

    // End at 6s
    timers.push(setTimeout(() => {
      vinylEl.pause();
      vinylEl.currentTime = 0;
      if (musicEl) {
        musicEl.pause();
        musicEl.currentTime = 0;
      }
      analyserRef.current = null;
      setPhase('idle');
      setNowPlaying(null);
    }, 6000));

    cleanupRef.current = () => {
      timers.forEach(clearTimeout);
      try { vinylEl.pause(); } catch {}
      try { if (musicEl) musicEl.pause(); } catch {}
      vinylGain.gain.cancelScheduledValues(0);
      musicGain.gain.cancelScheduledValues(0);
      analyserRef.current = null;
      setPhase('idle');
      setNowPlaying(null);
    };
  }, [settings, fetchRandomTrack, cleanup]);

  // Listen for app-launched events
  useEffect(() => {
    const handler = (e) => {
      const { tool } = e.detail;
      if (tool) {
        triggerLaunchSequence(tool);
      }
    };
    window.addEventListener('app-launched', handler);
    return () => window.removeEventListener('app-launched', handler);
  }, [triggerLaunchSequence]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return (
    <SoundContext.Provider value={{
      phase,
      nowPlaying,
      analyserNode: analyserRef.current,
      analyserRef,
      soundEnabled,
    }}>
      {children}
    </SoundContext.Provider>
  );
}
