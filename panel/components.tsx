import {styled} from 'storybook/theming'
/**
 * Styled components using Storybook's theming system.
 * All styles adapt to Storybook's light/dark theme automatically.
 *
 * Layout structure:
 * - PanelWrapper: Flex container (content + sidebar)
 * - ContentArea: Scrollable grid of metric sections
 * - SideToolbar: Thin vertical strip with reset button
 * - SectionsGrid: Auto-fit grid of Section cards
 */

/** Root container - horizontal flex with content area and sidebar */
export const PanelWrapper = styled.div(({theme}) => ({
  display: 'flex',
  fontFamily: theme.typography.fonts.mono,
  fontSize: '11px',
  lineHeight: 1.4,
  color: theme.color.defaultText,
  height: '100%',
  background: theme.background.content,
}))

export const ContentArea = styled.div({
  flex: 1,
  overflow: 'auto',
  padding: '4px',
})

export const SideToolbar = styled.div(({theme}) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  padding: '4px',
  borderLeft: `1px solid ${theme.appBorderColor}`,
  background: theme.barBg,
}))

export const SectionsGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '4px',
})

export const Section = styled.section(({theme}) => ({
  background: theme.background.app,
  borderRadius: theme.appBorderRadius,
  border: `1px solid ${theme.appBorderColor}`,
}))

export const SectionHeader = styled.header(({theme}) => ({
  padding: '4px 8px',
  background: theme.barBg,
  borderBottom: `1px solid ${theme.appBorderColor}`,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
}))

export const SectionTitle = styled.h3(({theme}) => ({
  margin: 0,
  fontSize: '10px',
  fontWeight: theme.typography.weight.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: theme.color.defaultText,
}))

export const SectionIcon = styled.span({
  fontSize: '12px',
})

export const MetricsList = styled.dl({
  margin: 0,
  padding: '2px 0',
})

/**
 * Container for a single metric (dt + one or more dd elements).
 * Uses CSS grid: label on left, values stacked on right.
 * Fixed heights prevent layout shift when values/details appear.
 */
export const MetricItem = styled.div(({theme}) => ({
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  alignItems: 'center',
  gap: '1px 6px',
  padding: '2px 8px',
  minHeight: '20px',
  borderBottom: `1px solid ${theme.appBorderColor}`,
  position: 'relative',
  '&:last-child': {
    borderBottom: 'none',
  },
}))

/** Variant of MetricItem that reserves space for a detail row */
export const MetricItemWithDetail = styled(MetricItem)({
  minHeight: '36px', // Reserve space for both rows
  alignItems: 'start',
})

export const MetricLabel = styled.dt(({theme}) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '10px',
  color: theme.color.mediumdark,
  margin: 0,
  gridColumn: '1',
  gridRow: '1 / -1', // Span all rows
  alignSelf: 'center',
  minHeight: '16px',
}))

/** Primary metric value - first dd element */
export const MetricValue = styled.dd(({theme}) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '6px',
  fontSize: '11px',
  fontWeight: theme.typography.weight.bold,
  fontFamily: theme.typography.fonts.mono,
  color: theme.color.defaultText,
  margin: 0,
  textAlign: 'right',
  gridColumn: '2',
  minWidth: '60px', // Prevent layout shift when values appear
  minHeight: '16px',
}))

/** Secondary detail value - additional dd element for supplementary info */
export const DetailValue = styled.dd(({theme}) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '4px',
  fontSize: '9px',
  fontWeight: 'normal',
  fontFamily: theme.typography.fonts.mono,
  color: theme.color.mediumdark,
  margin: 0,
  textAlign: 'right',
  gridColumn: '2',
  flexWrap: 'wrap',
  minHeight: '14px', // Fixed height prevents shift
  minWidth: '130px', // Reserve space for timing breakdown
}))

export const SecondaryValue = styled.span(({theme}) => ({
  fontSize: '10px',
  fontWeight: 'normal',
  color: theme.color.mediumdark,
}))

export const InfoIcon = styled.button(({theme}) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '11px',
  height: '11px',
  fontSize: '8px',
  fontWeight: 600,
  fontStyle: 'italic',
  fontFamily: 'Georgia, serif',
  borderRadius: '50%',
  border: `1px solid ${theme.color.mediumdark}`,
  color: theme.color.mediumdark,
  background: 'transparent',
  padding: 0,
  userSelect: 'none',
  lineHeight: 1,
  cursor: 'help',
  '&:focus': {
    outline: 'none',
    boxShadow: `0 0 0 1px ${theme.color.secondary}`,
  },
  '&:focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 2px ${theme.color.secondary}`,
  },
}))

export const SparklineContainer = styled.div({
  display: 'flex',
  alignItems: 'center',
  height: '16px',
})

/** Container for sparkline when displayed on its own row above metric value */
export const SparklineRow = styled.div({
  gridColumn: '1 / -1',
  display: 'flex',
  justifyContent: 'flex-end',
  paddingBottom: '1px',
})

export const EmptyState = styled.div(({theme}) => ({
  padding: '24px',
  textAlign: 'center',
  color: theme.color.mediumdark,
}))

export const EmptyStateTitle = styled.p(({theme}) => ({
  fontSize: '12px',
  color: theme.color.defaultText,
  marginBottom: '8px',
}))

export const EmptyStateSubtitle = styled.p(({theme}) => ({
  fontSize: '10px',
  color: theme.color.mediumdark,
  opacity: 0.7,
  margin: 0,
}))

export const EmptyStateHint = styled.p(({theme}) => ({
  fontSize: '10px',
  color: theme.color.mediumdark,
  margin: 0,
}))

export const NoDataHint = styled(SecondaryValue)(() => ({
  fontStyle: 'italic',
}))

/** Clickable button to inspect an element in the preview */
export const InspectButton = styled.button(({theme}) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1px 4px',
  fontSize: '9px',
  fontFamily: theme.typography.fonts.mono,
  borderRadius: '3px',
  border: `1px solid ${theme.color.mediumdark}`,
  color: theme.color.mediumdark,
  background: 'transparent',
  cursor: 'pointer',
  marginLeft: '4px',
  transition: 'all 0.15s ease',
  '&:hover': {
    background: theme.color.secondary,
    borderColor: theme.color.secondary,
    color: theme.color.lightest,
  },
  '&:focus': {
    outline: 'none',
    boxShadow: `0 0 0 1px ${theme.color.secondary}`,
  },
  '&:active': {
    transform: 'scale(0.95)',
  },
}))

/** Web Vital badge - highlighted indicator for Core Web Vitals */
export const WebVitalBadge = styled.span(() => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1px',
  padding: '1px 4px',
  fontSize: '7px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  borderRadius: '3px',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: '#fff',
  marginLeft: '4px',
  boxShadow: '0 1px 2px rgba(102, 126, 234, 0.3)',
  '&::before': {
    content: '"⚡"',
    fontSize: '7px',
  },
}))

/** Container for interaction timing breakdown with labeled phases */
export const TimingBreakdown = styled.span(({theme}) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1px',
  fontSize: '8px',
  fontFamily: theme.typography.fonts.mono,
}))

/** Individual phase in timing breakdown */
export const TimingPhase = styled.span<{phase: 'delay' | 'process' | 'paint'}>(({theme, phase}) => {
  const colors = {
    delay: theme.color.warning,
    process: theme.color.secondary,
    paint: theme.color.positive,
  }
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1px',
    padding: '0px 2px',
    borderRadius: '2px',
    background: `${colors[phase]}22`,
    color: colors[phase],
    minWidth: '36px', // Prevent layout shift
    '& > abbr': {
      textDecoration: 'none',
      fontWeight: 600,
      fontSize: '7px',
      textTransform: 'uppercase',
      marginRight: '1px',
      opacity: 0.8,
    },
    // Add ms unit after the number
    '&::after': {
      content: '"ms"',
      fontSize: '6px',
      opacity: 0.7,
      marginLeft: '1px',
    },
  }
})

/** Arrow between timing phases */
export const TimingArrow = styled.span(({theme}) => ({
  color: theme.color.mediumdark,
  fontSize: '7px',
  padding: '0 1px',
}))

// ============================================================================
// Profiler Tab Components
// ============================================================================

/** Container for profiler tabs above React section */
export const ProfilerTabsContainer = styled.div(({theme}) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  padding: '4px 8px',
  borderBottom: `1px solid ${theme.appBorderColor}`,
  background: theme.barBg,
  flexWrap: 'wrap',
}))

/** Individual profiler tab */
export const ProfilerTab = styled.button<{isSelected: boolean}>(({theme, isSelected}) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '3px 8px',
  fontSize: '9px',
  fontFamily: theme.typography.fonts.mono,
  fontWeight: isSelected ? theme.typography.weight.bold : 'normal',
  borderRadius: '3px',
  border: isSelected ? `1px solid ${theme.color.secondary}` : `1px solid ${theme.appBorderColor}`,
  color: isSelected ? theme.color.secondary : theme.color.mediumdark,
  background: isSelected ? `${theme.color.secondary}11` : 'transparent',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  '&:hover': {
    borderColor: theme.color.secondary,
    color: theme.color.secondary,
    background: `${theme.color.secondary}08`,
  },
  '&:focus': {
    outline: 'none',
    boxShadow: `0 0 0 1px ${theme.color.secondary}`,
  },
}))

/** Label for profiler tabs header */
export const ProfilerTabsLabel = styled.span(({theme}) => ({
  fontSize: '8px',
  fontWeight: theme.typography.weight.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: theme.color.mediumdark,
  marginRight: '4px',
}))

/** Badge showing number of profilers */
export const ProfilerCountBadge = styled.span(({theme}) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '16px',
  height: '14px',
  padding: '0 4px',
  fontSize: '9px',
  fontWeight: theme.typography.weight.bold,
  borderRadius: '7px',
  background: theme.color.secondary,
  color: theme.color.lightest,
}))

/** Special tab for aggregated/all profilers view */
export const AggregatedTab = styled(ProfilerTab)({
  fontStyle: 'italic',
})
