/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useRef } from "react";

export function useNotificationSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  const play = useCallback((type: "info" | "success" | "warning" = "info") => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      }
      const ctx = ctxRef.current;

      const configs = {
        info: [
          { freq: 523.25, start: 0, duration: 0.12, gain: 0.18 }, // C5
          { freq: 659.25, start: 0.1, duration: 0.12, gain: 0.18 }, // E5
          { freq: 783.99, start: 0.2, duration: 0.18, gain: 0.15 }, // G5
        ],
        success: [
          { freq: 523.25, start: 0, duration: 0.1, gain: 0.15 }, // C5
          { freq: 659.25, start: 0.08, duration: 0.1, gain: 0.15 }, // E5
          { freq: 1046.5, start: 0.16, duration: 0.22, gain: 0.12 }, // C6
        ],
        warning: [
          { freq: 440, start: 0, duration: 0.15, gain: 0.2 }, // A4
          { freq: 369.99, start: 0.18, duration: 0.25, gain: 0.18 }, // F#4
        ],
      };

      const notes = configs[type];
      const now = ctx.currentTime;

      notes.forEach(({ freq, start, duration, gain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);

        gainNode.gain.setValueAtTime(0, now + start);
        gainNode.gain.linearRampToValueAtTime(gain, now + start + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          now + start + duration,
        );

        osc.start(now + start);
        osc.stop(now + start + duration + 0.05);
      });
    } catch {}
  }, []);

  return { play };
}
