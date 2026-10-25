export const requestTypes = ['host.capabilities', 'scene.export', 'construction.save', 'weather.import', 'analysis.start', 'analysis.cancel'] as const
export type RequestType = typeof requestTypes[number]
const messageTypes: readonly string[] = [...requestTypes, 'request.error', 'job.progress', 'job.result', 'job.error']
export type Envelope = {
  protocol_version: 1; request_id: string; type: string
  model_id: string; scene_revision: number; payload: Record<string, unknown>
}
function inspect(value: unknown, depth = 0): void {
  if (depth > 40) throw new Error('消息嵌套过深')
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('数值必须有限')
  if (value && typeof value === 'object') Object.values(value).forEach(item => inspect(item, depth + 1))
}
export function parseEnvelope(input: unknown): Envelope {
  if (typeof input === 'string' && new TextEncoder().encode(input).length > 1048576) throw new Error('消息超过 1 MiB')
  const data = typeof input === 'string' ? JSON.parse(input) : input
  inspect(data)
  const serialized = JSON.stringify(data)
  if (!serialized || new TextEncoder().encode(serialized).length > 1048576) throw new Error('消息超过 1 MiB')
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || data.protocol_version !== 1 || !messageTypes.includes(data.type)
    || typeof data.request_id !== 'string' || !data.request_id.trim()
    || typeof data.model_id !== 'string' || !data.model_id.trim()
    || !Number.isSafeInteger(data.scene_revision) || data.scene_revision < 0
    || !data.payload || typeof data.payload !== 'object' || Array.isArray(data.payload)) throw new Error('无效或不支持的协议消息')
  return data as Envelope
}
