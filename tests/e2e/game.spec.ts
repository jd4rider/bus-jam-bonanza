import { expect, test, type Page } from '@playwright/test'

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as unknown as { __BJB_GAME__?: unknown }).__BJB_GAME__), null, {
    timeout: 20_000,
  })
  await page.waitForFunction(
    () => (window as unknown as { __BJB_GAME__: { scene: { isActive: (key: string) => boolean } } }).__BJB_GAME__.scene.isActive('Menu'),
    null,
    { timeout: 20_000 },
  )
  await expect(page.locator('canvas')).toBeVisible()
}

async function tapStart(page: Page): Promise<void> {
  // Let the menu finish attach()ing its input handlers, then click the real
  // Continue button using Phaser's own stage transform.
  await page.waitForTimeout(500)
  const target = await page.evaluate(() => {
    const width = window.innerWidth
    const height = window.innerHeight
    const scale = Math.min(width / 720, height / 1280)
    return {
      x: (width - 720 * scale) / 2 + 360 * scale,
      y: (height - 1280 * scale) / 2 + 584 * scale,
    }
  })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.mouse.click(target.x, target.y)
    try {
      await page.waitForFunction(
        () => (window as unknown as { __BJB_GAME__: { scene: { isActive: (key: string) => boolean } } }).__BJB_GAME__.scene.isActive('Game'),
        null,
        { timeout: 4_000 },
      )
      return
    } catch {
      // A click can land before the canvas has focus; try once more.
    }
  }
  throw new Error('Continue button did not start the game')
}

test('boots, starts a journey, dispatches a bus, pauses and survives a rotation', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await boot(page)
  await tapStart(page)

  const before = await page.evaluate(() => {
    const scene = (window as unknown as { __BJB_GAME__: { scene: { getScene: (key: string) => any } } })
      .__BJB_GAME__.scene.getScene('Game')
    return {
      levelId: scene.level.id as string,
      parked: (scene.state.parked as string[]).length,
      moves: scene.moves as number,
      portrait: scene.layout.portrait as boolean,
    }
  })
  expect(before.levelId).toBe('level-001')
  expect(before.moves).toBe(0)
  expect(before.parked).toBeGreaterThan(0)

  const point = await page.evaluate(() => {
    const scene = (window as unknown as { __BJB_GAME__: { scene: { getScene: (key: string) => any } } })
      .__BJB_GAME__.scene.getScene('Game')
    // The first dispatch of the verified solution is guaranteed to be legal;
    // the first bus in level order may be intentionally boxed in.
    const busId = (scene.level.solution as string[]).find((id) => (scene.state.parked as string[]).includes(id))
    const container = scene.busVisuals.get(busId ?? scene.state.parked[0])
    const matrix = container.getWorldTransformMatrix()
    return { x: matrix.tx, y: matrix.ty }
  })
  await page.mouse.click(point.x, point.y)
  await page.waitForFunction(
    () => {
      const scene = (window as unknown as { __BJB_GAME__: { scene: { getScene: (key: string) => any } } })
        .__BJB_GAME__.scene.getScene('Game')
      return scene.moves === 1 && scene.busy === false
    },
    null,
    { timeout: 20_000 },
  )

  const after = await page.evaluate(() => {
    const scene = (window as unknown as { __BJB_GAME__: { scene: { getScene: (key: string) => any } } })
      .__BJB_GAME__.scene.getScene('Game')
    return {
      moves: scene.moves as number,
      session: localStorage.getItem('bus-jam-bonanza-session-v1') !== null,
      history: (scene.history as unknown[]).length,
    }
  })
  expect(after.moves).toBe(1)
  expect(after.session).toBe(true)
  expect(after.history).toBe(1)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __BJB_GAME__: { scene: { getScene: (key: string) => any } } })
          .__BJB_GAME__.scene.getScene('Game').overlayKind,
    ),
  ).toBe('pause')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)

  await page.setViewportSize({ width: 900, height: 500 })
  await page.waitForTimeout(900)
  await page.waitForFunction(
    () => {
      const game = (window as unknown as { __BJB_GAME__: { scene: { isActive: (key: string) => boolean } } }).__BJB_GAME__
      return game.scene.isActive('Game')
    },
    null,
    { timeout: 20_000 },
  )
  const rotated = await page.evaluate(() => {
    const scene = (window as unknown as { __BJB_GAME__: { scene: { getScene: (key: string) => any } } })
      .__BJB_GAME__.scene.getScene('Game')
    return { portrait: scene.layout.portrait as boolean, moves: scene.moves as number }
  })
  expect(rotated.portrait).toBe(false)
  expect(rotated.moves).toBe(1)

  await page.reload()
  await page.waitForFunction(
    () => (window as unknown as { __BJB_GAME__: { scene: { isActive: (key: string) => boolean } } }).__BJB_GAME__.scene.isActive('Menu'),
    null,
    { timeout: 20_000 },
  )
  expect(await page.evaluate(() => localStorage.getItem('bus-jam-bonanza-session-v1') !== null)).toBe(true)
  await tapStart(page)
  const resumed = await page.evaluate(() => {
    const scene = (window as unknown as { __BJB_GAME__: { scene: { getScene: (key: string) => any } } })
      .__BJB_GAME__.scene.getScene('Game')
    return { moves: scene.moves as number, levelId: scene.level.id as string, parked: (scene.state.parked as string[]).length }
  })
  expect(resumed.levelId).toBe('level-001')
  expect(resumed.moves).toBe(1)
  expect(resumed.parked).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('renders the board in a small portrait viewport without runtime errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 780 })
  await boot(page)
  await tapStart(page)
  const model = await page.evaluate(() => {
    const scene = (window as unknown as { __BJB_GAME__: { scene: { getScene: (key: string) => any } } })
      .__BJB_GAME__.scene.getScene('Game')
    return {
      portrait: scene.layout.portrait as boolean,
      width: scene.layout.width as number,
      buses: (scene.level.buses as unknown[]).length,
    }
  })
  expect(model.portrait).toBe(true)
  expect(model.width).toBe(720)
  expect(model.buses).toBeGreaterThan(0)
  expect(errors).toEqual([])
})
