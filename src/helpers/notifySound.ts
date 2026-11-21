let ctx: AudioContext | null = null;
let unlocked = false;

function audio() {
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export async function unlockNotifySound() {
  const sound = audio();
  if (!sound) return;
  if (sound.state === "suspended") {
    await sound.resume().catch(() => undefined);
  }
  unlocked = sound.state === "running";
}

export async function playReadyChime() {
  const sound = audio();
  if (!sound) return false;
  if (sound.state === "suspended") {
    await sound.resume().catch(() => undefined);
  }
  if (sound.state !== "running") return false;
  try {
    const now = sound.currentTime;
    const master = sound.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    master.connect(sound.destination);

    const first = sound.createOscillator();
    first.type = "triangle";
    first.frequency.setValueAtTime(932, now);
    first.connect(master);
    first.start(now);
    first.stop(now + 0.22);

    const second = sound.createOscillator();
    second.type = "triangle";
    second.frequency.setValueAtTime(1397, now + 0.16);
    second.connect(master);
    second.start(now + 0.16);
    second.stop(now + 0.62);
    unlocked = true;
    return true;
  } catch {
    return false;
  }
}

export function notifySoundReady() {
  return unlocked;
}
