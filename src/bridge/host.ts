import { parseEnvelope } from './protocol'
import type { Envelope, RequestType } from './protocol'
declare global {
  interface Window {
    sketchup?: { zhitan_request: (json: string) => void }
    ZhitanBridge?: { receive: (input: unknown) => void }
  }
}
export type HostBridge = {
  connected: boolean
  request: (type: RequestType, payload: Record<string, unknown>) => Promise<Envelope>
  subscribe: (listener: (event: Envelope) => void) => () => void
  dispose: () => void
}
export function createHostBridge(): HostBridge {
  const host = typeof window === 'undefined' ? undefined : window.sketchup
  let disposed = false
  const pending = new Map<string, { resolve: (value: Envelope) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout>; type: RequestType }>()
  const listeners = new Set<(event: Envelope) => void>()
  const receiver = { receive(input: unknown) {
    let message: Envelope
    try { message = parseEnvelope(input) } catch { return }
    const request = pending.get(message.request_id)
    if (request && (message.type === request.type || message.type === 'request.error')) {
      clearTimeout(request.timer)
      pending.delete(message.request_id)
      if (message.type === 'request.error') request.reject(new Error(typeof message.payload.message === 'string' ? message.payload.message : '宿主操作失败'))
      else request.resolve(message)
    }
    if (message.type.startsWith('job.')) listeners.forEach(listener => listener(message))
  } }
  if (host) window.ZhitanBridge = receiver
  return {
    connected: typeof host?.zhitan_request === 'function',
    request(type, payload) {
      return new Promise((resolve, reject) => {
        if (disposed) { reject(new Error('连接已关闭')); return }
        if (typeof host?.zhitan_request !== 'function') { reject(new Error('未连接 SketchUp')); return }
        const request_id = crypto.randomUUID()
        try {
          const message = parseEnvelope({ protocol_version: 1, request_id, type, model_id: 'unbound', scene_revision: 0, payload })
          const timer = setTimeout(() => { pending.delete(request_id); reject(new Error('宿主请求超时')) }, 10000)
          pending.set(request_id, { resolve, reject, timer, type })
          host.zhitan_request(JSON.stringify(message))
        } catch (error) {
          const request = pending.get(request_id)
          if (request) clearTimeout(request.timer)
          pending.delete(request_id)
          reject(error)
        }
      })
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispose() {
      disposed = true
      pending.forEach(request => { clearTimeout(request.timer); request.reject(new Error('连接已关闭')) })
      pending.clear(); listeners.clear()
      if (typeof window !== 'undefined' && window.ZhitanBridge === receiver) delete window.ZhitanBridge
    },
  }
}
