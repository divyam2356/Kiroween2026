/**
 * Audio is a view layer. It never reads or writes game state; main.ts tells it what is
 * audible and how loud. Muting changes nothing except the master gain.
 *
 * Puzzle sounds that have no recorded clip (the clock, the fire) are synthesised once into
 * small looping buffers, so stealing a sound in the game audibly removes it from the house.
 */

type LoopSource = { url: string } | { synth: 'ticking' | 'fire' | 'drone' | 'water' };

interface Loop {
  source: AudioBufferSourceNode;
  gain: GainNode;
  pan: StereoPannerNode;
}

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly loops = new Map<string, Loop>();

  async init(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.applyMute();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMute();
  }

  isMuted(): boolean {
    return this.muted;
  }

  private applyMute(): void {
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.context.currentTime, 0.05);
  }

  private load(key: string, source: LoopSource): Promise<AudioBuffer | null> {
    let pending = this.buffers.get(key);
    if (!pending) {
      pending = this.createBuffer(source);
      this.buffers.set(key, pending);
    }
    return pending;
  }

  private async createBuffer(source: LoopSource): Promise<AudioBuffer | null> {
    const context = this.context;
    if (!context) return null;
    if ('url' in source) {
      try {
        const response = await fetch(source.url);
        if (!response.ok) return null;
        return await context.decodeAudioData(await response.arrayBuffer());
      } catch {
        return null;
      }
    }
    const rate = context.sampleRate;
    if (source.synth === 'ticking') {
      // One tick and one tock per second, each a short filtered click.
      const buffer = context.createBuffer(1, rate, rate);
      const data = buffer.getChannelData(0);
      for (const [start, pitch] of [[0, 2400], [0.5, 1700]] as const) {
        const offset = Math.floor(start * rate);
        for (let i = 0; i < rate * 0.03; i += 1) {
          const t = i / rate;
          data[offset + i] += Math.sin(2 * Math.PI * pitch * t) * Math.exp(-t * 180) * 0.7 + (Math.random() * 2 - 1) * Math.exp(-t * 400) * 0.25;
        }
      }
      return buffer;
    }
    if (source.synth === 'water') {
      const length = rate * 3;
      const buffer = context.createBuffer(1, length, rate);
      const data = buffer.getChannelData(0);
      let smooth = 0;
      for (let i = 0; i < length; i += 1) {
        smooth = smooth * 0.6 + (Math.random() * 2 - 1) * 0.4;
        data[i] = smooth * (0.55 + 0.15 * Math.sin(i / rate * 9));
      }
      return buffer;
    }
    if (source.synth === 'fire') {
      const length = rate * 3;
      const buffer = context.createBuffer(1, length, rate);
      const data = buffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < length; i += 1) {
        brown = (brown + (Math.random() * 2 - 1) * 0.02) * 0.995;
        data[i] = brown * 3;
      }
      for (let pop = 0; pop < 40; pop += 1) {
        const at = Math.floor(Math.random() * (length - rate * 0.02));
        const strength = 0.2 + Math.random() * 0.6;
        for (let i = 0; i < rate * 0.012; i += 1) data[at + i] += (Math.random() * 2 - 1) * strength * Math.exp(-i / (rate * 0.002));
      }
      return buffer;
    }
    const length = rate * 4;
    const buffer = context.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const t = i / rate;
      data[i] = (Math.sin(2 * Math.PI * 55 * t) * 0.3 + Math.sin(2 * Math.PI * 82.5 * t + Math.sin(t * 1.5)) * 0.2) * (0.7 + 0.3 * Math.sin((Math.PI * t) / 2));
    }
    return buffer;
  }

  /** Start (once) a looping sound. Its volume starts at zero until setLevel is called. */
  async ensureLoop(id: string, source: LoopSource): Promise<void> {
    if (this.loops.has(id) || !this.context || !this.master) return;
    const placeholder = {} as Loop;
    this.loops.set(id, placeholder);
    const buffer = await this.load(id, source);
    if (!buffer || !this.context || !this.master) {
      this.loops.delete(id);
      return;
    }
    const node = this.context.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
    const gain = this.context.createGain();
    gain.gain.value = 0;
    const pan = this.context.createStereoPanner();
    node.connect(gain).connect(pan).connect(this.master);
    node.start();
    Object.assign(placeholder, { source: node, gain, pan });
  }

  setLevel(id: string, volume: number, pan = 0): void {
    const loop = this.loops.get(id);
    if (!loop?.gain || !this.context) return;
    loop.gain.gain.setTargetAtTime(volume, this.context.currentTime, 0.12);
    loop.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), this.context.currentTime, 0.12);
  }

  async playOnce(url: string, volume = 0.8): Promise<void> {
    if (!this.context || !this.master) return;
    const buffer = await this.load(url, { url });
    if (!buffer || !this.context || !this.master) return;
    const node = this.context.createBufferSource();
    node.buffer = buffer;
    const gain = this.context.createGain();
    gain.gain.value = volume;
    node.connect(gain).connect(this.master);
    node.start();
  }
}
