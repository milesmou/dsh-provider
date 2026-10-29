import { useEffect, useState } from 'react'
import type { ControlAction, ControlReply } from '../remote.js'
import { ModelManager } from '../../../client/model-manager.js'
import type { ModelManagementActions } from '../../../client/model-manager.js'

export interface CodexActions { command(action: ControlAction): Promise<ControlReply> }

export function CodexCard({ actions, modelActions }: { actions: CodexActions; modelActions?: ModelManagementActions }) {
  const [status, setStatus] = useState<ControlReply>()
  const [busy, setBusy] = useState(false)
  const [issue, setIssue] = useState('')
  const [modelRevision, setModelRevision] = useState(0)
  useEffect(() => {
    let live = true
    void actions.command('status').then(value => { if (live) setStatus(value) }, () => {
      if (live) setIssue('读取 Codex 状态失败，请关闭设置后重试。')
    })
    return () => { live = false }
  }, [actions])

  async function refresh() {
    if (busy) return
    setBusy(true); setIssue('')
    try { setStatus(await actions.command('refresh')); setModelRevision(value => value + 1) }
    catch { setIssue('刷新 Codex 失败，请稍后重试。') }
    finally { setBusy(false) }
  }

  return <section aria-label="Codex" style={{ borderTop: '1px solid color-mix(in srgb, currentColor 20%, transparent)', marginTop: 24, paddingTop: 20, display: 'grid', gap: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <strong>Codex</strong>
      <span style={{ fontSize: 12, opacity: 0.7 }}>{!status ? '读取中…' : status.configured ? '已读取本机登录态' : '未登录'}</span>
    </div>
    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, opacity: 0.8 }}>
      使用本机 Codex 登录，无需 API Key。
      {!status?.configured ? <>运行 <code>codex login</code> 后刷新。</> : null}
    </p>
    <div><button type="button" disabled={busy} onClick={() => { void refresh() }} style={{ font: 'inherit', color: 'inherit',
      background: 'transparent', border: '1px solid color-mix(in srgb, currentColor 25%, transparent)', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}>
      {busy ? '刷新中…' : '刷新登录态和模型'}
    </button></div>
    {issue || status?.issue ? <p role="alert" style={{ margin: 0, fontSize: 12, lineHeight: 1.7 }}>{issue || status?.issue}</p> : null}
    {modelActions ? <ModelManager key={`${status?.configured}:${modelRevision}`} actions={modelActions} provider="Codex" /> : null}
  </section>
}
