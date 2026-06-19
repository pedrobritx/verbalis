import { FolderOpen, Database, BookA, Languages, Library, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  end: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: FolderOpen, label: 'Projects', end: true },
  { to: '/translate', icon: Languages, label: 'Translate', end: false },
  { to: '/tm', icon: Database, label: 'TM', end: false },
  { to: '/terminology', icon: BookA, label: 'Glossary', end: false },
  { to: '/corpora', icon: Library, label: 'Corpora', end: false },
  { to: '/settings', icon: Settings, label: 'Settings', end: false },
]
