import 'katex/dist/katex.min.css'
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
