import type { CSSProperties } from 'react'
import { WORKBUDDY_PROVIDER } from './credits-badge.js'

/** Owner props the model-selection label slot supplies (see ui-model-selection). */
export interface ModelNameLabelProps {
  provider?: { id?: string; name?: string }
  model?: { id?: string; name?: string }
  placement?: 'trigger' | 'menu' | 'option'
  selected?: boolean
}

const row: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }

/**
 * The sparkle mark shown before a WorkBuddy-provider model name in the model
 * selector (trigger, menu header, and option rows). Monochrome so it follows
 * the surrounding label color in every theme.
 */
function WorkBuddyMark() {
  return <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flex: 'none' }}>
    <path d="M8 1.4l1.55 4.05L13.6 7l-4.05 1.55L8 12.6 6.45 8.55 2.4 7l4.05-1.55L8 1.4z" fill="currentColor" />
    <path d="M12.9 10.9l.55 1.45 1.45.55-1.45.55-.55 1.45-.55-1.45-1.45-.55 1.45-.55.55-1.45z" fill="currentColor" opacity="0.6" />
  </svg>
}

/**
 * Model-name label for the composer's model selector. It replaces the default
 * plain name for every model: WorkBuddy-provider models gain a small mark
 * before the name, other providers keep the plain name unchanged.
 */
export function ModelNameLabel({ provider, model }: ModelNameLabelProps) {
  const name = model?.name ?? model?.id ?? ''
  if (provider?.id !== WORKBUDDY_PROVIDER) return <span style={row}>{name}</span>
  return <span style={row}><WorkBuddyMark /><span>{name}</span></span>
}
