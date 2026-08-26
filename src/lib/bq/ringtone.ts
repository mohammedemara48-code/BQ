/** Repeating ringtone while a call is ringing. Stops cleanly on hang-up. */
export function startRingtone(): () => void {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return () => undefined;
  const ctx = new AudioCtx();
  let stopped = false;
  let timer = 0;

  function beep() {
    if (stopped) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.value = 554;
    gain2.gain.setValueAtTime(0.0001, ctx.currentTime + 0.48);
    gain2.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.52);
    gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.48);
    osc2.stop(ctx.currentTime + 0.92);
  }

  void ctx.resume();
  beep();
  timer = window.setInterval(beep, 1600);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    void ctx.close();
  };
}
