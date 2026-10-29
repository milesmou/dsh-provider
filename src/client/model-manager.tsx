import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-settings-controller/remote'
import type { ModelDirectoryReply } from '../model-management.js'

export interface ModelManagerState extends ModelDirectoryReply { hiddenModels: string[]; writable: boolean }
export interface ModelManagementActions {
  load(refresh: boolean): Promise<ModelManagerState>
  setHidden(id: string, hidden: boolean): Promise<string[]>
  showAll(): Promise<string[]>
}

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown> : {}

export function modelManagementActions(ctx: Context, options: {
  namespace: string; path?: string; models(refresh: boolean): Promise<ModelDirectoryReply>
}): ModelManagementActions {
  const settings = async () => {
    const result = await ctx.remote.settings.describe()
    if (!result.ok) throw new Error('Model settings unavailable')
    const row = result.value.namespaces.find(item => item.ns === options.namespace)
    if (!row) throw new Error('Model component unavailable')
    const value = options.path ? object(object(row.value)[options.path]) : object(row.value)
    const hiddenModels = Array.isArray(value.hiddenModels) ? value.hiddenModels.filter((id): id is string => typeof id === 'string') : []
    return { ns: row.ns, revision: row.revision, hiddenModels, writable: result.value.writable }
  }
  const update = async (transform: (current: string[]) => string[]) => {
    // Read the latest revision for every edit so unrelated component preferences are preserved.
    const current = await settings()
    if (!current.writable) throw new Error('Model settings are read-only')
    const hiddenModels = [...new Set(transform(current.hiddenModels))].sort()
    const value = { hiddenModels }
    const patch = options.path ? { [options.path]: value } : value
    const result = await ctx.remote.settings.update(current.ns, patch, current.revision)
    if (!result.ok) throw new Error('Model settings write refused')
    return hiddenModels
  }
  return {
    load: async refresh => {
      const [state, directory] = await Promise.all([settings(), options.models(refresh)])
      return { ...directory, hiddenModels: state.hiddenModels, writable: state.writable }
    },
    setHidden: (id, hidden) => update(current => hidden ? [...current, id] : current.filter(value => value !== id)),
    showAll: () => update(() => []),
  }
}

const control: CSSProperties = { font: 'inherit', color: 'inherit', background: 'transparent',
  border: '1px solid color-mix(in srgb, currentColor 25%, transparent)', borderRadius: 6, padding: '6px 10px' }

function contextLabel(value?: number): string | undefined {
  if (!value) return undefined
  return value >= 1000000 ? `${Math.round(value / 10000) / 100}M` : `${Math.round(value / 100) / 10}K`
}

export function ModelManager({ actions, provider }: { actions: ModelManagementActions; provider: string }) {
  const [state, setState] = useState<ModelManagerState>()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [issue, setIssue] = useState('')
  const generation = useRef(0)
  const load = useCallback(async (refresh: boolean) => {
    const current = ++generation.current
    setBusy(true); setIssue('')
    try {
      const next = await actions.load(refresh)
      if (current === generation.current) setState(next)
    } catch {
      if (current === generation.current) setIssue('无法读取模型列表，请确认组件已启用后重试。')
    } finally { if (current === generation.current) setBusy(false) }
  }, [actions])
  useEffect(() => {
    setState(undefined)
    void load(false)
    return () => { ++generation.current }
  }, [load])
  async function save(operation: () => Promise<string[]>) {
    const current = ++generation.current
    setBusy(true); setIssue('')
    try {
      const hiddenModels = await operation()
      if (current === generation.current) setState(previous => previous ? { ...previous, hiddenModels } : previous)
    } catch {
      if (current === generation.current) setIssue('保存模型显示设置失败，请刷新后重试。')
    } finally { if (current === generation.current) setBusy(false) }
  }
  const hidden = new Set(state?.hiddenModels ?? [])
  const models = state?.models ?? []
  const visible = models.filter(model => !hidden.has(model.id)).length
  const search = query.trim().toLowerCase()
  const matches = models.filter(model => `${model.name} ${model.id}`.toLowerCase().includes(search))
  return <details aria-label={`${provider} 模型管理`} style={{ border: '1px solid color-mix(in srgb, currentColor 18%, transparent)', borderRadius: 8 }}>
    <summary style={{ cursor: 'pointer', padding: '10px 12px', fontSize: 13 }}>
      <strong>模型管理</strong>
      <span style={{ marginLeft: 12, opacity: 0.65, fontSize: 12 }}>{state ? `显示 ${visible}/${models.length} · 已隐藏 ${models.length - visible}` : busy ? '读取中…' : '未加载'}</span>
    </summary>
    <div style={{ padding: '0 12px 12px', display: 'grid', gap: 10, fontSize: 12 }}>
      <p style={{ margin: 0, lineHeight: 1.7, opacity: 0.7 }}>显示设置自动保存，隐藏的模型会从对话模型选择列表中移除。</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="search" aria-label={`${provider} 搜索模型`} placeholder="搜索模型名称或 ID" value={query}
          onChange={event => setQuery(event.target.value)} style={{ ...control, flex: '1 1 160px', minWidth: 0 }} />
        <button type="button" style={control} disabled={busy} onClick={() => { void load(true) }}>{busy ? '处理中…' : '刷新列表'}</button>
        <button type="button" style={control} disabled={busy || !state?.writable || !state.hiddenModels.length}
          onClick={() => { void save(() => actions.showAll()) }}>全部显示</button>
      </div>
      {state && !state.writable ? <p style={{ margin: 0 }}>当前配置只读。</p> : null}
      {state && !visible && models.length ? <p style={{ margin: 0 }}>全部模型已隐藏，可点击眼睛图标或“全部显示”恢复。</p> : null}
      {matches.length ? <ul aria-label={`${provider} 模型列表`} style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 280, overflowY: 'auto' }}>
        {matches.map(model => <li key={model.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0',
          borderBottom: '1px solid color-mix(in srgb, currentColor 10%, transparent)' }}>
          <div style={{ flex: 1, minWidth: 0, opacity: hidden.has(model.id) ? 0.55 : 1 }}>
            <div style={{ fontWeight: 500, overflowWrap: 'anywhere' }}>{model.name}</div>
            <div style={{ opacity: 0.65, fontSize: 11, overflowWrap: 'anywhere' }}>{model.id}{contextLabel(model.contextWindow) ? ` · ${contextLabel(model.contextWindow)} 上下文` : ''}</div>
          </div>
          <button type="button" role="switch" aria-label={`${provider} 显示 ${model.name} (${model.id})`} aria-checked={!hidden.has(model.id)}
            title={hidden.has(model.id) ? '显示模型' : '隐藏模型'} disabled={busy || !state?.writable}
            onClick={() => { void save(() => actions.setHidden(model.id, !hidden.has(model.id))) }}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', width: 28, height: 28,
              padding: 4, border: 0, borderRadius: 4, background: 'transparent', color: 'inherit',
              cursor: busy || !state?.writable ? 'default' : 'pointer', opacity: busy || !state?.writable ? 0.35 : hidden.has(model.id) ? 0.55 : 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {hidden.has(model.id) ? <path d="m3 3 18 18" /> : null}
            </svg>
          </button>
        </li>)}
      </ul> : state ? <p style={{ margin: 0 }}>{models.length ? '没有匹配的模型。' : '暂无模型，请连接账号后刷新列表。'}</p> : null}
      {issue || state?.issue ? <p role="alert" style={{ margin: 0, lineHeight: 1.7 }}>{issue || state?.issue}</p> : null}
    </div>
  </details>
}
