let audioCtx: AudioContext | null = null;
let isUnlocked = false;

// Call this on a user interaction (like a click) to unlock the audio context
export const unlockAudioContext = () => {
  if (isUnlocked) return;
  
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    // Play a silent buffer to truly unlock it on iOS/Safari
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
    
    isUnlocked = true;
    
    // Remove the event listeners since it's unlocked
    document.removeEventListener('click', unlockAudioContext);
    document.removeEventListener('touchstart', unlockAudioContext);
  } catch (e) {
    console.error("Failed to unlock audio context", e);
  }
};

// Start listening for the first interaction immediately
if (typeof document !== 'undefined') {
  document.addEventListener('click', unlockAudioContext, { once: true });
  document.addEventListener('touchstart', unlockAudioContext, { once: true });
}

export const playNotificationSound = () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Attempt to resume if suspended, even if not unlocked via click
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const play = (freq: number, startTime: number, duration: number) => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    
    const t = audioCtx.currentTime;
    play(880, t, 0.3);        // A5
    play(1108, t + 0.18, 0.4); // C#6
    play(1318, t + 0.36, 0.5); // E6
  } catch (e) {
    console.error("Audio failed to play", e);
  }
};
