import Phaser from 'phaser'
import { app } from '../core/app'
import { ACHIEVEMENTS } from '../core/achievements'
import { COLOR_META, type SymbolShape } from '../core/types'
import { backdrop, fadeIn, fadeTo, iconButton, label, panel, PAPER, stage, title } from './common'
import { drawSymbol } from './draw'

const ICONS: Record<string, { shape: SymbolShape; color: number }> = {
  bus: { shape: 'square', color: COLOR_META.yellow.hex },
  star: { shape: 'star', color: COLOR_META.yellow.hex },
  flag: { shape: 'triangle', color: COLOR_META.green.hex },
  people: { shape: 'circle', color: COLOR_META.blue.hex },
  brain: { shape: 'hex', color: COLOR_META.purple.hex },
  palette: { shape: 'heart', color: COLOR_META.pink.hex },
  medal: { shape: 'diamond', color: COLOR_META.orange.hex },
  calendar: { shape: 'cross', color: COLOR_META.cyan.hex },
  hero: { shape: 'triangle', color: COLOR_META.red.hex },
  crown: { shape: 'star', color: 0xffce55 },
}

export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super('Achievements')
  }

  create(): void {
    app.refresh()
    backdrop(this)
    const root = stage(this)
    fadeIn(this)

    root.add(iconButton(this, 54, 68, '\u2190', () => fadeTo(this, 'Menu'), { size: 54, fill: 0x223354 }))
    root.add(title(this, 360, 62, 'Awards', 40, PAPER))
    const unlocked = ACHIEVEMENTS.filter((achievement) => app.progress.achievements.includes(achievement.id)).length
    root.add(label(this, 360, 108, `${unlocked} / ${ACHIEVEMENTS.length} earned`, 14, '#9fb0ca', { origin: 0.5 }))

    ACHIEVEMENTS.forEach((achievement, index) => {
      const y = 148 + index * 96
      const earned = app.progress.achievements.includes(achievement.id)
      const card = panel(this, 40, y, 640, 82, {
        fill: earned ? 0xfff3d9 : 0x1d2940,
        side: earned ? 0xd8c9a8 : 0x111a2b,
        radius: 18,
        raised: 4,
        highlight: false,
        stroke: earned ? 0xf2c94c : 0x000000,
        strokeAlpha: earned ? 0.6 : 0.15,
      })
      card.setAlpha(earned ? 1 : 0.7)
      root.add(card)

      const icon = ICONS[achievement.icon] ?? { shape: 'circle' as SymbolShape, color: 0xffffff }
      const badge = this.add.graphics()
      badge.fillStyle(earned ? icon.color : 0x39445a, 1)
      badge.fillCircle(44, 41, 27)
      badge.lineStyle(2, 0xffffff, earned ? 0.6 : 0.2)
      badge.strokeCircle(44, 41, 27)
      drawSymbol(badge, 44, 41, 26, earned ? 0xffffff : 0x6f819e, icon.shape)
      card.add(badge)

      card.add(label(this, 86, 16, achievement.name, 18, earned ? '#243046' : '#c3cfe3', { fontStyle: 'bold' }))
      card.add(label(this, 86, 44, achievement.description, 12, earned ? '#6f7a8d' : '#8fa3c2', { wrap: 470 }))
      card.add(label(this, 606, 30, earned ? '\u2713' : '\u00b7', 28, earned ? '#4fb98a' : '#5d6b84', { origin: 0.5 }))
    })

    root.add(
      label(this, 360, 1148, 'Achievements are cosmetic and tracked locally; the arcade SDK can mirror them.', 11, '#7f92af', {
        origin: 0.5,
      }),
    )
  }
}
