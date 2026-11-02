import Phaser from 'phaser'
import { app } from '../core/app'
import { arcade } from '../core/arcade'
import { sound } from '../core/audio'
import type { Settings } from '../core/saves'
import { backdrop, button, fadeIn, fadeTo, iconButton, label, panel, PAPER, stage, title } from './common'

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings')
  }

  create(): void {
    app.refresh()
    backdrop(this)
    const root = stage(this)
    fadeIn(this)

    root.add(iconButton(this, 54, 68, '\u2190', () => fadeTo(this, 'Menu'), { size: 54, fill: 0x223354 }))
    root.add(title(this, 360, 62, 'Options', 40, PAPER))
    root.add(label(this, 360, 110, 'Comfort settings save instantly.', 14, '#9fb0ca', { origin: 0.5 }))

    const rows: Array<{ key: keyof Settings; title: string; description: string }> = [
      { key: 'sound', title: 'Sound effects', description: 'Horns, boarding chimes, departures.' },
      { key: 'music', title: 'Music', description: 'A gentle generated loop.' },
      { key: 'reducedMotion', title: 'Reduced motion', description: 'Calmer bobbing and shorter celebrations.' },
      { key: 'highContrast', title: 'High contrast', description: 'Stronger outlines on buses and passengers.' },
    ]

    rows.forEach((row, index) => {
      const y = 168 + index * 100
      const card = panel(this, 40, y, 640, 84, { fill: 0xfff3d9, side: 0xd8c9a8, radius: 20 })
      root.add(card)
      card.add(label(this, 22, 16, row.title, 18, '#243046', { fontStyle: 'bold' }))
      card.add(label(this, 22, 44, row.description, 12, '#6f7a8d'))
      const value = app.settings[row.key]
      const on = value === true
      const toggle = button(this, 520, 20, 100, 44, on ? 'ON' : 'OFF', () => {
        const patch: Partial<Settings> = {}
        if (row.key === 'sound') {
          patch.sound = !app.settings.sound
          sound.setSound(patch.sound)
          sound.click()
        }
        if (row.key === 'music') {
          patch.music = !app.settings.music
          sound.setMusic(patch.music)
        }
        if (row.key === 'reducedMotion') patch.reducedMotion = !app.settings.reducedMotion
        if (row.key === 'highContrast') patch.highContrast = !app.settings.highContrast
        app.setSettings(patch)
        this.scene.restart()
      }, { fill: on ? 0x4fb98a : 0x8a93a6, textColor: '#ffffff', size: 15, radius: 14 })
      card.add(toggle)
    })

    const speedY = 590
    const speedCard = panel(this, 40, speedY, 640, 108, { fill: 0xfff3d9, side: 0xd8c9a8, radius: 20 })
    root.add(speedCard)
    speedCard.add(label(this, 22, 16, 'Animation speed', 18, '#243046', { fontStyle: 'bold' }))
    speedCard.add(label(this, 22, 44, 'Boarding and driving animations.', 12, '#6f7a8d'))
    const speeds = [
      { label: '0.7\u00d7', value: 0.7 },
      { label: '1\u00d7', value: 1 },
      { label: '1.4\u00d7', value: 1.4 },
    ]
    speeds.forEach((speed, index) => {
      const active = Math.abs(app.settings.speed - speed.value) < 0.05
      speedCard.add(
        button(this, 280 + index * 110, 24, 100, 46, speed.label, () => {
          app.setSettings({ speed: speed.value })
          this.scene.restart()
        }, { fill: active ? 0xf2c94c : 0x8a93a6, textColor: active ? '#2a2314' : '#ffffff', size: 15, radius: 14 }),
      )
    })

    const arcadeCard = panel(this, 40, 728, 640, 176, { fill: 0x223354, side: 0x111a2b, radius: 22, highlight: false })
    root.add(arcadeCard)
    arcadeCard.add(label(this, 22, 16, 'Little Joy Arcade', 18, PAPER, { fontStyle: 'bold' }))
    arcadeCard.add(label(this, 22, 46, `${arcade.available() ? arcade.userLabel() : 'Guest play'} \u00b7 ${arcade.status()}`, 12, '#9fb0ca'))
    arcadeCard.add(
      label(this, 22, 70, 'Progress is saved on this device and syncs when you sign in through the arcade client.', 11, '#8fa3c2', {
        wrap: 584,
      }),
    )
    arcadeCard.add(button(this, 22, 110, 240, 46, 'Open Little Joy Arcade', () => arcade.openArcade(), {
      fill: 0x4f8ff0,
      textColor: '#ffffff',
      size: 13,
      radius: 14,
    }))
    arcadeCard.add(button(this, 278, 110, 160, 46, 'Sync now', () => {
      void arcade.sync()
      this.scene.restart()
    }, { fill: 0x4fb98a, textColor: '#ffffff', size: 14, radius: 14 }))

    root.add(
      label(this, 360, 948, 'Keyboard: U undo \u00b7 R restart \u00b7 H hint \u00b7 Esc pause', 12, '#8fa3c2', { origin: 0.5 }),
    )
    root.add(
      label(this, 360, 974, 'Colour is never the only cue: every colour has its own symbol.', 12, '#8fa3c2', { origin: 0.5 }),
    )

    root.add(
      button(this, 250, 1060, 220, 58, 'Back', () => fadeTo(this, 'Menu'), {
        fill: 0x223354,
        textColor: PAPER,
        size: 17,
        radius: 18,
      }),
    )

    root.add(
      label(this, 360, 1160, `Save schema v${app.progress.version} \u00b7 ${Object.keys(app.progress.completed).length} stops cleared`, 11, '#6f819e', {
        origin: 0.5,
      }),
    )
  }
}
