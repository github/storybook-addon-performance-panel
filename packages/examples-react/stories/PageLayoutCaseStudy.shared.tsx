import styles from './PageLayoutCaseStudy.module.css'

// ---------------------------------------------------------------------------
// Shared complex child components simulating a PR "Files changed" view
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  {section: 'Changed files', items: ['PageLayout.tsx', 'Pane.tsx', 'usePaneResize.ts', 'PageLayout.module.css']},
  {section: 'Tests', items: ['PageLayout.test.tsx', 'Pane.test.tsx', 'usePaneResize.test.ts']},
  {section: 'Docs', items: ['PageLayout.mdx', 'CHANGELOG.md']},
]

/** Sidebar file tree — like the PR file tree nav in the pane. */
export function ComplexNav({itemMultiplier = 1}: {itemMultiplier?: number}) {
  const sections = itemMultiplier > 1 ? Array.from({length: itemMultiplier}, () => NAV_ITEMS).flat() : NAV_ITEMS
  return (
    <nav className={styles.navList}>
      {sections.map((sec, si) => (
        <div key={si}>
          <div className={styles.sectionHeader}>
            {sec.section}
            {itemMultiplier > 1 ? ` (${String(si + 1)})` : ''}
          </div>
          {sec.items.map((item, ii) => (
            <div key={ii} className={styles.navItem} data-selected={si === 0 && ii === 0 ? '' : undefined}>
              <span className={styles.navIcon} />
              <span className={styles.navFileName}>{item}</span>
              {/* Small +/- stat next to each file */}
              <span className={styles.navStat}>
                <span className={styles.navStatAdd}>+{3 + ((si * 7 + ii * 13) % 30)}</span>
                <span className={styles.navStatDel}>-{1 + ((si * 3 + ii * 11) % 15)}</span>
              </span>
            </div>
          ))}
        </div>
      ))}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Diff data — realistic code hunks for the content area
// ---------------------------------------------------------------------------

const FILE_ENTRIES = [
  {
    path: 'src/PageLayout/PageLayout.tsx',
    hunks: [
      {
        header: '@@ -42,8 +42,12 @@ export function PageLayout({ children })',
        lines: [
          {type: 'ctx', text: '  const paneRef = useRef<HTMLDivElement>(null)'},
          {type: 'ctx', text: '  const contentRef = useRef<HTMLDivElement>(null)'},
          {type: 'del', text: '  const [paneWidth, setPaneWidth] = useState(300)'},
          {type: 'add', text: '  const currentWidthRef = useRef(300)'},
          {type: 'add', text: '  const rafIdRef = useRef<number | null>(null)'},
          {type: 'add', text: '  const [displayWidth, setDisplayWidth] = useState(300)'},
          {type: 'ctx', text: '  const isDraggingRef = useRef(false)'},
          {type: 'ctx', text: ''},
        ],
      },
      {
        header: '@@ -67,6 +71,9 @@ export function PageLayout({ children })',
        lines: [
          {type: 'ctx', text: "    divider.setAttribute('data-dragging', 'true')"},
          {type: 'add', text: "    paneRef.current?.setAttribute('data-contained', 'true')"},
          {type: 'add', text: "    contentRef.current?.setAttribute('data-contained', 'true')"},
          {type: 'ctx', text: '    try {'},
          {type: 'ctx', text: '      divider.setPointerCapture(e.pointerId)'},
        ],
      },
    ],
  },
  {
    path: 'src/PageLayout/usePaneResize.ts',
    hunks: [
      {
        header: '@@ -15,7 +15,11 @@ export function usePaneResize(paneRef)',
        lines: [
          {type: 'ctx', text: '  const onMove = (e: PointerEvent) => {'},
          {type: 'del', text: '    const newWidth = e.clientX - rect.left'},
          {type: 'del', text: '    setPaneWidth(newWidth)'},
          {type: 'add', text: '    pendingXRef.current = e.clientX'},
          {type: 'add', text: '    rafIdRef.current ??= requestAnimationFrame(() => {'},
          {type: 'add', text: '      rafIdRef.current = null'},
          {type: 'add', text: '      const delta = pendingXRef.current! - dragStartXRef.current'},
          {type: 'add', text: '      paneRef.current!.style.width = `${clamped}px`'},
          {type: 'add', text: '    })'},
          {type: 'ctx', text: '  }'},
        ],
      },
    ],
  },
  {
    path: 'src/PageLayout/Pane.tsx',
    hunks: [
      {
        header: '@@ -8,5 +8,9 @@ export function Pane({ width, children })',
        lines: [
          {type: 'ctx', text: '  return ('},
          {type: 'del', text: '    <div className={styles.pane} style={{ width }}>'},
          {type: 'add', text: '    <div'},
          {type: 'add', text: '      ref={paneRef}'},
          {type: 'add', text: '      className={styles.pane}'},
          {type: 'add', text: '      style={{ width: initialWidth }}'},
          {type: 'add', text: '    >'},
          {type: 'ctx', text: '      {children}'},
          {type: 'ctx', text: '    </div>'},
        ],
      },
    ],
  },
  {
    path: 'src/PageLayout/PageLayout.module.css',
    hunks: [
      {
        header: '@@ -22,3 +22,11 @@ .pane {',
        lines: [
          {type: 'ctx', text: '  overflow-y: auto;'},
          {type: 'ctx', text: '  background: var(--bgColor-muted);'},
          {type: 'add', text: '}'},
          {type: 'add', text: ''},
          {type: 'add', text: '.pane[data-contained] {'},
          {type: 'add', text: '  contain: strict;'},
          {type: 'add', text: '  content-visibility: auto;'},
          {type: 'add', text: '}'},
          {type: 'add', text: ''},
          {type: 'add', text: '.content[data-contained] {'},
          {type: 'add', text: '  contain: strict;'},
          {type: 'add', text: '  content-visibility: auto;'},
        ],
      },
    ],
  },
  {
    path: 'src/PageLayout/__tests__/PageLayout.test.tsx',
    hunks: [
      {
        header: '@@ -1,6 +1,8 @@',
        lines: [
          {type: 'ctx', text: "import { render, screen } from '@testing-library/react'"},
          {type: 'add', text: "import userEvent from '@testing-library/user-event'"},
          {type: 'ctx', text: "import { PageLayout } from '../PageLayout'"},
          {type: 'ctx', text: ''},
          {type: 'del', text: "describe('PageLayout', () => {"},
          {type: 'add', text: "describe('PageLayout resize', () => {"},
          {type: 'ctx', text: "  it('renders pane and content', () => {"},
        ],
      },
      {
        header: '@@ -28,4 +30,18 @@',
        lines: [
          {type: 'ctx', text: '  })'},
          {type: 'add', text: ''},
          {type: 'add', text: "  it('does not trigger React re-renders during drag', async () => {"},
          {type: 'add', text: '    const renderSpy = vi.fn()'},
          {type: 'add', text: '    render(<PageLayout onRender={renderSpy} />)'},
          {type: 'add', text: "    const divider = screen.getByRole('separator')"},
          {type: 'add', text: '    await userEvent.pointer(['},
          {type: 'add', text: '      { target: divider, keys: "[MouseLeft>]", coords: { x: 300 } },'},
          {type: 'add', text: '      { coords: { x: 400 } },'},
          {type: 'add', text: '      { coords: { x: 500 } },'},
          {type: 'add', text: '      "[/MouseLeft]",'},
          {type: 'add', text: '    ])'},
          {type: 'add', text: '    // Only one render on pointerup, none during drag'},
          {type: 'add', text: '    expect(renderSpy).toHaveBeenCalledTimes(1)'},
          {type: 'ctx', text: '  })'},
          {type: 'ctx', text: '})'},
        ],
      },
    ],
  },
  {
    path: 'src/hooks/useContainment.ts',
    hunks: [
      {
        header: '@@ -0,0 +1,22 @@',
        lines: [
          {type: 'add', text: "import { useCallback } from 'react'"},
          {type: 'add', text: ''},
          {type: 'add', text: 'export function useContainment('},
          {type: 'add', text: '  ...refs: React.RefObject<HTMLElement | null>[]'},
          {type: 'add', text: ') {'},
          {type: 'add', text: '  const apply = useCallback(() => {'},
          {type: 'add', text: '    for (const ref of refs) {'},
          {type: 'add', text: "      ref.current?.setAttribute('data-contained', 'true')"},
          {type: 'add', text: '    }'},
          {type: 'add', text: '  }, [refs])'},
          {type: 'add', text: ''},
          {type: 'add', text: '  const remove = useCallback(() => {'},
          {type: 'add', text: '    for (const ref of refs) {'},
          {type: 'add', text: "      ref.current?.removeAttribute('data-contained')"},
          {type: 'add', text: '    }'},
          {type: 'add', text: '  }, [refs])'},
          {type: 'add', text: ''},
          {type: 'add', text: '  return { apply, remove }'},
          {type: 'add', text: '}'},
        ],
      },
    ],
  },
  {
    path: 'src/utils/rafScheduler.ts',
    hunks: [
      {
        header: '@@ -0,0 +1,18 @@',
        lines: [
          {type: 'add', text: 'export function createRafScheduler() {'},
          {type: 'add', text: '  let rafId: number | null = null'},
          {type: 'add', text: '  let pending: (() => void) | null = null'},
          {type: 'add', text: ''},
          {type: 'add', text: '  function schedule(fn: () => void) {'},
          {type: 'add', text: '    pending = fn'},
          {type: 'add', text: '    rafId ??= requestAnimationFrame(() => {'},
          {type: 'add', text: '      rafId = null'},
          {type: 'add', text: '      pending?.()'},
          {type: 'add', text: '      pending = null'},
          {type: 'add', text: '    })'},
          {type: 'add', text: '  }'},
          {type: 'add', text: ''},
          {type: 'add', text: '  function cancel() {'},
          {type: 'add', text: '    if (rafId !== null) cancelAnimationFrame(rafId)'},
          {type: 'add', text: '    rafId = null'},
          {type: 'add', text: '    pending = null'},
          {type: 'add', text: '  }'},
          {type: 'add', text: ''},
          {type: 'add', text: '  return { schedule, cancel }'},
          {type: 'add', text: '}'},
        ],
      },
    ],
  },
]

/** Content area — PR "Files changed" diff view with file headers and diff hunks. */
export function ContentFeed({count = 30, heavy = false}: {count?: number; heavy?: boolean}) {
  // Build the file list by cycling through FILE_ENTRIES
  const files = Array.from({length: count}, (_, i) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const entry = FILE_ENTRIES[i % FILE_ENTRIES.length]!
    // For counts beyond the base set, generate variant paths
    const suffix = i >= FILE_ENTRIES.length ? `-${String(Math.floor(i / FILE_ENTRIES.length))}` : ''
    const path = suffix ? entry.path.replace(/(\.\w+)$/, `${suffix}$1`) : entry.path
    return {path, hunks: entry.hunks, index: i}
  })

  return (
    <div className={styles.diffView}>
      {/* PR diff summary bar */}
      <div className={styles.diffSummary}>
        <span>
          Showing <strong>{count}</strong> changed files
        </span>
        <span className={styles.diffStat}>
          <span className={styles.diffStatAdd}>
            +
            {files.reduce(
              (s, f) => s + f.hunks.reduce((hs, h) => hs + h.lines.filter(l => l.type === 'add').length, 0),
              0,
            )}
          </span>
          <span className={styles.diffStatDel}>
            -
            {files.reduce(
              (s, f) => s + f.hunks.reduce((hs, h) => hs + h.lines.filter(l => l.type === 'del').length, 0),
              0,
            )}
          </span>
        </span>
      </div>

      {files.map(file => {
        const adds = file.hunks.reduce((s, h) => s + h.lines.filter(l => l.type === 'add').length, 0)
        const dels = file.hunks.reduce((s, h) => s + h.lines.filter(l => l.type === 'del').length, 0)
        return (
          <div key={file.index} className={styles.diffFile}>
            {/* File header */}
            <div className={styles.diffFileHeader}>
              <span className={styles.diffFileIcon}>{'▾'}</span>
              <span className={styles.diffFilePath}>{file.path}</span>
              <span className={styles.diffFileStat}>
                <span className={styles.diffStatAdd}>+{adds}</span>
                <span className={styles.diffStatDel}>-{dels}</span>
              </span>
            </div>

            {/* Diff hunks */}
            <div className={styles.diffHunks}>
              {file.hunks.map((hunk, hi) => {
                let oldLine = parseInt(/@@ -(\d+)/.exec(hunk.header)?.[1] ?? '1', 10)
                let newLine = parseInt(/\+(\d+)/.exec(hunk.header)?.[1] ?? '1', 10)
                return (
                  <div key={hi}>
                    <div className={styles.diffHunkHeader}>{hunk.header}</div>
                    {hunk.lines.map((line, li) => {
                      const oldNum = line.type === 'add' ? '' : String(oldLine)
                      const newNum = line.type === 'del' ? '' : String(newLine)
                      if (line.type !== 'add') oldLine++
                      if (line.type !== 'del') newLine++
                      return (
                        <div key={li} className={styles.diffLine} data-type={line.type}>
                          <span className={styles.diffLineNum}>{oldNum}</span>
                          <span className={styles.diffLineNum}>{newNum}</span>
                          <span className={styles.diffLineSign}>
                            {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                          </span>
                          <span className={styles.diffLineText}>{line.text}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Heavy mode: add inline review comments on some files */}
            {heavy && file.index % 3 === 0 && (
              <div className={styles.diffInlineComment}>
                <div className={styles.diffCommentHeader}>
                  <span className={styles.diffCommentAvatar} />
                  <strong>reviewer-{file.index % 5}</strong>
                  <span className={styles.diffCommentTime}>{1 + (file.index % 8)}h ago</span>
                </div>
                <div className={styles.diffCommentBody}>
                  {
                    [
                      'This refactor looks good — the rAF coalescing should eliminate the batched pointermove issue.',
                      "Can we add a test that asserts zero React renders during drag? We don't want this to regress.",
                      'The `contain: strict` approach is smart. Should we also add `will-change: width` for the compositor?',
                      'Confirmed this resolves the 600ms forced reflow on mount. Nice catch.',
                      'Nit: consider extracting the breakpoint lookup into a constant so it matches the CSS.',
                    ][file.index % 5]
                  }
                </div>
                {file.index % 6 === 0 && (
                  <div className={styles.diffCommentReply}>
                    <div className={styles.diffCommentHeader}>
                      <span className={styles.diffCommentAvatar} />
                      <strong>author</strong>
                      <span className={styles.diffCommentTime}>30m ago</span>
                    </div>
                    <div className={styles.diffCommentBody}>
                      Good call — added the test in the latest push. CI is green now.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export {styles}
