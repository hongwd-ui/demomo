import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
test('edits, validates, saves and restores a real construction in Chromium', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('演示模式，未连接 SketchUp')).toBeVisible()
  await expect(page.getByRole('button', { name: '提取模型', exact: false })).toBeDisabled()
  await page.getByLabel('构造名称').fill('浏览器验证构造')
  await page.getByLabel('第 1 层厚度（mm）').fill('40')
  await page.getByRole('button', { name: '保存构造', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('已保存到此浏览器')
  await page.reload()
  await expect(page.getByLabel('构造名称')).toHaveValue('浏览器验证构造')
  await expect(page.getByLabel('第 1 层厚度（mm）')).toHaveValue('40')
  await page.getByLabel('第 1 层厚度（mm）').fill('')
  await expect(page.getByRole('button', { name: '保存构造', exact: true })).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText('厚度')
  await expect(page.getByLabel('构造传热系数')).toContainText('—')
})
test('renders truthfully without horizontal overflow at desktop and narrow panel widths', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/')
    await expect(page.getByText('尚未计算太阳辐射')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  expect(errors).toEqual([])
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.screenshot({ path: '/tmp/zhitan-execution/workspace-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 375, height: 1000 })
  await page.screenshot({ path: '/tmp/zhitan-execution/workspace-narrow.png', fullPage: true })
})

test('RBZ archive contains a runnable UI with relative assets', async ({ page }) => {
  const directory = mkdtempSync(join(tmpdir(), 'zhitan-rbz-browser-'))
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url!, 'http://127.0.0.1').pathname
      if (pathname.includes('..')) { response.writeHead(400); response.end(); return }
      const file = join(directory, 'zhitan/ui', pathname === '/' ? 'index.html' : pathname)
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html')
      response.end(await readFile(file))
    } catch { response.writeHead(404); response.end() }
  })
  try {
    execFileSync('python3', ['-c', 'import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', 'artifacts/zhitan-0.1.0.rbz', directory])
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { port: number }
    await page.goto(`http://127.0.0.1:${address.port}`)
    await expect(page.getByLabel('构造名称')).toBeVisible()
    await expect(page.getByText('演示模式，未连接 SketchUp')).toBeVisible()
    await page.getByLabel('第 1 层厚度（mm）').fill('80')
    await expect(page.getByLabel('构造传热系数')).toContainText('0.625')
  } finally {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
    rmSync(directory, { recursive: true, force: true })
  }
})
