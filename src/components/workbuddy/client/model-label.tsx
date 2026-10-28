import { useId } from 'react'
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

/** WorkBuddy's official mark path on its 40×40 icon canvas. */
const MARK_PATH = 'M30.5931 3.12762C30.9853 2.77585 31.0091 2.76226 31.2968 2.74499C31.7628 2.71097 32.1894 2.93488 32.916 3.59634C34.6132 5.13875 36.9769 8.30904 38.4462 11.0168L39.0138 12.0682L39.8156 12.4668C40.5896 12.8579 41.8593 13.6593 42.3898 14.0895C42.6297 14.2878 42.6638 14.2925 42.9133 14.1954C44.0388 13.7572 45.6506 14.3382 47.0727 15.7024C48.3529 16.9294 49.5794 19.026 50.0491 20.7757C50.1177 21.0574 50.2087 21.6628 50.2419 22.1134C50.349 23.6964 49.8414 24.9608 48.8637 25.5331C48.664 25.6484 48.6505 25.6795 48.6561 26.1774C48.7011 28.5481 48.0621 30.9144 46.7785 33.2221C45.3293 35.8133 42.7489 38.4945 39.2566 41.0199C37.3813 42.3846 32.9445 44.9701 30.9382 45.8778C26.1324 48.0414 22.2794 48.8709 18.9329 48.4609C16.9368 48.219 14.6769 47.44 13.34 46.5355C12.9885 46.2925 12.9325 46.2774 12.6637 46.3543C11.2327 46.7651 9.35867 45.9207 7.76659 44.1535C7.13165 43.4471 6.1065 41.7127 5.77404 40.7843C5.0054 38.6118 5.15852 36.6506 6.18236 35.4799C6.44671 35.1785 6.45511 35.1658 6.39735 34.6589C6.30195 33.8289 6.25837 32.6008 6.30192 31.808L6.33666 31.0674L5.22502 29.101C3.5033 26.0375 2.40933 23.4645 1.98744 21.4992C1.76478 20.4218 1.77881 19.9436 2.05222 19.5899C2.21871 19.3763 2.76493 19.1545 3.42322 19.0329C5.08041 18.742 8.69466 19.0056 12.7155 19.7155L13.1329 19.788L14.0511 18.976C15.5747 17.6264 16.587 16.8696 18.4531 15.706C20.3981 14.4891 22.5929 13.4877 25.0648 12.695L25.8577 12.4414L26.2939 11.2964C27.8547 7.17615 29.4533 4.13844 30.5931 3.12762ZM17.5182 24.243C15.7542 25.2615 14.8718 25.7706 14.2236 26.3413C11.5989 28.6526 10.6181 32.3134 11.7354 35.6274C12.0114 36.4457 12.5201 37.3283 13.5386 39.0923C14.5571 40.8564 15.0671 41.7383 15.6378 42.3864C17.9491 45.0112 21.6103 45.9929 24.9243 44.8755C25.7426 44.5995 26.6249 44.0899 28.3888 43.0714L38.5375 37.2121C40.3016 36.1936 41.184 35.6845 41.8321 35.1137C44.4568 32.8024 45.4373 29.1409 44.3198 25.8269C44.0438 25.0086 43.5342 24.1264 42.5158 22.3624C41.4973 20.5983 40.9882 19.7159 40.4175 19.0678C38.1062 16.4432 34.4454 15.4622 31.1314 16.5796C30.3131 16.8556 29.431 17.3651 27.6669 18.3836L17.5182 24.243Z'

/**
 * WorkBuddy's default app icon: a teal rounded square with the white buddy
 * mark. Gradient/clip ids are made unique per instance so several labels on the
 * page do not share one definition.
 */
function WorkBuddyMark({ size = 16 }: { size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const bg = `wbBg${uid}`
  const fg = `wbFg${uid}`
  const clip = `wbClip${uid}`
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" style={{ flex: 'none' }}>
    <defs>
      <linearGradient id={bg} x1="20" y1="0" x2="20" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0EC8A9" />
        <stop offset="1" stopColor="#01C886" />
      </linearGradient>
      <linearGradient id={fg} x1="16.6642" y1="11.0783" x2="35.3762" y2="43.4885" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF" stopOpacity="0.8" />
        <stop offset="0.437689" stopColor="#FFFFFF" />
      </linearGradient>
      <clipPath id={clip}><rect width="40" height="40" rx="8.63158" /></clipPath>
    </defs>
    <g clipPath={`url(#${clip})`}>
      <rect width="40" height="40" rx="8.63158" fill={`url(#${bg})`} />
      <path fillRule="evenodd" clipRule="evenodd" d={MARK_PATH} fill={`url(#${fg})`} />
      <rect x="18.4961" y="31.3344" width="4.00904" height="8.32646" rx="2.00452" transform="rotate(-30 18.4961 31.3344)" fill="#FFFFFF" />
      <rect x="29.3125" y="25.0894" width="4.00904" height="8.32646" rx="2.00452" transform="rotate(-30 29.3125 25.0894)" fill="#FFFFFF" />
    </g>
  </svg>
}

/**
 * Model-name label for the composer's model selector. It replaces the default
 * plain name for every model: WorkBuddy-provider models gain the WorkBuddy icon
 * before the name, other providers keep the plain name unchanged.
 */
export function ModelNameLabel({ provider, model }: ModelNameLabelProps) {
  const name = model?.name ?? model?.id ?? ''
  if (provider?.id !== WORKBUDDY_PROVIDER) return <span style={row}>{name}</span>
  return <span style={row}><WorkBuddyMark /><span>{name}</span></span>
}
