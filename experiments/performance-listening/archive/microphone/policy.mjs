// Microphone-only experiment. Never changes the frozen benchmark configuration.
export const db = (value) => 20 * Math.log10(Math.max(value, 1e-8));
export class MicrophonePolicy {
  constructor(config, options = {}) {
    this.config = config;
    this.marginDb = options.marginDb ?? 12;
    this.confirmationMs = options.confirmationMs ?? 75;
    if (
      ![0, 6, 12, 18].includes(this.marginDb) ||
      ![0, 50, 75, 100].includes(this.confirmationMs)
    )
      throw Error("Invalid microphone experiment settings");
    config.minFrames =
      this.confirmationMs === 0
        ? 2
        : Math.ceil(
            ((this.confirmationMs / 1000) * config.sampleRate) / config.hopSize,
          ) + 1;
    this.frames = 0;
    this.levels = [];
    this.calibrationFrames =
      this.marginDb === 0
        ? 0
        : Math.ceil((2 * config.sampleRate) / config.hopSize);
    this.calibrated = this.calibrationFrames === 0;
    this.noiseRms = null;
    this.absoluteFloor = config.rmsFloor;
  }
  wrap(scorer) {
    return (magnitude, rms) => {
      this.frames++;
      if (!this.calibrated) {
        // Same full analysis-window RMS as the detector gate; exclude startup padding.
        if (this.frames * this.config.hopSize >= this.config.fftSize)
          this.levels.push(rms);
        if (this.frames >= this.calibrationFrames) {
          this.levels.sort((a, b) => a - b);
          this.noiseRms =
            this.levels[Math.floor(0.9 * (this.levels.length - 1))] ?? 0;
          this.config.rmsFloor = Math.max(
            this.absoluteFloor,
            this.noiseRms * 10 ** (this.marginDb / 20),
          );
          this.calibrated = true;
          this.levels = [];
        }
        return new Float64Array(this.config.midiMax - this.config.midiMin + 1);
      }
      return scorer(magnitude, rms);
    };
  }
  summary() {
    return {
      marginDb: this.marginDb,
      requestedConfirmationMs: this.confirmationMs,
      minFrames: this.config.minFrames,
      confirmationSpanMs:
        (((this.config.minFrames - 1) * this.config.hopSize) /
          this.config.sampleRate) *
        1000,
      calibrated: this.calibrated,
      calibrationSeconds:
        (this.calibrationFrames * this.config.hopSize) / this.config.sampleRate,
      remainingSeconds: Math.max(
        0,
        ((this.calibrationFrames - this.frames) * this.config.hopSize) /
          this.config.sampleRate,
      ),
      noiseRms: this.noiseRms,
      noiseDb: this.noiseRms === null ? null : db(this.noiseRms),
      thresholdRms: this.config.rmsFloor,
      thresholdDb: db(this.config.rmsFloor),
    };
  }
}
