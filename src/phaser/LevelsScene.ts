import Phaser from 'phaser'
import { app } from '../core/app'
import { levelByNumber } from '../core/levels'
import { LEVELS_PER_WORLD, TOTAL_LEVELS } from '../core/types'
import { WORLDS } from '../core/worlds'
import {
  backdrop,
  fadeIn,
  fadeTo,
  iconButton,
  label,
  panel,
  PAPER,
  stage,
  starRow,
  title,
} from './common'

export interface LevelsData {
  world: number
  mode: 'journey' | 'zen' | 'free'
}

export class LevelsScene extends Phaser.Scene {
  private data_: LevelsData = { world: 1, mode: 'journey' }

  constructor() {
    super('Levels')
  }

  init(data: LevelsData): void {
    this.data_ = { world: data.world ?? 1, mode: data.mode ?? 'journey' }
  }

  create(): void {
    app.refresh()
    const world = WORLDS[Math.min(9, Math.max(0, this.data_.world - 1))]
    backdrop(this)
    const root = stage(this)
    fadeIn(this)

    root.add(iconButton(this, 54, 74, '\u2190', () => fadeTo(this, 'Worlds', { mode: this.data_.mode }), { size: 54, fill: 0x223354 }))
    root.add(title(this, 360, 64, world.name, 32, PAPER))
    root.add(label(this, 360, 108, world.blurb, 13, '#9fb0ca', { origin: 0.5 }))

    let worldStars = 0
    for (let index = 0; index < LEVELS_PER_WORLD; index += 1) {
      const global = (world.id - 1) * LEVELS_PER_WORLD + index + 1
      const level = levelByNumber(global)
      if (!level) continue
      const record = app.progress.completed[level.id]
      worldStars += record?.stars ?? 0
      const unlocked = global <= app.progress.unlocked
      const column = index % 5
      const row = Math.floor(index / 5)
      const x = 55 + column * 124
      const y = 168 + row * 138
      const fill = !unlocked ? 0x1d2940 : record ? 0x354c70 : 0xfff3d9
      const card = panel(this, x, y, 114, 124, {
        fill,
        side: unlocked ? undefined : 0x111a2b,
        radius: 18,
        raised: 4,
        highlight: false,
        stroke: unlocked ? world.accent : 0x000000,
        strokeAlpha: unlocked ? 0.35 : 0.15,
      })
      card.setAlpha(unlocked ? 1 : 0.55)
      root.add(card)

      if (unlocked) {
        card.add(label(this, 57, 22, `${global}`, 30, record ? '#ffffff' : '#243046', { origin: 0.5, fontStyle: 'bold' }))
        card.add(starRow(this, 57, 66, record?.stars ?? 0, 17, 3))
        const caption = record?.bestMoves ? `${record.bestMoves} moves` : 'New'
        card.add(label(this, 57, 92, caption, 11, record ? '#c3cfe3' : '#6f7a8d', { origin: 0.5 }))
        card.setSize(114, 124)
        card.setInteractive(new Phaser.Geom.Rectangle(57, 62, 114, 124), Phaser.Geom.Rectangle.Contains)
        if (card.input) card.input.cursor = 'pointer'
        card.on('pointerdown', () => this.tweens.add({ targets: card, scale: 0.96, duration: 60 }))
        card.on('pointerout', () => this.tweens.add({ targets: card, scale: 1, duration: 90 }))
        card.on('pointerup', () =>
          fadeTo(this, 'Game', { levelId: level.id, mode: this.data_.mode === 'journey' ? 'journey' : this.data_.mode }),
        )
      } else {
        card.add(label(this, 57, 48, '\u2013', 34, '#5d6b84', { origin: 0.5 }))
        card.add(label(this, 57, 92, `level ${global}`, 10, '#5d6b84', { origin: 0.5 }))
      }
    }

    root.add(
      label(this, 360, 1002, `${worldStars} / ${LEVELS_PER_WORLD * 3} stars in this world \u00b7 ${app.progress.unlocked} / ${TOTAL_LEVELS} stops open`, 13, '#9fb0ca', {
        origin: 0.5,
      }),
    )

    root.add(
      label(this, 360, 1090, this.data_.mode === 'zen' ? 'Zen: no timer, unlimited retries, hints available.' : 'Tap a numbered stop to board.', 13, '#8fa3c2', {
        origin: 0.5,
      }),
    )
  }
}
