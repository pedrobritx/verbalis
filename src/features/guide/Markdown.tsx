import { Fragment, type ReactNode } from 'react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Root, RootContent } from 'mdast'

// Minimal, dependency-light mdast -> React renderer for the bundled guide docs.
// The content is authored/trusted markdown (no raw HTML), rendered with the
// remark stack already used for segmentation, so no new dependency is added.

function parse(md: string): Root {
  return unified().use(remarkParse).use(remarkGfm).parse(md) as Root
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderChildren(nodes: any[] | undefined): ReactNode {
  if (!nodes) return null
  return nodes.map((n, i) => <Fragment key={i}>{renderNode(n)}</Fragment>)
}

const HEADING_CLASS: Record<number, string> = {
  1: 'text-title2 font-bold mt-6 mb-3',
  2: 'text-title3 font-semibold mt-6 mb-2',
  3: 'text-headline font-semibold mt-5 mb-2',
  4: 'text-body font-semibold mt-4 mb-1',
  5: 'text-callout font-semibold mt-3 mb-1',
  6: 'text-footnote font-semibold mt-3 mb-1',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderNode(node: any): ReactNode {
  switch (node.type) {
    case 'text':
      return node.value
    case 'strong':
      return <strong style={{ color: 'var(--color-text)' }}>{renderChildren(node.children)}</strong>
    case 'emphasis':
      return <em>{renderChildren(node.children)}</em>
    case 'delete':
      return <del>{renderChildren(node.children)}</del>
    case 'inlineCode':
      return (
        <code
          className="rounded px-1 py-0.5 text-[0.85em] font-mono"
          style={{ background: 'var(--color-fill)', color: 'var(--color-accent)' }}
        >
          {node.value}
        </code>
      )
    case 'break':
      return <br />
    case 'link':
      return (
        <a
          href={node.url}
          target="_blank"
          rel="noreferrer noopener"
          className="underline"
          style={{ color: 'var(--color-accent)' }}
        >
          {renderChildren(node.children)}
        </a>
      )
    case 'heading': {
      const Tag = `h${node.depth}` as keyof JSX.IntrinsicElements
      return (
        <Tag
          className={HEADING_CLASS[node.depth] ?? HEADING_CLASS[6]}
          style={{ color: 'var(--color-text)' }}
        >
          {renderChildren(node.children)}
        </Tag>
      )
    }
    case 'paragraph':
      return (
        <p className="my-2 leading-relaxed text-callout" style={{ color: 'var(--color-text)' }}>
          {renderChildren(node.children)}
        </p>
      )
    case 'blockquote':
      return (
        <blockquote
          className="my-3 border-l-2 pl-3"
          style={{ borderColor: 'var(--color-accent)', color: 'var(--color-muted)' }}
        >
          {renderChildren(node.children)}
        </blockquote>
      )
    case 'thematicBreak':
      return <hr className="my-5" style={{ borderColor: 'var(--color-border)' }} />
    case 'list': {
      const cls = 'my-2 ml-5 flex flex-col gap-1 text-callout'
      return node.ordered ? (
        <ol className={`${cls} list-decimal`} style={{ color: 'var(--color-text)' }}>
          {renderChildren(node.children)}
        </ol>
      ) : (
        <ul className={`${cls} list-disc`} style={{ color: 'var(--color-text)' }}>
          {renderChildren(node.children)}
        </ul>
      )
    }
    case 'listItem':
      return <li className="leading-relaxed">{renderChildren(node.children)}</li>
    case 'code':
      return (
        <pre
          className="my-3 overflow-auto rounded-md p-3 text-xs font-mono"
          style={{ background: 'var(--color-fill)', color: 'var(--color-text)' }}
        >
          <code>{node.value}</code>
        </pre>
      )
    case 'table': {
      const [head, ...rows] = node.children
      return (
        <div className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-footnote">
            <thead>
              <tr>
                {head.children.map((cell: RootContent, i: number) => (
                  <th
                    key={i}
                    className="border px-2 py-1 text-left font-semibold"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    {renderChildren((cell as { children?: unknown[] }).children as never)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: { children: RootContent[] }, ri: number) => (
                <tr key={ri}>
                  {row.children.map((cell, ci) => (
                    <td
                      key={ci}
                      className="border px-2 py-1 align-top"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
                    >
                      {renderChildren((cell as { children?: unknown[] }).children as never)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    default:
      return node.children ? renderChildren(node.children) : null
  }
}

export function Markdown({ content }: { content: string }) {
  const tree = parse(content)
  return <div className="markdown-body">{renderChildren(tree.children)}</div>
}
