// Keeps read-aloud alive and controllable while the page is in the
// background or the screen is locked.
//
// Speech is played with WebAudio, which mobile browsers do not treat as
// media playback: there is no media notification, and once the screen locks
// the page is handled like any other background page (on Android its CPU
// priority drops, which slows in-browser synthesis below real time). A
// looping silent <audio> element played alongside the speech makes the
// browser see regular media playback; the Media Session API then puts the
// transport controls on the lock screen / notification.
//
// The element also follows audio focus: when the system pauses it (phone
// call, another player taking over) the speech is paused too.

import { encodeWavPcm16 } from "./mock-tts-service";

export interface BackgroundPlaybackHandlers {
  play(): void;
  pause(): void;
  stop(): void;
  next(): void;
  prev(): void;
}

export interface MediaInfo {
  title?: string;
  artist?: string;
}

// browsers show media controls only for audio of at least 5 seconds
const SILENCE_S = 10;
const SILENCE_SAMPLE_RATE = 8000;

const ACTIONS = [
  "play",
  "pause",
  "stop",
  "nexttrack",
  "previoustrack",
] as const satisfies MediaSessionAction[];

function mediaSession(): MediaSession | null {
  return typeof navigator !== "undefined" && "mediaSession" in navigator
    ? navigator.mediaSession
    : null;
}

export class BackgroundPlayback {
  #handlers: BackgroundPlaybackHandlers;
  #audio: HTMLAudioElement | null = null;
  #url: string | null = null;
  // what we asked the element to do; tells a system-initiated pause from ours
  #wantPlaying = false;

  #onAudioPause = () => {
    // paused by the system, not by us
    if (this.#wantPlaying) this.#handlers.pause();
  };

  constructor(handlers: BackgroundPlaybackHandlers) {
    this.#handlers = handlers;
    try {
      this.#url = URL.createObjectURL(
        new Blob(
          [
            encodeWavPcm16(
              new Float32Array(SILENCE_S * SILENCE_SAMPLE_RATE),
              SILENCE_SAMPLE_RATE,
            ),
          ],
          { type: "audio/wav" },
        ),
      );
      const audio = new Audio(this.#url);
      audio.loop = true;
      audio.addEventListener("pause", this.#onAudioPause);
      this.#audio = audio;
    } catch {
      // no media element support (tests, exotic browsers) - speech still
      // plays, just without the background keep-alive
      this.#audio = null;
    }
    const session = mediaSession();
    if (session) {
      const actions: Record<(typeof ACTIONS)[number], () => void> = {
        play: () => this.#handlers.play(),
        pause: () => this.#handlers.pause(),
        stop: () => this.#handlers.stop(),
        nexttrack: () => this.#handlers.next(),
        previoustrack: () => this.#handlers.prev(),
      };
      for (const action of ACTIONS) {
        try {
          session.setActionHandler(action, actions[action]);
        } catch {
          // action not supported by this browser
        }
      }
    }
  }

  setMetadata(info: MediaInfo): void {
    const session = mediaSession();
    if (!session || typeof MediaMetadata === "undefined") return;
    session.metadata = new MediaMetadata({
      title: info.title ?? "",
      artist: info.artist ?? "",
    });
  }

  // follow the speech: silent audio runs exactly while speech is playing (or
  // buffering). Call from a user gesture the first time (autoplay policy).
  setPlaying(playing: boolean): void {
    const session = mediaSession();
    if (session) session.playbackState = playing ? "playing" : "paused";
    const audio = this.#audio;
    if (!audio || playing === this.#wantPlaying) return;
    this.#wantPlaying = playing;
    try {
      if (playing) {
        // rejected when autoplay is blocked - speech itself is unaffected
        void audio.play()?.catch(() => {});
      } else {
        audio.pause();
      }
    } catch {
      // media element not functional (tests)
    }
  }

  destroy(): void {
    this.#wantPlaying = false;
    const audio = this.#audio;
    this.#audio = null;
    if (audio) {
      audio.removeEventListener("pause", this.#onAudioPause);
      try {
        audio.pause();
      } catch {
        // ignore
      }
      audio.removeAttribute("src");
    }
    if (this.#url) URL.revokeObjectURL(this.#url);
    this.#url = null;
    const session = mediaSession();
    if (session) {
      for (const action of ACTIONS) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
      session.metadata = null;
      session.playbackState = "none";
    }
  }
}
