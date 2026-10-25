// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConstructionEditor } from './ConstructionEditor'
import App from '../../App'
import { sampleConstruction } from '../../test/fixtures'
afterEach(() => { cleanup(); localStorage.clear() })
it('updates calculated U value and submits validated layers', async () => {
  let saved: unknown
  render(<ConstructionEditor value={sampleConstruction()} onSave={async value => { saved = value }} />)
  expect(screen.getByLabelText('构造传热系数').textContent).toContain('2.857')
  fireEvent.change(screen.getByLabelText('第 1 层厚度（mm）'), { target: { value: '400' } })
  expect(screen.getByLabelText('构造传热系数').textContent).toContain('1.818')
  fireEvent.click(screen.getByRole('button', { name: '保存构造' }))
  await waitFor(() => expect(saved).toMatchObject({ layers: [{ thickness_m: 0.4 }] }))
})
it('supports adding/removing layers and blocks empty thickness', () => {
  render(<ConstructionEditor value={sampleConstruction()} onSave={async () => {}} />)
  fireEvent.click(screen.getByRole('button', { name: '添加材料层' }))
  expect(screen.getAllByLabelText(/层厚度/)).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: '删除第 2 层' }))
  expect(screen.getAllByLabelText(/层厚度/)).toHaveLength(1)
  fireEvent.change(screen.getByLabelText('第 1 层厚度（mm）'), { target: { value: '' } })
  expect((screen.getByRole('button', { name: '保存构造' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByRole('alert').textContent).toContain('厚度')
  expect(screen.getByLabelText('构造传热系数').textContent).toContain('—')
})
it('does not claim a failed save succeeded', async () => {
  render(<ConstructionEditor value={sampleConstruction()} onSave={async () => { throw new Error('磁盘不可写') }} />)
  fireEvent.click(screen.getByRole('button', { name: '保存构造' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('磁盘不可写'))
})
it('clearly distinguishes demo mode and missing results, and persists local edits', async () => {
  render(<App />)
  expect(screen.getByText(/演示模式，未连接 SketchUp/)).toBeTruthy()
  expect(screen.getByText('尚未计算太阳辐射')).toBeTruthy()
  expect(screen.getByText('未选择已审核规则')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('构造名称'), { target: { value: '我的外墙' } })
  fireEvent.click(screen.getByRole('button', { name: '保存构造' }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('已保存到此浏览器'))
  cleanup()
  render(<App />)
  expect((screen.getByLabelText('构造名称') as HTMLInputElement).value).toBe('我的外墙')
})
it('loads safely when stored local data is corrupt', () => {
  localStorage.setItem('zhitan.construction.v1', '{bad-json')
  render(<App />)
  expect(screen.getByLabelText('构造名称')).toBeTruthy()
  expect(screen.getByText(/本地构造数据无效/)).toBeTruthy()
})
it('preserves optical metadata while editing thermal properties', async () => {
  let saved: unknown
  const value = { ...sampleConstruction(), materials: [{ ...sampleConstruction().materials[0], solar_absorptance: 0.7, solar_reflectance: 0.3, solar_transmittance: 0 }] }
  render(<ConstructionEditor value={value} onSave={async next => { saved = next }} />)
  fireEvent.click(screen.getByRole('button', { name: '保存构造' }))
  await waitFor(() => expect(saved).toMatchObject({ materials: [{ solar_absorptance: 0.7, solar_reflectance: 0.3, solar_transmittance: 0 }] }))
})
it('loads the saved host construction before allowing it to be edited', async () => {
  const value = { ...sampleConstruction(), name: '模型内的构造', id: 'model-wall' }
  window.sketchup = { zhitan_request: raw => {
    const request = JSON.parse(raw)
    window.ZhitanBridge!.receive({ ...request, model_id: 'model-1', payload: { saved_construction: value } })
  } }
  try {
    render(<App />)
    await waitFor(() => expect((screen.getByLabelText('构造名称') as HTMLInputElement).value).toBe('模型内的构造'))
  } finally { cleanup(); delete window.sketchup; delete window.ZhitanBridge }
})
it('refreshes saved constructions when switching host models', async () => {
  let name = '第一栋建筑'
  window.sketchup = { zhitan_request: raw => {
    const request = JSON.parse(raw)
    window.ZhitanBridge!.receive({ ...request, model_id: name, payload: { saved_construction: { ...sampleConstruction(), name } } })
  } }
  try {
    render(<App />)
    await waitFor(() => expect((screen.getByLabelText('构造名称') as HTMLInputElement).value).toBe('第一栋建筑'))
    name = '第二栋建筑'
    fireEvent(window, new CustomEvent('zhitan:model-changed'))
    await waitFor(() => expect((screen.getByLabelText('构造名称') as HTMLInputElement).value).toBe('第二栋建筑'))
  } finally { cleanup(); delete window.sketchup; delete window.ZhitanBridge }
})
