import styles from './PageLayoutCaseStudy.module.css'

// ---------------------------------------------------------------------------
// Shared complex child components simulating real PageLayout content
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  {section: 'Repository', items: ['Code', 'Issues', 'Pull requests', 'Actions', 'Projects', 'Wiki', 'Security']},
  {section: 'Account', items: ['Profile', 'Repositories', 'Packages', 'Stars', 'Settings']},
  {section: 'Explore', items: ['Topics', 'Trending', 'Collections', 'Events', 'Sponsors']},
]

const AVATARS = [
  'hsl(200, 70%, 60%)',
  'hsl(140, 60%, 50%)',
  'hsl(30, 80%, 55%)',
  'hsl(280, 50%, 60%)',
  'hsl(350, 65%, 55%)',
  'hsl(60, 70%, 50%)',
]

/** Sidebar nav complex enough to cause real layout cost when resized. */
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
              {item}
              {ii % 3 === 0 && <span className={styles.navBadge}>{si + ii + 1}</span>}
            </div>
          ))}
        </div>
      ))}
    </nav>
  )
}

/** Content feed with enough DOM to make relayout visible in metrics. */
export function ContentFeed({count = 30, heavy = false}: {count?: number; heavy?: boolean}) {
  return (
    <div>
      {Array.from({length: count}, (_, i) =>
        heavy ? (
          <HeavyContentItem key={i} index={i} />
        ) : (
          <div key={i} className={styles.contentItem}>
            <div className={styles.contentItemHeader}>
              <span className={styles.avatar} style={{background: AVATARS[i % AVATARS.length]}} />
              <span className={styles.contentItemTitle}>Issue #{1000 + i}: Performance regression in layout</span>
            </div>
            <div className={styles.contentItemBody}>
              When resizing the sidebar with many children, the browser spends significant time recalculating layout.
              This is particularly noticeable on pages with deep DOM trees and complex CSS.
            </div>
            <div className={styles.contentItemMeta}>
              <span className={styles.label} style={{borderColor: `hsl(${String((i * 47) % 360)}, 50%, 60%)`}}>
                bug
              </span>
              <span>opened {1 + (i % 14)} days ago</span>
              <span>{i % 20} comments</span>
            </div>
          </div>
        ),
      )}
    </div>
  )
}

const COMMENT_BODIES = [
  'I think this is caused by the layout recalculation on resize. We should profile this.',
  'Confirmed — seeing 200ms+ layout shifts in Chrome DevTools when dragging the pane.',
  'Could we use CSS containment here? That should isolate the subtree from relayout.',
  'LGTM, but we should add a performance test to prevent regression.',
  "The reflow is coming from getComputedStyle() interleaved with writes. Let's batch reads.",
]

const FILE_PATHS = [
  'src/PageLayout/PageLayout.tsx',
  'src/PageLayout/Pane.tsx',
  'src/PageLayout/usePaneResize.ts',
  'src/PageLayout/PageLayout.module.css',
  'src/PageLayout/__tests__/PageLayout.test.tsx',
  'src/hooks/useContainment.ts',
  'src/utils/rafScheduler.ts',
]

/**
 * Heavy content card — simulates a real PR page with comment threads,
 * file change lists, review bars, and many labels. Each item produces
 * ~40-60 DOM nodes to make layout cost highly visible.
 */
export function HeavyContentItem({index}: {index: number}) {
  const commentCount = 2 + (index % 3)
  const fileCount = 3 + (index % 5)
  const labelCount = 4 + (index % 5)
  const reviewerCount = 2 + (index % 4)

  return (
    <div className={styles.contentItem}>
      <div className={styles.contentItemHeader}>
        <span className={styles.avatar} style={{background: AVATARS[index % AVATARS.length]}} />
        <span className={styles.contentItemTitle}>PR #{2000 + index}: Complex diff with inline suggestions</span>
      </div>
      <div className={styles.contentItemBody}>
        <span>
          File changes: <strong>{fileCount}</strong>
        </span>
        {' · '}
        <span>
          Additions: <span style={{color: 'var(--fgColor-success)'}}>{10 + (index % 50)}</span>
        </span>
        {' · '}
        <span>
          Deletions: <span style={{color: 'var(--fgColor-danger)'}}>{5 + (index % 30)}</span>
        </span>
        <div style={{marginTop: 'var(--base-size-4)'}}>
          {Array.from({length: labelCount}, (_, li) => (
            <span
              key={li}
              className={styles.label}
              style={{
                borderColor: `hsl(${String((index * 47 + li * 60) % 360)}, 45%, 55%)`,
                marginRight: 'var(--base-size-4)',
                marginBottom: 'var(--base-size-4)',
                display: 'inline-block',
              }}
            >
              {['review', 'approved', 'changes-requested', 'draft', 'ready', 'blocked', 'needs-triage', 'P1'][li % 8]}
            </span>
          ))}
        </div>
      </div>

      {/* File change list */}
      <div className={styles.fileList}>
        {Array.from({length: fileCount}, (_, fi) => {
          const adds = 5 + ((index * 7 + fi * 13) % 40)
          const dels = 2 + ((index * 3 + fi * 11) % 25)
          return (
            <div key={fi} className={styles.fileRow}>
              <span className={styles.fileAdd}>+{adds}</span>
              <span className={styles.fileDel}>-{dels}</span>
              <span>{FILE_PATHS[(index + fi) % FILE_PATHS.length]}</span>
            </div>
          )
        })}
      </div>

      {/* Review status */}
      <div className={styles.reviewBar}>
        {Array.from({length: reviewerCount}, (_, ri) => (
          <span
            key={ri}
            className={styles.reviewDot}
            style={{background: ri === 0 ? 'var(--bgColor-success-emphasis)' : 'var(--bgColor-attention-emphasis)'}}
            title={ri === 0 ? 'Approved' : 'Pending'}
          />
        ))}
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{width: `${String(30 + (index % 70))}%`}} />
        </div>
        <span style={{fontSize: '11px', color: 'var(--fgColor-muted)'}}>
          {reviewerCount} reviewers · CI {index % 3 === 0 ? 'passing' : 'pending'}
        </span>
      </div>

      {/* Comment thread */}
      <div className={styles.commentThread}>
        {Array.from({length: commentCount}, (_, ci) => (
          <div key={ci} className={styles.comment}>
            <span className={styles.commentAuthor}>reviewer-{(index + ci) % 6} </span>
            <span className={styles.commentTime}>{1 + ci}h ago</span>
            <div>{COMMENT_BODIES[(index + ci) % COMMENT_BODIES.length]}</div>
          </div>
        ))}
      </div>

      <div className={styles.contentItemMeta}>
        <span>opened {1 + (index % 14)} days ago</span>
        <span>{index % 20} comments</span>
        <span>{reviewerCount} reviewers</span>
      </div>
    </div>
  )
}

export {styles}
