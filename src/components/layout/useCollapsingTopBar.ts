import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

const COLLAPSE_THRESHOLD_PX = 40
const MOBILE_BREAKPOINT_PX = 768

export function useCollapsingTopBar(scrollRef: RefObject<HTMLElement | null>): boolean {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let lastY = el.scrollTop
    const onScroll = () => {
      if (window.innerWidth >= MOBILE_BREAKPOINT_PX) {
        if (collapsed) setCollapsed(false)
        return
      }
      const y = el.scrollTop
      const delta = y - lastY
      if (y < COLLAPSE_THRESHOLD_PX) {
        setCollapsed(false)
      } else if (delta > 4) {
        setCollapsed(true)
      } else if (delta < -4) {
        setCollapsed(false)
      }
      lastY = y
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollRef, collapsed])

  return collapsed
}
