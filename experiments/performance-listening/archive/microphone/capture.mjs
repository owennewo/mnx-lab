// Capture only. Pitch analysis runs in a separate worker, off the audio thread.
class Capture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(512);
    this.used = 0;
  }
  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let sample = 0;
      for (const channel of channels) sample += channel[i] / channels.length;
      this.buffer[this.used++] = sample;
      if (this.used === this.buffer.length) {
        this.port.postMessage(this.buffer, [this.buffer.buffer]);
        this.buffer = new Float32Array(512);
        this.used = 0;
      }
    }
    // Outputs remain zero: never monitor the microphone through the speakers.
    return true;
  }
}
registerProcessor("listening-capture", Capture);
