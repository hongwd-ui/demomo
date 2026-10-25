// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseEnvelope } from './protocol'
import { createHostBridge } from './host'
import { acceptResult } from './jobs'
const envelope = (extra = {}) => ({ protocol_version: 1 as const, request_id: 'r1', type: 'host.capabilities', model_id: 'm1', scene_revision: 2, payload: {}, ...extra })
afterEach(() => { vi.useRealTimers(); delete window.sketchup; delete window.ZhitanBridge })

describe('protocol boundary', () => {
  it('accepts data strings without treating them as code', () => {
    const data = envelope({ payload: { name: '"</script><script>throw new Error()</script>' } })
    expect(parseEnvelope(JSON.stringify(data))).toEqual(data)
  })
  it.each([
    { protocol_version: 2 }, { scene_revision: -1 }, { scene_revision: 1.5 }, { type: 'unknown' },
    { request_id: '' }, { payload: null }, { payload: { number: Infinity } },
  ])('rejects malformed or unsupported message %o', (extra) => {
    expect(() => parseEnvelope(envelope(extra))).toThrow()
  })
  it('rejects messages over 1 MiB including multibyte text', () => {
    expect(() => parseEnvelope(envelope({ payload: { name: '中'.repeat(400000) } }))).toThrow()
  })
})

describe('result ownership', () => {
  it('accepts only the active job for the current model revision', () => {
    const current = { model_id: 'm1', scene_revision: 2 }
    const result = { ...envelope(), type: 'job.result', payload: { job_id: 'j1', status: 'completed' } }
    expect(acceptResult(current, 'j1', result)).toBe(true)
    expect(acceptResult(current, 'j2', result)).toBe(false)
    expect(acceptResult({ ...current, scene_revision: 3 }, 'j1', result)).toBe(false)
    expect(acceptResult({ ...current, model_id: 'm2' }, 'j1', result)).toBe(false)
    expect(acceptResult(current, null, result)).toBe(false)
    expect(acceptResult(current, 'j1', { ...result, payload: { job_id: 'j1', status: 'cancelled' } })).toBe(false)
  })
})

describe('host bridge lifecycle', () => {
  it('does not pretend to be connected in a normal browser', async () => {
    const bridge = createHostBridge()
    expect(bridge.connected).toBe(false)
    await expect(bridge.request('scene.export', {})).rejects.toThrow('未连接')
    bridge.dispose()
  })
  it('correlates real inbound data and releases the bridge on disposal', async () => {
    window.sketchup = { zhitan_request: (raw) => {
      const request = JSON.parse(raw)
      window.ZhitanBridge!.receive({ ...request, payload: { name: '保存的构造' } })
    } }
    const bridge = createHostBridge()
    expect(bridge.connected).toBe(true)
    const result = await bridge.request('host.capabilities', {})
    expect(result.payload).toEqual({ name: '保存的构造' })
    bridge.dispose()
    expect(window.ZhitanBridge).toBeUndefined()
    await expect(bridge.request('host.capabilities', {})).rejects.toThrow('已关闭')
  })
  it('times out and rejects in-flight requests on disposal', async () => {
    vi.useFakeTimers()
    window.sketchup = { zhitan_request: () => {} }
    const bridge = createHostBridge()
    const timeout = expect(bridge.request('host.capabilities', {})).rejects.toThrow('超时')
    await vi.advanceTimersByTimeAsync(10000)
    await timeout
    const disposed = expect(bridge.request('scene.export', {})).rejects.toThrow('已关闭')
    bridge.dispose()
    await disposed
    expect(vi.getTimerCount()).toBe(0)
  })
  it('surfaces host failures rather than treating them as saved data', async () => {
    window.sketchup = { zhitan_request: raw => {
      const request = JSON.parse(raw)
      window.ZhitanBridge!.receive({ ...request, type: 'request.error', payload: { code: 'BAD_DATA', message: '输入无效', retryable: false } })
    } }
    const bridge = createHostBridge()
    await expect(bridge.request('construction.save', {})).rejects.toThrow('输入无效')
    bridge.dispose()
  })
})
