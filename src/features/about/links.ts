import { Github, Linkedin, Globe, Coffee } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface BrandLink {
  label: string
  description: string
  href: string
  icon: LucideIcon
}

/** Canonical project + author links, shared by the About page and footer. */
export const REPO_URL = 'https://github.com/pedrobritx/verbalis'
export const AUTHOR_NAME = 'Pedro Brito'
export const AUTHOR_EMAIL = 'pedrobritx@gmail.com'
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE.md`

export const BRAND_LINKS: BrandLink[] = [
  {
    label: 'GitHub',
    description: 'Source, issues & releases',
    href: REPO_URL,
    icon: Github,
  },
  {
    label: 'LinkedIn',
    description: 'Connect with the author',
    href: 'https://www.linkedin.com/in/pedrobritx/',
    icon: Linkedin,
  },
  {
    label: 'Website',
    description: 'Pedro Brito — britx.me',
    href: 'https://britx.me',
    icon: Globe,
  },
  {
    label: 'Buy me a coffee',
    description: 'Support development',
    href: 'https://buymeacoffee.com/pedrobritx',
    icon: Coffee,
  },
]
