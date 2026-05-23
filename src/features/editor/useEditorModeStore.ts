import { create } from 'zustand'
import type { SegmentStatus } from '@/core/types'

export type StatusFilter = 'all' | SegmentStatus

interface EditorModeState {
  reviewMode: boolean
  statusFilter: StatusFilter
  toggleReviewMode: () => void
  setReviewMode: (on: boolean) => void
  setStatusFilter: (filter: StatusFilter) => void
}

export const useEditorModeStore = create<EditorModeState>((set) => ({
  reviewMode: false,
  statusFilter: 'all',
  toggleReviewMode: () => set((s) => ({ reviewMode: !s.reviewMode })),
  setReviewMode: (on) => set({ reviewMode: on }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
}))
