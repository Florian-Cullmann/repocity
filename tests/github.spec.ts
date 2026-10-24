import { expect, test, type Page } from '@playwright/test'

const commit = 'a'.repeat(40)
const tree = 'b'.repeat(40)
const files: Record<string, string> = {
  'src/city/grow.ts': '// growth\n\nexport const grow = 1\n',
  'src/ui/Button.tsx': 'export const Button = () => null\n',
}

/** Check actual pixels in the unobstructed scene, not just successful UI updates. */
async function expectRenderedCity(page: Page) {
  const bounds = (await page.locator('canvas').boundingBox())!
  const screenshot = await page.screenshot({
    clip: {
      x: bounds.x + bounds.width * 0.2,
      y: bounds.y + bounds.height * 0.3,
      width: bounds.width * 0.45,
      height: bounds.height * 0.45,
    },
  })
  const colors = await page.evaluate(async (png) => {
    const image = new Image()
    image.src = `data:image/png;base64,${png}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const colors = new Set<number>()
    for (let i = 0; i < pixels.length; i += 64)
      colors.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2])
    return colors.size
  }, screenshot.toString('base64'))
  expect(
    colors,
    'the rendered city must contain more than the background and selection marker',
  ).toBeGreaterThan(200)
}

async function mockGitHub(page: Page, beforeMetadata?: () => Promise<void>) {
  await page.route('https://api.github.com/**', async (route) => {
    const url = route.request().url()
    if (url.endsWith('/branches/main')) {
      await route.fulfill({ json: { commit: { sha: commit, commit: { tree: { sha: tree } } } } })
    } else if (url.includes('/git/trees/')) {
      await route.fulfill({
        json: {
          truncated: false,
          tree: Object.entries(files).map(([path, content]) => ({
            path,
            size: content.length,
            mode: '100644',
            type: 'blob',
          })),
        },
      })
    } else {
      await beforeMetadata?.()
      await route.fulfill({
        json: { full_name: 'example/garden', default_branch: 'main', private: false },
      })
    }
  })
  await page.route('https://raw.githubusercontent.com/**', async (route) => {
    const path = decodeURIComponent(
      new URL(route.request().url()).pathname.split('/').slice(4).join('/'),
    )
    if (!(path in files)) throw new Error(`Unexpected source path: ${path}`)
    await route.fulfill({ contentType: 'text/plain; charset=utf-8', body: files[path] })
  })
}

test('loads a public repository from its URL and links measured modules to the imported commit', async ({
  page,
}) => {
  const errors: string[] = []
  const downloads: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (request.url().startsWith('https://raw.githubusercontent.com/'))
      downloads.push(request.url())
  })
  let release!: () => void
  const metadata = new Promise<void>((resolve) => {
    release = resolve
  })
  await mockGitHub(page, () => metadata)
  await page.goto('/')
  await expect(page.getByTestId('city-canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByLabel('Data source')).toHaveValue('github')
  await page.locator('#repository').fill('https://github.com/example/garden.git')
  await page.getByRole('button', { name: 'Load repository', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Loading repository')
  await expect(page.locator('.primary-button')).toBeDisabled()
  await expect(page.getByRole('heading', { name: 'repocity', exact: true })).toBeVisible()
  release()
  await expect(page.getByRole('heading', { name: 'garden', exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.locator('.repo-title')).toContainText('GitHub')
  await expect(page.locator('.scene-heading')).toContainText('main · aaaaaaa')
  await expect(page.locator('.city-stats strong').first()).toHaveText('2')
  await expect(page.locator('#module-select option')).toHaveCount(3)
  expect(downloads).toEqual([])
  await expect(page.locator('.import-notice, .source-note, .sidebar-intro')).toHaveCount(0)
  await expect(page.locator('.city-stats')).toContainText('Source code')
  await page.getByLabel('Explore a module directly').selectOption('src/city/grow.ts')
  const details = page.getByLabel('Building information', { exact: true })
  await expect(details.locator('.module-metrics strong').first()).toHaveText('2')
  await expect(details.getByText('Not available', { exact: true })).toHaveCount(2)
  await expect(details.getByRole('link', { name: 'View on GitHub' })).toHaveAttribute(
    'href',
    `https://github.com/example/garden/blob/${commit}/src/city/grow.ts`,
  )
  expect(downloads).toHaveLength(1)
  await page.getByLabel('Explore a module directly').selectOption('src/ui/Button.tsx')
  await expect(details.locator('.module-metrics strong').first()).toHaveText('1')
  await page.getByLabel('Explore a module directly').selectOption('src/city/grow.ts')
  await expect(details.locator('.module-metrics strong').first()).toHaveText('2')
  expect(downloads).toHaveLength(2)
  await page.screenshot({ animations: 'disabled', path: 'test-results/repocity-github.png' })

  // A failed replacement keeps the last successfully imported city and its selection intact.
  await page.route('https://api.github.com/repos/missing/project', (route) =>
    route.fulfill({ status: 404, json: { message: 'Not Found' } }),
  )
  await page.locator('#repository').fill('missing/project')
  await page.getByRole('button', { name: 'Load repository', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('not found or not public')
  await expect(page.getByRole('heading', { name: 'garden', exact: true })).toBeVisible()
  await expect(details.getByRole('heading', { name: 'grow.ts' })).toBeVisible()
  expect(errors).toEqual([])
})

test('validates input, explains rate limits and cancels imports without replacing the city', async ({
  page,
}) => {
  let mode: 'limited' | 'waiting' = 'limited'
  let release!: () => void
  const delayed = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('https://api.github.com/**', async (route) => {
    if (mode === 'limited') {
      await route.fulfill({
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'access-control-expose-headers': 'x-ratelimit-remaining',
        },
        json: { message: 'rate limit' },
      })
    } else {
      await delayed
      await route.fulfill({ json: { full_name: 'example/garden', default_branch: 'main' } })
    }
  })
  await page.goto('/')
  await page.locator('#repository').fill('https://example.com/repo')
  await page.getByRole('button', { name: 'Load repository', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('GitHub repository URL')
  await page.locator('#repository').fill('example/garden')
  await page.getByRole('button', { name: 'Load repository', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('GitHub rate limit reached')
  mode = 'waiting'
  const request = page.waitForRequest('https://api.github.com/repos/example/garden')
  await page.getByRole('button', { name: 'Load repository', exact: true }).click()
  await request
  await page.getByRole('button', { name: 'Cancel import' }).click()
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Load repository', exact: true })).toBeEnabled()
  await page.getByLabel('Data source').selectOption('mock')
  await page.getByRole('button', { name: 'Generate city' }).click()
  release()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.repo-title')).toContainText('Mock City')
  await expect(page.locator('.city-stats strong').first()).toHaveText('96')
})

test('loads a GitHub city on mobile and closes the explorer after success', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockGitHub(page)
  await page.goto('/')
  await expect(page.getByTestId('city-canvas')).toHaveAttribute('data-ready', 'true')
  await page.getByRole('button', { name: 'Explore city' }).click()
  await page.locator('#repository').fill('example/garden')
  await page.getByRole('button', { name: 'Load repository', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'garden', exact: true })).toBeVisible()
  await expect(page.locator('#explorer-sidebar')).not.toBeVisible()
  await expect(page.locator('.city-stats strong').first()).toHaveText('2')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ animations: 'disabled', path: 'test-results/repocity-github-mobile.png' })
})

test('shows all 5905 files without source downloads and measures errors without losing buildings', async ({
  page,
}) => {
  const errors: string[] = []
  const downloads: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (request.url().startsWith('https://raw.githubusercontent.com/'))
      downloads.push(request.url())
  })
  await mockGitHub(page)
  await page.route('https://api.github.com/**/git/trees/**', (route) =>
    route.fulfill({
      json: {
        truncated: false,
        tree: Array.from({ length: 5905 }, (_, i) => ({
          path: `src/${i < 5000 ? 'core' : 'ui'}/file-${String(i).padStart(4, '0')}.ts`,
          size: (i + 1) * 100,
          mode: '100644',
          type: 'blob',
        })),
      },
    }),
  )
  let failed = true
  await page.route('https://raw.githubusercontent.com/**', (route) =>
    route.fulfill(
      failed
        ? { status: 503, body: 'Unavailable' }
        : { contentType: 'text/plain', body: 'one\n\ntwo\n' },
    ),
  )
  await page.goto('/')
  await expect(page.getByTestId('city-canvas')).toHaveAttribute('data-ready', 'true')
  await page.locator('#repository').fill('example/garden')
  await page.getByRole('button', { name: 'Load repository', exact: true }).click()
  await expect(page.locator('.city-stats strong').first()).toHaveText('5905', { timeout: 30_000 })
  await expect(page.locator('#module-select option')).toHaveCount(5906)
  await expect(page.getByRole('button', { name: /src\/core.*5000/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /src\/ui.*905/ })).toBeVisible()
  await expectRenderedCity(page)
  expect(downloads).toEqual([])
  await page.getByLabel('Explore a module directly').selectOption('src/ui/file-5904.ts')
  const details = page.getByLabel('Building information', { exact: true })
  await expect(details.getByRole('heading', { name: 'file-5904.ts', exact: true })).toBeVisible()
  await expect(details.getByRole('status')).toContainText('HTTP 503')
  await expect(details.locator('.module-metrics strong').first()).toHaveText('Not measured')
  failed = false
  await details.getByRole('button', { name: 'Measure again' }).click()
  await expect(details.locator('.module-metrics strong').first()).toHaveText('2')
  await expect(page.locator('.city-stats strong').first()).toHaveText('5905')
  await expect
    .poll(async () => Number(await page.locator('canvas').getAttribute('data-zoom')))
    .toBeGreaterThan(4)
  await expectRenderedCity(page)
  await page.screenshot({ animations: 'disabled', path: 'test-results/repocity-large-focused.png' })
  await page.getByLabel('Close building information').click()
  await expect
    .poll(async () => Number(await page.locator('canvas').getAttribute('data-far')))
    .toBeGreaterThan(3000)
  for (let i = 0; i < 2; i++)
    await page.getByRole('button', { name: 'Rotate city', exact: true }).click()
  await page.screenshot({ animations: 'disabled', path: 'test-results/repocity-large-rotated.png' })
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expectRenderedCity(page)
  await page.screenshot({
    animations: 'disabled',
    path: 'test-results/repocity-complete-repository.png',
  })
  expect(errors).toEqual([])
})
