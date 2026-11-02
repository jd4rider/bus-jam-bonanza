import Phaser from 'phaser'
import './style.css'
import { sound } from './core/audio'
import { AchievementsScene } from './phaser/AchievementsScene'
import { GameScene } from './phaser/GameScene'
import { LevelsScene } from './phaser/LevelsScene'
import { MenuScene } from './phaser/MenuScene'
import { SettingsScene } from './phaser/SettingsScene'
import { WorldsScene } from './phaser/WorldsScene'

declare global {
  interface Window {
    __BJB_GAME__?: Phaser.Game
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#141d30',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: typeof window === 'undefined' ? 720 : window.innerWidth,
    height: typeof window === 'undefined' ? 1280 : window.innerHeight,
  },
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  input: {
    activePointers: 3,
  },
  fps: { target: 60, forceSetTimeOut: false },
  scene: [MenuScene, WorldsScene, LevelsScene, GameScene, AchievementsScene, SettingsScene],
}

export const game = new Phaser.Game(config)
window.__BJB_GAME__ = game

// Browsers only allow audio after a gesture; unlock the synth once, quietly.
document.addEventListener('pointerdown', () => sound.unlock(), { once: true, capture: true })
document.addEventListener('keydown', () => sound.unlock(), { once: true, capture: true })

// Stop iOS Safari from rubber-banding the page while playing.
document.addEventListener(
  'touchmove',
  (event) => {
    if (event.touches.length > 1) return
    const target = event.target as HTMLElement | null
    if (target && target.tagName === 'CANVAS') event.preventDefault()
  },
  { passive: false },
)
