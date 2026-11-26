"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomState } from "@/lib/protocol";

/** Synthesized cues: no downloads, autoplay, or drawing-path work. */
export default function GameAudio({ room }: { room: RoomState | null }) {
  const [enabled, setEnabled] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const previous = useRef({ phase: room?.phase, score: 0 });
  const score = room?.players.reduce((sum, p) => sum + p.score, 0) ?? 0;

  function cue(notes: number[]) {
    const audio = context.current;
    if (!audio || audio.state !== "running" || document.hidden) return;
    notes.forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + index * 0.09;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.045, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }

  useEffect(() => {
    if (enabled && previous.current.phase) {
      if (room?.phase === "finished" && previous.current.phase !== "finished") cue([523, 659, 784, 1047]);
      else if (score > previous.current.score) cue([659, 880]);
      else if (room?.phase === "drawing" && previous.current.phase !== "drawing") cue([440, 660]);
    }
    previous.current = { phase: room?.phase, score };
  }, [room?.phase, score, enabled]);

  useEffect(() => () => { void context.current?.close().catch(() => {}); }, []);

  async function toggle() {
    if (enabled) {
      setEnabled(false);
      await context.current?.suspend().catch(() => {});
      return;
    }
    try {
      context.current ??= new AudioContext();
      await context.current.resume();
      setEnabled(true);
      cue([660]);
    } catch { setEnabled(false); }
  }

  return <button className="sound-control" type="button" aria-pressed={enabled} onClick={toggle} aria-label={enabled ? "Mute game sounds" : "Enable game sounds"}>SOUND {enabled ? "ON" : "OFF"}</button>;
}
