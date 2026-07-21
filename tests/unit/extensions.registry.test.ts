import { beforeEach, describe, expect, it, vi } from 'vitest'
import { extensionRegistry } from '@/core/extensions/registry'
import type { ExtensionManifest } from '@/core/extensions/types'

function manifest(id: string, kind: ExtensionManifest['kinds'][number]): ExtensionManifest {
  return { id, name: id, version: '1.0.0', kinds: [kind], permissions: [], builtIn: true }
}

beforeEach(() => extensionRegistry.__resetForTest())

describe('ExtensionRegistry', () => {
  it('registers, gets, and lists (id-sorted, filterable by kind)', () => {
    extensionRegistry.register(manifest('mt.b', 'mt-provider'))
    extensionRegistry.register(manifest('mt.a', 'mt-provider'))
    extensionRegistry.register(manifest('qa.x', 'qa-rule'))

    expect(extensionRegistry.get('mt.a')?.name).toBe('mt.a')
    expect(extensionRegistry.list('mt-provider').map((m) => m.id)).toEqual(['mt.a', 'mt.b'])
    expect(extensionRegistry.list().map((m) => m.id)).toEqual(['mt.a', 'mt.b', 'qa.x'])
  })

  it('treats a registered extension as enabled by default, and toggles it', () => {
    extensionRegistry.register(manifest('mt.a', 'mt-provider'))
    expect(extensionRegistry.isEnabled('mt.a')).toBe(true)

    extensionRegistry.setEnabled('mt.a', false)
    expect(extensionRegistry.isEnabled('mt.a')).toBe(false)
    expect(extensionRegistry.getDisabledIds()).toEqual(['mt.a'])

    extensionRegistry.setEnabled('mt.a', true)
    expect(extensionRegistry.isEnabled('mt.a')).toBe(true)
    expect(extensionRegistry.getDisabledIds()).toEqual([])
  })

  it('treats an unregistered id as not enabled and ignores setEnabled on it', () => {
    expect(extensionRegistry.isEnabled('missing')).toBe(false)
    extensionRegistry.setEnabled('missing', false)
    expect(extensionRegistry.getDisabledIds()).toEqual([])
  })

  it('hydrates the disabled set and notifies subscribers on change', () => {
    extensionRegistry.register(manifest('mt.a', 'mt-provider'))
    const listener = vi.fn()
    const off = extensionRegistry.subscribe(listener)

    extensionRegistry.setDisabledIds(['mt.a'])
    expect(extensionRegistry.isEnabled('mt.a')).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)

    // No-op change does not notify.
    extensionRegistry.setEnabled('mt.a', false)
    expect(listener).toHaveBeenCalledTimes(1)

    off()
    extensionRegistry.setEnabled('mt.a', true)
    expect(listener).toHaveBeenCalledTimes(1) // unsubscribed
  })

  it('unregister removes the manifest and clears its disabled flag', () => {
    extensionRegistry.register(manifest('mt.a', 'mt-provider'))
    extensionRegistry.setEnabled('mt.a', false)
    extensionRegistry.unregister('mt.a')
    expect(extensionRegistry.has('mt.a')).toBe(false)
    expect(extensionRegistry.getDisabledIds()).toEqual([])
  })
})
