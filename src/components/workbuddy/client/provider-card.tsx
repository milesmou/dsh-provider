import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { CodeBuddyKeyCard } from './card.js'
import type { CredentialActions } from './card.js'
import type { Mode } from '../config.js'
import type { WorkBuddyRegion, WorkBuddyStatus } from '../session.js'
import type { ControlAction, ControlReply } from '../remote.js'

export interface ConnectionState { mode: Mode; region: WorkBuddyRegion; writable: boolean; login?: WorkBuddyStatus }
/** One discovered model for the context-window picker, with its base capacity. */
export interface ContextModelInfo { id: string; name: string; contextWindow?: number }
export interface ContextSettings { models: ContextModelInfo[]; overrides: Record<string, number> }
export interface ConnectionActions {
  status(): Promise<ConnectionState>
  select(mode: Mode, region: WorkBuddyRegion): Promise<void>
  control(action: ControlAction): Promise<ControlReply>
  /** Discovered models + saved per-model context-window overrides. */
  contexts?(): Promise<ContextSettings>
  /** Save one model's context window in tokens; 0 clears it (model default). */
  setContext?(modelId: string, tokens: number): Promise<void>
}
const control: CSSProperties = { font: 'inherit', color: 'inherit', background: 'transparent',
  border: '1px solid color-mix(in srgb, currentColor 25%, transparent)', borderRadius: 6, padding: '8px 12px' }
// Native popup menus need an explicit foreground/background pair: inheriting
// light text alone can leave an option unreadable on the OS's white popup.
const selectColors: CSSProperties = {
  color: 'var(--dsw-alias-label-primary, CanvasText)',
  backgroundColor: 'var(--dsw-alias-bg-layer-2, Canvas)',
}
const selectControl: CSSProperties = { ...control, ...selectColors }
const label: CSSProperties = { display: 'grid', gap: 6, fontSize: 13 }
const hint: CSSProperties = { margin: 0, fontSize: 12, opacity: 0.75, lineHeight: 1.6 }
const row: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }

/** WorkBuddy's default and maximum working windows, in tokens (1K = 1024). */
const WINDOW_200K = 200 * 1024
const WINDOW_1M = 1024 * 1024

function formatWindow(tokens: number | undefined): string {
  if (tokens === undefined) return '未知'
  if (tokens >= WINDOW_1M && tokens % WINDOW_1M === 0) return `${tokens / WINDOW_1M}M`
  if (tokens >= 1024 && tokens % 1024 === 0) return `${tokens / 1024}K`
  return String(tokens)
}

/** One model's context-window chooser: default / 200K / 1M / custom. */
function ContextWindowRow({ model, value, onSave }: {
  model: ContextModelInfo
  value: number | undefined
  onSave: (tokens: number) => Promise<void>
}) {
  const preset = value === undefined ? 'default' : value === WINDOW_200K ? '200k' : value === WINDOW_1M ? '1m' : 'custom'
  const [choice, setChoice] = useState(preset)
  const [custom, setCustom] = useState(preset === 'custom' && value !== undefined ? String(value) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setChoice(preset)
    setCustom(preset === 'custom' && value !== undefined ? String(value) : '')
  }, [preset, value])
  async function save(tokens: number) {
    if (busy) return
    setBusy(true); setError('')
    try { await onSave(tokens) } catch { setError('保存失败，请重试。') } finally { setBusy(false) }
  }
  function choose(next: string) {
    setChoice(next); setError('')
    if (next === 'default') void save(0)
    else if (next === '200k') void save(WINDOW_200K)
    else if (next === '1m') void save(WINDOW_1M)
  }
  function applyCustom() {
    const tokens = Number(custom.trim())
    if (!Number.isSafeInteger(tokens) || tokens <= 0) { setError('请输入正整数（单位 tokens）'); return }
    void save(tokens)
  }
  return <div style={{ display: 'grid', gap: 6 }}>
    <div style={row}>
      <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }} title={model.name}>{model.name}</span>
      <select style={selectControl} value={choice} disabled={busy} aria-label={`${model.name} 上下文窗口`}
        onChange={event => choose(event.target.value)}>
        <option style={selectColors} value="default">默认（模型 {formatWindow(model.contextWindow)}）</option>
        <option style={selectColors} value="200k">200K</option>
        <option style={selectColors} value="1m">1M</option>
        <option style={selectColors} value="custom">自定义…</option>
      </select>
    </div>
    {choice === 'custom' ? <div style={{ display: 'flex', gap: 8 }}>
      <input style={{ ...control, flex: 1, minWidth: 0 }} inputMode="numeric" placeholder="例如 512000"
        aria-label={`${model.name} 自定义上下文窗口（tokens）`} value={custom} disabled={busy}
        onChange={event => { setCustom(event.target.value); setError('') }} />
      <button type="button" style={control} disabled={busy} onClick={applyCustom}>应用</button>
    </div> : null}
    {error ? <p role="alert" style={{ margin: 0, fontSize: 12 }}>{error}</p> : null}
  </div>
}

function ContextWindowSettings({ contexts, setContext }: {
  contexts(): Promise<ContextSettings>
  setContext(modelId: string, tokens: number): Promise<void>
}) {
  const [data, setData] = useState<ContextSettings>()
  const [issue, setIssue] = useState('')
  const load = async () => {
    try { setData(await contexts()); setIssue('') }
    catch { setIssue('读取模型上下文窗口失败，请重新打开设置。') }
  }
  useEffect(() => {
    let live = true
    void contexts().then(value => { if (live) setData(value) },
      () => { if (live) setIssue('读取模型上下文窗口失败，请重新打开设置。') })
    return () => { live = false }
  }, [])
  return <section aria-label="上下文窗口" style={{ borderTop: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
    paddingTop: 16, marginTop: 4, display: 'grid', gap: 10 }}>
    <strong>上下文窗口</strong>
    <p style={hint}>每个模型每轮最多携带的历史窗口。窗口越小，压缩越早、单轮积分越少；默认使用模型自身窗口。</p>
    {data === undefined ? <p style={hint}>读取中…</p>
      : data.models.length === 0 ? <p style={hint}>暂无模型；完成登录或保存密钥后自动获取。</p>
      : data.models.map(model => <ContextWindowRow key={model.id} model={model} value={data.overrides[model.id]}
          onSave={async tokens => { await setContext(model.id, tokens); await load() }} />)}
    {issue ? <p role="alert" style={{ margin: 0, fontSize: 12 }}>{issue}</p> : null}
  </section>
}

export function WorkBuddyCard({ actions, connection }: { actions: CredentialActions; connection: ConnectionActions }) {
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
  // 点击“浏览器登录”时在同步点击栈内先开一个占位窗口，避免异步拿到 URL 后
  // window.open 被浏览器弹窗拦截；随后把该窗口导航到真正的登录地址。
  async function startLogin() {
    const popup = window.open('about:blank', '_blank')
    setBusy(true); setIssue('')
    try {
      const result = await connection.control('login')
      if (result.url) {
        if (popup && !popup.closed) { popup.location.href = result.url; try { popup.focus() } catch { /* 跨域后无法 focus */ } }
        setURL(result.url); setPolling(true); setIssue('')
      } else {
        try { popup?.close() } catch { /* 已关闭 */ }
        setURL(''); setPolling(false); setIssue(result.issue ?? '')
        setState(await connection.status())
      }
    } catch {
      try { popup?.close() } catch { /* 已关闭 */ }
      setURL(''); setPolling(false); setIssue('WorkBuddy 操作失败，请重试。')
    }
    finally { setBusy(false) }
  }
  const mode = state?.mode ?? 'api'
  return <section aria-label="WorkBuddy 组件设置" style={{ marginTop: 20, display: 'grid', gap: 12 }}>
    <strong>WorkBuddy 组件</strong>
    <label style={label}>接入方式 <select style={selectControl} aria-label="WorkBuddy 接入方式" value={mode} disabled={!state?.writable || busy}
      onChange={event => { void select(event.target.value as Mode, state?.region ?? 'cn') }}>
      <option style={selectColors} value="api">CodeBuddy API Key</option><option style={selectColors} value="workbuddy">WorkBuddy 登录（免 API Key）</option>
    </select></label>
    {mode === 'api' ? <CodeBuddyKeyCard actions={actions} /> : <section aria-label="WorkBuddy 登录" style={{ display: 'grid', gap: 10 }}>
      <label style={label}>WorkBuddy 版本 <select style={selectControl} aria-label="WorkBuddy 版本" value={state?.region ?? 'cn'} disabled={!state?.writable || busy || polling}
        onChange={event => { void select('workbuddy', event.target.value as WorkBuddyRegion) }}>
        <option style={selectColors} value="cn">国内版</option><option style={selectColors} value="intl">国际版 WorkBuddy AI</option>
      </select></label>
      <strong>{state?.login?.configured ? `已连接（${state.login.source === 'browser' ? '浏览器登录' : '本机登录'}）` : '未连接 WorkBuddy'}</strong>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>复用本机登录态，工具由 DSH 执行。若本机凭据已加密，请使用浏览器登录。模型列表在启动、切换接入方式或完成登录时获取。</p>
      {state?.login?.issue ? <p role="note" style={{ margin: 0, fontSize: 12 }}>{state.login.issue}</p> : null}
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={control} type="button" disabled={busy || polling} onClick={() => { void startLogin() }}>浏览器登录</button>
        {polling ? <button style={control} type="button" disabled={busy} onClick={() => { void command('cancel') }}>取消登录</button> : null}
      </div>
      {url ? <a href={url} target="_blank" rel="noopener noreferrer">登录页面未自动打开？点此手动打开，完成后将自动连接</a> : null}
    </section>}
    {connection?.contexts && connection?.setContext
      ? <ContextWindowSettings key={`${mode}:${state?.region ?? 'cn'}`}
          contexts={connection.contexts} setContext={connection.setContext} />
      : null}
    {issue ? <p role="alert" style={{ margin: 0, fontSize: 12 }}>{issue}</p> : null}
  </section>
}
