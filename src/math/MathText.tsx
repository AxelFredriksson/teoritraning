import 'katex/dist/katex.min.css'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

const katexOptions = { throwOnError: false, strict: false }

export function MathText({ md }: { md: string }) {
  return (
    <div className="math-text">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, katexOptions]]}>
        {md}
      </ReactMarkdown>
    </div>
  )
}

const inlineComponents = { p: ({ children }: { children?: ReactNode }) => <>{children}</> }

/** Inline variant for headings, titles and list items: no block wrapper or paragraphs. */
export function MathInline({ md }: { md: string }) {
  return (
    <span className="math-inline">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, katexOptions]]} components={inlineComponents}>
        {md}
      </ReactMarkdown>
    </span>
  )
}
