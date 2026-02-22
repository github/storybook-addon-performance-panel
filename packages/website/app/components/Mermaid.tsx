import {useEffect, useId, useRef, useState} from 'react'

const nextId = 0

/**
 * Renders a Mermaid diagram. Loads the mermaid library lazily on the client
 * and renders to SVG inside the container.
 */
export function Mermaid({chart}: {chart: string}) {
  const [svg, setSvg] = useState<string | null>(null)
  const id = useId()

  useEffect(() => {
    let cancelled = false
    import('mermaid')
      .then(async mod => {
        if (cancelled) return
        const mermaid = mod.default
        mermaid.initialize({
          startOnLoad: false,
          theme: document.documentElement.getAttribute('data-color-mode') === 'dark' ? 'dark' : 'default',
          fontFamily: "'Mona Sans', sans-serif",
        })
        const {svg: rendered} = await mermaid.render(`mermaid-${id}`, chart.trim())
        if (!cancelled) setSvg(rendered)
      })
      .catch(err => {
        console.error('Mermaid render failed:', err)
      })
    return () => {
      cancelled = true
    }
  }, [chart, id])

  return (
    <div
      className="mermaid-diagram"
      role="img"
      aria-label="Architecture diagram"
      {...(svg ? {dangerouslySetInnerHTML: {__html: svg}} : undefined)}
    >
      {svg ? undefined : <pre>{chart}</pre>}
    </div>
  )
}
