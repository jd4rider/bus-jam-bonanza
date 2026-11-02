// Tiny WebAudio synth: every sound is generated at runtime, so the game ships
// no audio files and has no licensing questions. Autoplay rules are respected
// by creating the AudioContext only after the first pointer/key event.

type Tone = {
  frequency: number
  duration: number
  type: OscillatorType
  gain: number
  delay?: number
  slideTo?: number
}

const MUSIC_NOTES = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 349.23]
const MUSIC_BASS = [130.81, 146.83, 174.61, 196.0]

export class SoundEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private musicTimer: number | null = null
  private musicStep = 0
  soundOn = true
  musicOn = true

  unlock(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume()
      return
    }
    const Ctor = typeof window !== 'undefined' ? window.AudioContext : undefined
    if (!Ctor) return
    this.context = new Ctor()
    this.master = this.context.createGain()
    this.master.gain.value = 0.55
    this.master.connect(this.context.destination)
    this.sfxBus = this.context.createGain()
    this.sfxBus.gain.value = 1
    this.sfxBus.connect(this.master)
    this.musicBus = this.context.createGain()
    this.musicBus.gain.value = 0.22
    this.musicBus.connect(this.master)
    if (this.musicOn) this.startMusic()
  }

  setSound(on: boolean): void {
    this.soundOn = on
  }

  setMusic(on: boolean): void {
    this.musicOn = on
    if (on) this.startMusic()
    else this.stopMusic()
  }

  private tone(tone: Tone): void {
    if (!this.soundOn || !this.context || !this.sfxBus) return
    const start = this.context.currentTime + (tone.delay ?? 0)
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = tone.type
    oscillator.frequency.setValueAtTime(tone.frequency, start)
    if (tone.slideTo) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, tone.slideTo), start + tone.duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, tone.gain), start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration)
    oscillator.connect(gain)
    gain.connect(this.sfxBus)
    oscillator.start(start)
    oscillator.stop(start + tone.duration + 0.03)
  }

  click(): void {
    this.tone({ frequency: 520, duration: 0.06, type: 'sine', gain: 0.16 })
  }

  select(): void {
    this.tone({ frequency: 660, duration: 0.09, type: 'triangle', gain: 0.18 })
    this.tone({ frequency: 880, duration: 0.1, type: 'sine', gain: 0.12, delay: 0.05 })
  }

  blocked(): void {
    this.tone({ frequency: 190, duration: 0.16, type: 'sawtooth', gain: 0.1, slideTo: 120 })
    this.tone({ frequency: 150, duration: 0.18, type: 'square', gain: 0.06, delay: 0.06 })
  }

  horn(): void {
    this.tone({ frequency: 392, duration: 0.18, type: 'triangle', gain: 0.14 })
    this.tone({ frequency: 494, duration: 0.22, type: 'triangle', gain: 0.11, delay: 0.02 })
  }

  board(): void {
    this.tone({ frequency: 740, duration: 0.1, type: 'sine', gain: 0.14 })
    this.tone({ frequency: 988, duration: 0.12, type: 'sine', gain: 0.1, delay: 0.04 })
  }

  depart(): void {
    this.tone({ frequency: 330, duration: 0.28, type: 'triangle', gain: 0.16, slideTo: 660 })
    this.tone({ frequency: 494, duration: 0.32, type: 'sine', gain: 0.1, delay: 0.08 })
  }

  gate(): void {
    this.tone({ frequency: 220, duration: 0.2, type: 'square', gain: 0.08, slideTo: 440 })
  }

  undo(): void {
    this.tone({ frequency: 420, duration: 0.12, type: 'sine', gain: 0.12, slideTo: 280 })
  }

  hint(): void {
    this.tone({ frequency: 880, duration: 0.12, type: 'sine', gain: 0.1 })
    this.tone({ frequency: 1175, duration: 0.16, type: 'sine', gain: 0.09, delay: 0.08 })
  }

  win(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((frequency, index) =>
      this.tone({ frequency, duration: 0.34, type: 'triangle', gain: 0.16, delay: index * 0.11 }),
    )
  }

  lose(): void {
    this.tone({ frequency: 392, duration: 0.3, type: 'triangle', gain: 0.12, slideTo: 261 })
    this.tone({ frequency: 261, duration: 0.36, type: 'sine', gain: 0.1, delay: 0.16 })
  }

  private startMusic(): void {
    if (!this.musicOn || !this.context || this.musicTimer !== null) return
    this.musicTimer = window.setInterval(() => this.musicTick(), 620)
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer)
      this.musicTimer = null
    }
  }

  private musicTick(): void {
    if (!this.context || !this.musicBus || !this.musicOn) return
    const context = this.context
    const start = context.currentTime
    const note = MUSIC_NOTES[this.musicStep % MUSIC_NOTES.length]
    const bass = MUSIC_BASS[Math.floor(this.musicStep / 4) % MUSIC_BASS.length]
    const voice = context.createOscillator()
    const gain = context.createGain()
    voice.type = 'triangle'
    voice.frequency.value = note
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.05, start + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6)
    voice.connect(gain)
    gain.connect(this.musicBus)
    voice.start(start)
    voice.stop(start + 0.65)

    const bassVoice = context.createOscillator()
    const bassGain = context.createGain()
    bassVoice.type = 'sine'
    bassVoice.frequency.value = bass
    bassGain.gain.setValueAtTime(0.0001, start)
    bassGain.gain.exponentialRampToValueAtTime(0.04, start + 0.1)
    bassGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9)
    bassVoice.connect(bassGain)
    bassGain.connect(this.musicBus)
    bassVoice.start(start)
    bassVoice.stop(start + 0.95)
    this.musicStep += 1
  }
}

export const sound = new SoundEngine()
