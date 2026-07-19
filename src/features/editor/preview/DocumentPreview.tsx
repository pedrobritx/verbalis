import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, type ReactNode } from 'react'
import { documentRepo, blockRepo } from '@/storage/repositories/documentRepo'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { renderDocument, type RenderBlock } from '@/core/documents/render'
import type { InlineRun } from '@/core/documents/model'
import { useEditorActionsStore } from '../useEditorActionsStore'
import { usePreviewStore } from './usePreviewStore'

/**
 * Live preview of the assembled document (Phase 2.3). Renders the block tree with
 * each block's translated segments substituted (source falls back in for
 * untranslated sentences, tinted). Source / Target / Side-by-side; clicking a
 * block focuses its first segment in the editor below.
 */
export function DocumentPreview({ projectId }: { projectId: string }) {
  const mode = usePreviewStore((s) => s.mode)
  const setMode = usePreviewStore((s) => s.setMode)
  const jump = useEditorActionsStore((s) => s.actions?.jumpToSegment)

  const blocks = useLiveQuery(async () => {
    const doc = await documentRepo.getByProject(projectId)
    return doc ? blockRepo.byDocument(doc.id) : []
  }, [projectId])
  const segments = useLiveQuery(() => segmentRepo.byProject(projectId), [projectId])

  if (!blocks || !segments) {
    return (
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        Loading preview…
      </p>
    )
  }

  const model = renderDocument(blocks, segments)

  return (
    <div className="flex flex-col gap-2" data-testid="document-preview">
      <div className="flex items-center justify-between">
        <span className="text-footnote font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
          Document preview
        </span>
        <div
          role="tablist"
          aria-label="Preview mode"
          className="inline-flex items-center gap-1 rounded-md border p-0.5 text-xs"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {(['source', 'target', 'split'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              data-testid={`preview-mode-${m}`}
              onClick={() => setMode(m)}
              className="rounded px-2 py-1 capitalize transition-colors"
              style={{
                background: mode === m ? 'var(--color-accent-fill)' : 'transparent',
                color: mode === m ? 'var(--color-accent)' : 'var(--color-muted)',
                fontWeight: mode === m ? 600 : 400,
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div
        className="max-h-[40vh] overflow-auto rounded-md border p-4"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        data-testid="preview-body"
      >
        {model.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Nothing to preview.
          </p>
        ) : (
          model.map((block) => (
            <PreviewBlock key={block.id} block={block} mode={mode} onJump={jump} />
          ))
        )}
      </div>
    </div>
  )
}

function Runs({ runs, fallback }: { runs?: InlineRun[]; fallback: string }) {
  if (!runs || runs.length === 0) return <>{fallback}</>
  return (
    <>
      {runs.map((r, i) => {
        let node: ReactNode = r.text
        if (r.bold) node = <strong>{node}</strong>
        if (r.italic) node = <em>{node}</em>
        if (r.underline) node = <u>{node}</u>
        if (r.sub) node = <sub>{node}</sub>
        if (r.sup) node = <sup>{node}</sup>
        if (r.href) node = <a href={r.href}>{node}</a>
        return <Fragment key={i}>{node}</Fragment>
      })}
    </>
  )
}

function PreviewBlock({
  block,
  mode,
  onJump,
}: {
  block: RenderBlock
  mode: 'source' | 'target' | 'split'
  onJump?: (oneBasedIndex: number) => void
}) {
  const focus = () => {
    const first = block.refs[0]
    if (first && onJump) onJump(first.index + 1)
  }

  if (block.kind === 'image') {
    return (
      <div
        className="my-2 rounded border border-dashed p-3 text-center text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        data-testid="preview-image"
      >
        [image]
      </div>
    )
  }

  if (block.kind === 'table') {
    return (
      <table className="my-2 w-full border-collapse text-sm" data-testid="preview-block" data-kind="table">
        <tbody>
          {(block.rows ?? []).map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  onClick={cell.ref && onJump ? () => onJump(cell.ref!.index + 1) : undefined}
                  className="border p-1.5 align-top"
                  style={{
                    borderColor: 'var(--color-border)',
                    cursor: cell.ref ? 'pointer' : undefined,
                    color: cell.ref && !cell.ref.translated ? 'var(--color-muted)' : 'var(--color-text)',
                  }}
                >
                  {mode === 'source' ? <Runs runs={cell.sourceRuns} fallback={cell.sourceText} /> : cell.targetText}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  const Wrapper = wrapperFor(block)
  const showSource = mode === 'source' || mode === 'split'
  const showTarget = mode === 'target' || mode === 'split'
  const untranslatedTint = !block.hasTranslation

  return (
    <Wrapper
      data-testid="preview-block"
      data-kind={block.kind}
      onClick={focus}
      className="my-1 cursor-pointer rounded px-1 transition-colors hover:bg-[var(--color-fill)]"
    >
      {showSource && (
        <span
          data-testid="preview-source"
          style={{ color: 'var(--color-muted)', display: mode === 'split' ? 'block' : undefined }}
        >
          <Runs runs={block.sourceRuns} fallback={block.sourceText} />
        </span>
      )}
      {showTarget && (
        <span
          data-testid="preview-target"
          style={{ color: untranslatedTint ? 'var(--color-muted)' : 'var(--color-text)' }}
        >
          {block.targetText}
        </span>
      )}
    </Wrapper>
  )
}

type BlockWrapperProps = {
  children: ReactNode
  'data-testid': string
  'data-kind': string
  onClick: () => void
  className: string
}

/** Choose the semantic wrapper element for a text block. */
function wrapperFor(block: RenderBlock): (props: BlockWrapperProps) => ReactNode {
  if (block.kind === 'heading') {
    const level = Math.min(6, Math.max(1, block.depth ?? 1))
    const Tag = `h${level}` as 'h1'
    return (props) => <Tag {...props} />
  }
  if (block.kind === 'code') return (props) => <pre {...props} />
  if (block.kind === 'blockquote') return (props) => <blockquote {...props} />
  if (block.kind === 'list_item') return (props) => <li {...props} style={{ marginLeft: '1.25rem', listStyle: block.ordered ? 'decimal' : 'disc' }} />
  return (props) => <p {...props} />
}
