import { test, expect } from '@playwright/test'

test('renders WebGL, picks a real building, explores modules and regenerates deterministically', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByTestId('city-canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('canvas')).toBeVisible()
  await page.screenshot({ animations: 'disabled', path: 'test-results/repocity-desktop.png' })
  // Probe actual screen coordinates through the WebGL raycaster, not a mocked event.
  const bounds = (await page.locator('canvas').boundingBox())!
  let picked = false
  for (const x of [0.5, 0.43, 0.57, 0.35, 0.65]) {
    for (const y of [0.45, 0.53, 0.38, 0.6]) {
      await page.mouse.click(bounds.x + bounds.width * x, bounds.y + bounds.height * y)
      if (await page.getByLabel('Gebäudeinformationen', { exact: true }).isVisible()) {
        picked = true
        break
      }
    }
    if (picked) break
  }
  expect(picked).toBe(true)
  await page.getByLabel('Gebäudeinformationen schließen').click()
  await page.getByLabel('Oder ein Modul direkt erkunden').selectOption('core/auth')
  await expect(page.getByRole('heading', { name: 'auth', exact: true })).toBeVisible()
  await page.screenshot({ animations: 'disabled', path: 'test-results/repocity-selected.png' })
  await page.getByRole('button', { name: /Design Quarter/ }).click()
  await expect(page.getByRole('button', { name: /Design Quarter.*hervorgehoben/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Design Quarter.*16/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.locator('#repository').fill('invalid')
  await page.getByRole('button', { name: 'Stadt generieren' }).click()
  await expect(page.getByRole('alert')).toContainText('owner/repository')
  await page.locator('#repository').fill('https://github.com/example/garden')
  await page.locator('#seed').fill('test-garden')
  await page.getByRole('button', { name: 'Stadt generieren' }).click()
  await expect(page.getByRole('heading', { name: 'garden', exact: true })).toBeVisible()
  await expect(page.getByText('seed: test-garden')).toBeVisible()
  await expect(page.getByLabel('Gebäudeinformationen', { exact: true })).not.toBeVisible()
  await page.getByLabel('Oder ein Modul direkt erkunden').selectOption('core/auth')
  const first = await page.getByLabel('Gebäudeinformationen', { exact: true }).innerText()
  await page.getByRole('button', { name: 'Stadt generieren' }).click()
  await page.getByLabel('Oder ein Modul direkt erkunden').selectOption('core/auth')
  expect(await page.getByLabel('Gebäudeinformationen', { exact: true }).innerText()).toBe(first)
  for (const label of ['Vergrößern', 'Verkleinern', 'Stadt drehen', 'Ansicht zurücksetzen'])
    await page.getByRole('button', { name: label, exact: true }).click()
  await page.getByRole('button', { name: 'Steuerung', exact: true }).click()
  await expect(page.getByText('Linke Maustaste ziehen · ein Finger')).toBeVisible()
  expect(errors).toEqual([])
})

test('mobile layout exposes the form and module details without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByTestId('city-canvas')).toHaveAttribute('data-ready', 'true')
  await page.screenshot({ animations: 'disabled', path: 'test-results/repocity-mobile.png' })
  await page.getByRole('button', { name: 'Stadt erkunden' }).click()
  await page.getByLabel('Oder ein Modul direkt erkunden').selectOption('interface/design-system')
  await expect(page.getByRole('heading', { name: 'design-system' })).toBeVisible()
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
  await page.getByLabel('Stadtgröße').selectOption('768')
  await page.getByRole('button', { name: 'Stadt generieren' }).click()
  await expect(page.locator('.city-stats')).toContainText('768')
  await page.getByLabel('Oder ein Modul direkt erkunden').selectOption('core/auth')
  await expect(page.getByRole('heading', { name: 'auth', exact: true })).toBeVisible()
  await page.screenshot({ animations: 'disabled', path: 'test-results/repocity-metropolis.png' })
  expect(errors).toEqual([])
})
