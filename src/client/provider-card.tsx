import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { CodeBuddyKeyCard } from './card.js'
import type { CredentialActions } from './card.js'
import type { Mode } from '../config.js'
import type { WorkBuddyRegion, WorkBuddyStatus } from '../workbuddy.js'
import type { ControlAction, ControlReply } from '../remote.js'

export interface ConnectionState { mode: Mode; region: WorkBuddyRegion; writable: boolean; login?: WorkBuddyStatus }
export interface ConnectionActions {
  status(): Promise<ConnectionState>
  select(mode: Mode, region: WorkBuddyRegion): Promise<void>
  control(action: ControlAction): Promise<ControlReply>
}
const control: CSSProperties = { font: 'inherit', color: 'inherit', background: 'transparent',
  border: '1px solid color-mix(in srgb, currentColor 25%, transparent)', borderRadius: 6, padding: '8px 12px' }
const label: CSSProperties = { display: 'grid', gap: 6, fontSize: 13 }

export function ProviderCard({ actions, connection }: { actions: CredentialActions; connection: ConnectionActions }) {
  const [state, setState] = useState<ConnectionState>()
  const [issue, setIssue] = useState('')
  const [busy, setBusy] = useState(false)
  const [url, setURL] = useState('')
  const [polling, setPolling] = useState(false)
  useEffect(() => {
    let live = true
    void connection.status().then(value => { if (live) setState(value) }, () => { if (live) setIssue('读取接入设置失败，请重新打开设置。') })
    return () => { live = false }
  }, [connection])
  useEffect(() => {
    if (!polling) return
    let live = true
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const result = await connection.control('poll')
        if (!live) return
        if (result.pending) timer = setTimeout(() => { void poll() }, 1500)
        else {
          setPolling(false); setURL(''); setIssue(result.issue ?? '')
          setState(await connection.status())
        }
      } catch { if (live) { setPolling(false); setIssue('登录状态读取失败，请重试。') } }
    }
    timer = setTimeout(() => { void poll() }, 1500)
    return () => { live = false; clearTimeout(timer) }
  }, [polling, connection])

  async function select(mode: Mode, region: WorkBuddyRegion) {
    setBusy(true); setIssue(''); setPolling(false); setURL('')
    try { await connection.select(mode, region); setState(await connection.status()) }
    catch { setIssue('保存接入方式失败，请重试。') }
    finally { setBusy(false) }
  }
  async function command(action: ControlAction) {
    setBusy(true); setIssue('')
    try {
      const result = await connection.control(action)
      setIssue(result.issue ?? '')
      if (result.url) { setURL(result.url); setPolling(true) }
      else { setURL(''); setPolling(false); setState(await connection.status()) }
    } catch { setIssue('WorkBuddy 操作失败，请重试。') }
    finally { setBusy(false) }
  }
  const mode = state?.mode ?? 'api'
  return <section aria-label="CodeBuddy 接入设置" style={{ marginTop: 20, display: 'grid', gap: 12 }}>
    <strong>CodeBuddy / WorkBuddy</strong>
    <label style={label}>接入方式 <select style={control} aria-label="CodeBuddy 接入方式" value={mode} disabled={!state?.writable || busy}
      onChange={event => { void select(event.target.value as Mode, state?.region ?? 'cn') }}>
      <option value="api">CodeBuddy API Key</option><option value="workbuddy">WorkBuddy 登录（免 API Key）</option>
    </select></label>
    {mode === 'api' ? <CodeBuddyKeyCard actions={actions} /> : <section aria-label="WorkBuddy 登录" style={{ display: 'grid', gap: 10 }}>
      <label style={label}>WorkBuddy 版本 <select style={control} aria-label="WorkBuddy 版本" value={state?.region ?? 'cn'} disabled={!state?.writable || busy || polling}
        onChange={event => { void select('workbuddy', event.target.value as WorkBuddyRegion) }}>
        <option value="cn">国内版</option><option value="intl">国际版 WorkBuddy AI</option>
      </select></label>
      <strong>{state?.login?.configured ? `已连接（${state.login.source === 'browser' ? '浏览器登录' : '本机登录'}）` : '未连接 WorkBuddy'}</strong>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>复用本机登录态，工具由 DSH 执行。若本机凭据已加密，请使用浏览器登录。模型列表在启动、切换接入方式或完成登录时获取。</p>
      {state?.login?.issue ? <p role="note" style={{ margin: 0, fontSize: 12 }}>{state.login.issue}</p> : null}
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={control} type="button" disabled={busy || polling} onClick={() => { void command('desktop') }}>使用本机登录</button>
        <button style={control} type="button" disabled={busy || polling} onClick={() => { void command('login') }}>浏览器登录</button>
        {polling ? <button style={control} type="button" disabled={busy} onClick={() => { void command('cancel') }}>取消登录</button> : null}
      </div>
      {url ? <a href={url} target="_blank" rel="noopener noreferrer">打开 WorkBuddy 登录页面，完成后将自动连接</a> : null}
    </section>}
    {issue ? <p role="alert" style={{ margin: 0, fontSize: 12 }}>{issue}</p> : null}
  </section>
}
