import { test, expect } from '@playwright/test'
import { analyzeRepository } from '../tooling/analyzeRepository.mjs'

test('renders WebGL, picks a real building, explores modules and regenerates deterministically', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const snapshot = await analyzeRepository(process.cwd())
  await page.goto('/')
  await expect(page.getByTestId('city-canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.locator('.sidebar-intro, .seed-row > span, .import-notice, .source-note'),
  ).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'repocity', exact: true })).toBeVisible()
  await expect(page.locator('.repo-title')).toContainText('Real data')
  await expect(page.locator('.app-footer, .topbar-center, .prototype-badge')).toHaveCount(0)
  await expect(page.locator('.sidebar h1')).toHaveCount(0)
  await expect(page.locator('.city-stats strong').first()).toHaveText(
    String(snapshot.modules.length),
  )
  await expect(page.locator('#module-select option')).toHaveCount(snapshot.modules.length + 1)
  await expect(page.locator('#repository')).toBeEditable()
  await expect(page.getByLabel('City size')).toHaveCount(0)
  await page.screenshot({ animations: 'disabled', path: 'test-results/repocity-desktop.png' })
  // Probe actual screen coordinates through the WebGL raycaster, not a mocked event.
  const bounds = (await page.locator('canvas').boundingBox())!
  let picked = false
  for (const x of [0.5, 0.43, 0.57, 0.35, 0.65]) {
    for (const y of [0.45, 0.53, 0.38, 0.6]) {
      await page.mouse.click(bounds.x + bounds.width * x, bounds.y + bounds.height * y)
      if (await page.getByLabel('Building information', { exact: true }).isVisible()) {
        picked = true
        break
      }
    }
    if (picked) break
  }
  expect(picked).toBe(true)
  await page.getByLabel('Close building information').click()
  await page.getByLabel('Explore a module directly').selectOption('src/city/generateCity.ts')
  const details = page.getByLabel('Building information', { exact: true })
  await expect(details.getByRole('heading', { name: 'generateCity.ts', exact: true })).toBeVisible()
  await expect(details.getByText('Not available', { exact: true })).toHaveCount(2)
  await expect(details.locator('.coverage-track')).toHaveCount(0)
  await expect(details.locator('.module-metrics strong').first()).toHaveText(
    snapshot.modules
      .find((module) => module.id === 'src/city/generateCity.ts')!
      .metrics.lines!.toLocaleString('en-US'),
  )
  await page.screenshot({
    animations: 'disabled',
    path: 'test-results/repocity-local-selected.png',
  })
  await page.getByLabel('Data source').selectOption('mock')
  await page.getByRole('button', { name: 'Generate city' }).click()
  await expect(details).not.toBeVisible()
  await expect(page.locator('.repo-title')).toContainText('Mock City')
  await page.screenshot({ animations: 'disabled', path: 'test-results/repocity-demo.png' })
  await page.getByLabel('Explore a module directly').selectOption('core/auth')
  await expect(page.getByRole('heading', { name: 'auth', exact: true })).toBeVisible()
  await page.screenshot({ animations: 'disabled', path: 'test-results/repocity-selected.png' })
  await page.getByRole('button', { name: /Design Quarter/ }).click()
  await expect(page.getByRole('button', { name: /Design Quarter.*highlighted/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Design Quarter.*16/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.locator('#repository').fill('invalid')
  await page.getByRole('button', { name: 'Generate city' }).click()
  await expect(page.getByRole('alert')).toContainText('owner/repository')
  await page.locator('#repository').fill('https://github.com/example/garden')
  await page.locator('#seed').fill('test-garden')
  await page.getByRole('button', { name: 'Generate city' }).click()
  await expect(page.getByRole('heading', { name: 'garden', exact: true })).toBeVisible()
  await expect(page.getByText('seed: test-garden')).toBeVisible()
  await expect(page.getByLabel('Building information', { exact: true })).not.toBeVisible()
  await page.getByLabel('Explore a module directly').selectOption('core/auth')
  const first = await page.getByLabel('Building information', { exact: true }).innerText()
  await page.getByRole('button', { name: 'Generate city' }).click()
  await page.getByLabel('Explore a module directly').selectOption('core/auth')
  expect(await page.getByLabel('Building information', { exact: true }).innerText()).toBe(first)
  for (const label of ['Zoom in', 'Zoom out', 'Rotate city', 'Reset view'])
    await page.getByRole('button', { name: label, exact: true }).click()
  await page.getByRole('button', { name: 'Controls', exact: true }).click()
  await expect(page.getByText('Drag with the left mouse button · one finger')).toBeVisible()
  await page.getByLabel('Data source').selectOption('local')
  await page.getByRole('button', { name: 'Generate city' }).click()
  await expect(page.getByRole('heading', { name: 'repocity', exact: true })).toBeVisible()
  await expect(page.locator('.city-stats strong').first()).toHaveText(
    String(snapshot.modules.length),
  )
  await expect(details).not.toBeVisible()
  await expect(page.getByRole('button', { name: /highlighted/ })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('mobile layout exposes the form and module details without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByTestId('city-canvas')).toHaveAttribute('data-ready', 'true')
  await page.screenshot({ animations: 'disabled', path: 'test-results/repocity-mobile.png' })
  await page.getByRole('button', { name: 'Explore city' }).click()
  await page.getByLabel('Explore a module directly').selectOption('src/App.tsx')
  await expect(page.getByRole('heading', { name: 'App.tsx' })).toBeVisible()
  await expect(page.getByText('Not available', { exact: true })).toHaveCount(2)
  await expect(page.locator('#explorer-sidebar')).not.toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({
    animations: 'disabled',
    path: 'test-results/repocity-mobile-selected.png',
  })
})

test('renders the 768-module metropolis and keeps selection usable', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByTestId('city-canvas')).toHaveAttribute('data-ready', 'true')
  await page.getByLabel('Data source').selectOption('mock')
  await page.getByLabel('City size').selectOption('768')
  await page.getByRole('button', { name: 'Generate city' }).click()
  await expect(page.locator('.city-stats')).toContainText('768')
  await page.getByLabel('Explore a module directly').selectOption('core/auth')
  await expect(page.getByRole('heading', { name: 'auth', exact: true })).toBeVisible()
  await page.getByLabel('Close building information').click()
  const canvas = page.locator('canvas')
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect(canvas).toHaveAttribute('data-zoom', '1.00')
  for (let i = 0; i < 9; i++)
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect.poll(async () => Number(await canvas.getAttribute('data-zoom'))).toBeGreaterThan(12)
  await page.screenshot({ animations: 'disabled', path: 'test-results/repocity-closeup.png' })
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect(canvas).toHaveAttribute('data-zoom', '1.00')
  const bounds = (await canvas.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.55)
  await page.mouse.wheel(0, -120)
  await expect.poll(async () => Number(await canvas.getAttribute('data-zoom'))).toBeGreaterThan(1)
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect(canvas).toHaveAttribute('data-zoom', '1.00')
  await page.screenshot({ animations: 'disabled', path: 'test-results/repocity-metropolis.png' })
  expect(errors).toEqual([])
})
