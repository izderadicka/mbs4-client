const STORAGE_KEY = "mbs4.tts";

export const TTS_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type TtsRate = (typeof TTS_RATES)[number];

export interface TtsPrefs {
  // voice name is the unique voice identifier; null = service default
  voice: string | null;
  rate: TtsRate;
}

const DEFAULTS: TtsPrefs = {
  voice: null,
  rate: 1,
};

function loadPrefs(): TtsPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      voice:
        typeof parsed.voice === "string" && parsed.voice.length > 0
          ? parsed.voice
          : DEFAULTS.voice,
      rate: (TTS_RATES as readonly number[]).includes(parsed.rate)
        ? parsed.rate
        : DEFAULTS.rate,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ttsPrefs));
  } catch {
    // best effort only
  }
}

export const ttsPrefs: TtsPrefs = $state(loadPrefs());

export function setTtsVoice(voice: string | null) {
  ttsPrefs.voice = voice;
  persist();
}

export function setTtsRate(rate: TtsRate) {
  ttsPrefs.rate = rate;
  persist();
}
