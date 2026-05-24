import { FolderOpen, Database, BookA, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  end: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: FolderOpen, label: 'Projects', end: true },
  { to: '/tm', icon: Database, label: 'TM', end: false },
  { to: '/terminology', icon: BookA, label: 'Glossary', end: false },
  { to: '/settings', icon: Settings, label: 'Settings', end: false },
]
