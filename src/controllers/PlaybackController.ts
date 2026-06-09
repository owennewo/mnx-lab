import { ReactiveController, ReactiveControllerHost } from 'lit';
import * as Tone from 'tone';
import { MnxStructure } from '../types/mnx.ts';
import { mnxToAudioEvents } from '../utils/mnxToAudio.ts';

export class PlaybackController implements ReactiveController {
  host: ReactiveControllerHost;
  
  isPlaying = false;
  tempo = 120;
  volume = -10; // dB
  activeNoteIds: string[] = [];
  playheadBeat = 0;
  
  private synth: Tone.PolySynth | null = null;
  private loopIntervalId: number | null = null;

  constructor(host: ReactiveControllerHost) {
    (this.host = host).addController(this);
  }

  hostConnected() {
    this.initSynth();
  }

  hostDisconnected() {
    this.cleanup();
  }

  private initSynth() {
    if (!this.synth) {
      this.synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: 'triangle' // softer, warm woodwind-like sound
        },
        envelope: {
          attack: 0.03,
          decay: 0.1,
          sustain: 0.4,
          release: 0.4
        }
      }).toDestination();
      
      this.synth.volume.value = this.volume;
    }
  }

  private cleanup() {
    this.stop();
    if (this.synth) {
      this.synth.dispose();
      this.synth = null;
    }
  }

  async startAudio() {
    if (Tone.context.state !== 'running') {
      await Tone.start();
      console.log('Tone.js audio context started');
    }
  }

  async play(mnx: MnxStructure) {
    await this.startAudio();
    this.initSynth();

    if (this.isPlaying) {
      this.pause();
      return;
    }

    this.isPlaying = true;
    this.host.requestUpdate();

    Tone.Transport.cancel();
    
    const audioEvents = mnxToAudioEvents(mnx);

    for (const event of audioEvents) {
      const tickTime = Math.round(event.beatTime * Tone.Transport.PPQ);
      const tickDuration = Math.round(event.beatDuration * Tone.Transport.PPQ);

      Tone.Transport.schedule((time) => {
        if (this.synth) {
          this.synth.triggerAttackRelease(event.pitches, `${tickDuration}i`, time);
        }

        Tone.Draw.schedule(() => {
          this.activeNoteIds = event.noteIds;
          this.playheadBeat = event.beatTime;
          this.host.requestUpdate();
        }, time);
      }, `${tickTime}i`);

      const endTick = tickTime + tickDuration;
      Tone.Transport.schedule((time) => {
        Tone.Draw.schedule(() => {
          if (JSON.stringify(this.activeNoteIds) === JSON.stringify(event.noteIds)) {
            this.activeNoteIds = [];
            this.host.requestUpdate();
          }
        }, time);
      }, `${endTick}i`);
    }

    Tone.Transport.bpm.value = this.tempo;
    this.startPlayheadTracker();
    Tone.Transport.start();
  }

  pause() {
    this.isPlaying = false;
    Tone.Transport.pause();
    this.stopPlayheadTracker();
    this.host.requestUpdate();
  }

  stop() {
    this.isPlaying = false;
    Tone.Transport.stop();
    Tone.Transport.cancel();
    this.stopPlayheadTracker();
    this.activeNoteIds = [];
    this.playheadBeat = 0;
    this.host.requestUpdate();
  }

  setTempo(bpm: number) {
    this.tempo = bpm;
    Tone.Transport.bpm.value = bpm;
    this.host.requestUpdate();
  }

  setVolume(db: number) {
    this.volume = db;
    if (this.synth) {
      this.synth.volume.value = db;
    }
    this.host.requestUpdate();
  }

  private startPlayheadTracker() {
    this.stopPlayheadTracker();
    
    this.loopIntervalId = window.setInterval(() => {
      const beats = Tone.Transport.seconds * (this.tempo / 60);
      this.playheadBeat = beats;
      this.host.requestUpdate();
    }, 50);
  }

  private stopPlayheadTracker() {
    if (this.loopIntervalId !== null) {
      clearInterval(this.loopIntervalId);
      this.loopIntervalId = null;
    }
  }
}
