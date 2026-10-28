import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

export interface CredentialStatus {
  configured: boolean
  writable: boolean
}

export interface CredentialActions {
  status(): Promise<CredentialStatus>
  save(value: string): Promise<void>
}

export interface CardProps { actions: CredentialActions }

const field: CSSProperties = {
  font: 'inherit', color: 'inherit', background: 'transparent',
  border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
  borderRadius: 6, padding: '9px 12px', boxSizing: 'border-box',
}

/** Stored secrets never enter props or snapshots; only the unsaved input holds one. */
export function CodeBuddyKeyCard({ actions }: CardProps) {
  const [status, setStatus] = useState<CredentialStatus>()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    void actions.status().then(value => { if (live) setStatus(value) }, () => {
      if (live) { setMessage('读取密钥状态失败，请关闭设置后重试。'); setFailed(true) }
    })
    return () => { live = false }
  }, [actions])

  async function save() {
    const value = draft.trim()
    if (!value || busy || !status?.writable) return
    setBusy(true)
    setMessage('')
    setFailed(false)
    try {
      await actions.save(value)
      setDraft('')
      setStatus(await actions.status())
      setMessage('密钥已保存，下次请求立即生效。')
    } catch {
      // Keep provider errors and secret input out of the rendered diagnostic.
      setFailed(true)
      setMessage('保存失败，请检查密钥格式并重试。')
    } finally { setBusy(false) }
  }

  return <section aria-label="CodeBuddy API" style={{ borderTop: field.border, paddingTop: 20, marginTop: 20, display: 'grid', gap: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <strong>CodeBuddy API</strong>
      <span style={{ fontSize: 12, opacity: 0.7 }}>{status === undefined ? '读取中…' : status.configured ? '已配置密钥' : '未配置密钥'}</span>
    </div>
    <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
      API Key
      <input type="password" autoComplete="new-password" spellCheck={false}
        aria-label="CodeBuddy API Key" style={{ ...field, width: '100%' }} value={draft}
        placeholder={status?.configured ? '已保存；输入新密钥可替换' : '填写 CodeBuddy 访问密钥（ck_…）'}
        disabled={busy || !status?.writable}
        onChange={event => { setDraft(event.target.value); setMessage('') }} />
    </label>
    <p style={{ margin: 0, opacity: 0.7, fontSize: 12, lineHeight: 1.6 }}>
      密钥保存在 DSH 的凭据存储中。保存后，在对话模型选择器中选择 CodeBuddy API。
      插件启动时自动获取模型列表；首次保存或更换密钥后重新获取。
    </p>
    {status?.writable === false ? <p role="note" style={{ margin: 0, fontSize: 12 }}>
      当前凭据存储不可写，请检查 DSH 的凭据存储配置。
    </p> : null}
    <div><button type="button" style={{ ...field, cursor: 'pointer' }}
      disabled={!draft.trim() || busy || !status?.writable} onClick={() => { void save() }}>
      {busy ? '保存中…' : '保存密钥'}
    </button></div>
    {message ? <p role={failed ? 'alert' : 'status'} style={{ margin: 0, fontSize: 12 }}>{message}</p> : null}
  </section>
}
