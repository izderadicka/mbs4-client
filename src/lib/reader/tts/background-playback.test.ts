import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BackgroundPlayback,
  type BackgroundPlaybackHandlers,
} from "./background-playback";

// minimal stand-ins for the media element and the Media Session API
class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  loop = false;
  paused = true;
  constructor(public src: string) {
    super();
    FakeAudio.instances.push(this);
  }
  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
  removeAttribute(): void {
    this.src = "";
  }
}

function fakeSession() {
  const handlers = new Map<string, (() => void) | null>();
  return {
    handlers,
    metadata: null as unknown,
    playbackState: "none",
    setActionHandler(action: string, handler: (() => void) | null) {
      handlers.set(action, handler);
    },
  };
}

function fakeHandlers(): BackgroundPlaybackHandlers {
  return {
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
  };
}

describe("BackgroundPlayback", () => {
  let session: ReturnType<typeof fakeSession>;

  beforeEach(() => {
    FakeAudio.instances = [];
    session = fakeSession();
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal(
      "MediaMetadata",
      class {
        constructor(public init: unknown) {}
      },
    );
    vi.stubGlobal("navigator", { mediaSession: session });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:silence");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("plays looping silent audio exactly while speech is playing", () => {
    const bg = new BackgroundPlayback(fakeHandlers());
    const audio = FakeAudio.instances[0];
    expect(audio.loop).toBe(true);
    expect(audio.paused).toBe(true);

    bg.setPlaying(true);
    expect(audio.paused).toBe(false);
    expect(session.playbackState).toBe("playing");

    bg.setPlaying(false);
    expect(audio.paused).toBe(true);
    expect(session.playbackState).toBe("paused");
  });

  it("routes lock screen controls to the handlers", () => {
    const handlers = fakeHandlers();
    new BackgroundPlayback(handlers);
    session.handlers.get("play")!();
    session.handlers.get("pause")!();
    session.handlers.get("stop")!();
    session.handlers.get("nexttrack")!();
    session.handlers.get("previoustrack")!();
    expect(handlers.play).toHaveBeenCalledTimes(1);
    expect(handlers.pause).toHaveBeenCalledTimes(1);
    expect(handlers.stop).toHaveBeenCalledTimes(1);
    expect(handlers.next).toHaveBeenCalledTimes(1);
    expect(handlers.prev).toHaveBeenCalledTimes(1);
  });

  it("pauses speech when the system pauses the audio, not on our own pause", () => {
    const handlers = fakeHandlers();
    const bg = new BackgroundPlayback(handlers);
    const audio = FakeAudio.instances[0];

    bg.setPlaying(true);
    bg.setPlaying(false); // our own pause
    expect(handlers.pause).not.toHaveBeenCalled();

    bg.setPlaying(true);
    audio.pause(); // e.g. audio focus lost to a phone call
    expect(handlers.pause).toHaveBeenCalledTimes(1);
  });

  it("publishes the book as media metadata", () => {
    const bg = new BackgroundPlayback(fakeHandlers());
    bg.setMetadata({ title: "Book", artist: "Author" });
    expect((session.metadata as { init: unknown }).init).toEqual({
      title: "Book",
      artist: "Author",
    });
  });

  it("destroy releases the audio and the media session", () => {
    const bg = new BackgroundPlayback(fakeHandlers());
    const audio = FakeAudio.instances[0];
    bg.setPlaying(true);
    bg.destroy();
    expect(audio.paused).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:silence");
    expect(session.handlers.get("play")).toBeNull();
    expect(session.metadata).toBeNull();
    expect(session.playbackState).toBe("none");
  });

  it("is a no-op without media element support", () => {
    vi.stubGlobal("Audio", undefined);
    const bg = new BackgroundPlayback(fakeHandlers());
    expect(() => {
      bg.setPlaying(true);
      bg.setPlaying(false);
      bg.destroy();
    }).not.toThrow();
  });
});
