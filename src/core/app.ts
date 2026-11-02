import { loadProgress, saveProgress, updateSettings, type Progress, type Settings } from './saves'
import { sound } from './audio'

/** One shared slice of app state: progress, settings and the audio engine. */
class AppState {
  progress: Progress = loadProgress()

  constructor() {
    sound.setSound(this.progress.settings.sound)
    sound.setMusic(this.progress.settings.music)
  }

  refresh(): Progress {
    this.progress = loadProgress()
    return this.progress
  }

  save(): void {
    saveProgress(this.progress)
  }

  setSettings(patch: Partial<Settings>): Progress {
    this.progress = updateSettings(this.progress, patch)
    sound.setSound(this.progress.settings.sound)
    sound.setMusic(this.progress.settings.music)
    return this.progress
  }

  get settings(): Settings {
    return this.progress.settings
  }

  get reducedMotion(): boolean {
    return this.progress.settings.reducedMotion
  }

  get highContrast(): boolean {
    return this.progress.settings.highContrast
  }

  get speed(): number {
    return this.progress.settings.speed
  }
}

export const app = new AppState()
