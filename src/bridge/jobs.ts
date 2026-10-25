import type { Envelope } from './protocol'
export type SceneIdentity = { model_id: string; scene_revision: number }
export function acceptResult(current: SceneIdentity, activeJobId: string | null, result: Envelope): boolean {
  return !!activeJobId && result.type === 'job.result' && result.model_id === current.model_id
    && result.scene_revision === current.scene_revision && result.payload.job_id === activeJobId
    && result.payload.status === 'completed'
}
