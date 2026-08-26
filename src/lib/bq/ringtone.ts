/** Phone-style ringtone: keeps looping until the caller hangs or answers. */
export function startRingtone(): () => void {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return () => undefined;
  const ctx = new AudioCtx();
  let stopped = false;
  let timer = 0;

  function tone(freq: number, at: number, dur: number, vol = 0.2) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
    gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + at);
    osc.stop(ctx.currentTime + at + dur + 0.02);
  }

  function cycle() {
    if (stopped) return;
    // dual-tone burst, repeated — no dead air longer than a beat
    tone(440, 0, 0.38);
    tone(554, 0, 0.38, 0.16);
    tone(440, 0.42, 0.38);
    tone(554, 0.42, 0.38, 0.16);
    tone(440, 0.84, 0.38);
    tone(554, 0.84, 0.38, 0.16);
    tone(440, 1.26, 0.38);
    tone(554, 1.26, 0.38, 0.16);
  }

  void ctx.resume();
  cycle();
  timer = window.setInterval(cycle, 2000);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    void ctx.close();
  };
}
