import type { Context } from '@deepseek-ai/cordis'

const MARKER = 'data-dsh-provider-settings-nav'
const PANEL_NAV = '[data-shortcut-modal="settings"] nav'
const PUZZLE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6H5a2 2 0 0 0-2 2v3h1a3 3 0 1 1 0 6H3v3a1 1 0 0 0 1 1h5v-1a3 3 0 1 1 6 0v1h5a1 1 0 0 0 1-1v-5h-1a3 3 0 1 0 0-6h1V8a2 2 0 0 0-2-2h-4V5a3 3 0 1 0-6 0v1Z"/></svg>'

/** DSH rc.3 hardcodes navigation icons; keep this adapter scoped to our own row. */
export function installSettingsNavIcon(ctx: Context, label: string): void {
  ctx.effect(() => {
    if (typeof document === 'undefined' || !document.body) return () => {}
    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-provider'
    const mask = `url("data:image/svg+xml,${encodeURIComponent(PUZZLE)}") center / contain no-repeat`
    style.textContent = `
      ${PANEL_NAV} button[${MARKER}] > svg { display: none; }
      ${PANEL_NAV} button[${MARKER}]::before {
        content: ""; width: 16px; height: 16px; flex: 0 0 16px;
        background-color: currentColor; -webkit-mask: ${mask}; mask: ${mask};
      }
    `
    document.head.appendChild(style)
    let nav: Element | null = null
    const marked = new Set<Element>()
    const clear = () => { for (const button of marked) button.removeAttribute(MARKER); marked.clear() }
    const update = () => {
      clear()
      for (const button of nav?.querySelectorAll('button') ?? []) {
        if (button.textContent?.trim() !== label || button.firstElementChild?.localName !== 'svg') continue
        button.setAttribute(MARKER, '')
        marked.add(button)
      }
    }
    const navObserver = new MutationObserver(update)
    const sync = () => {
      const next = document.querySelector(PANEL_NAV)
      if (next === nav) return
      navObserver.disconnect()
      clear()
      nav = next
      if (nav) navObserver.observe(nav, { childList: true, subtree: true, characterData: true })
      update()
    }
    // Settings is portaled directly into body. Observe its navigation only while open.
    const bodyObserver = new MutationObserver(sync)
    bodyObserver.observe(document.body, { childList: true })
    sync()
    return () => { bodyObserver.disconnect(); navObserver.disconnect(); clear(); style.remove() }
  })
}
