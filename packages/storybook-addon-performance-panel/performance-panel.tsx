/**
 * @fileoverview Performance Monitor Addon - Panel Component
 *
 * This file implements the manager-side UI panel for the Performance Monitor
 * Storybook addon. It displays real-time metrics received from the preview
 * via the Storybook channel API.
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                        Manager (Addon Panel)                             │
 * │  ┌─────────────────────────────────────────────────────────────────┐    │
 * │  │  PerformancePanel                                                │    │
 * │  │  ├─ ContentArea (scrollable grid)                               │    │
 * │  │  │  ├─ FrameTimingSection    [FPS, Frame Time, Dropped]         │    │
 * │  │  │  ├─ InputSection          [Latency, INP, Jitter]             │    │
 * │  │  │  ├─ MainThreadSection     [Long Tasks, TBT, Thrashing]       │    │
 * │  │  │  ├─ LoAFSection           [LoAF Count, Blocking, Scripts]    │    │
 * │  │  │  ├─ ReactSection          [Mounts, Updates, Cascades, P95]   │    │
 * │  │  │  ├─ LayoutSection         [CLS, Reflows, DOM Mutations]      │    │
 * │  │  │  └─ MemorySection         [Heap, Delta, Peak, GC]            │    │
 * │  │  └─ SideToolbar (reset button)                                  │    │
 * │  └─────────────────────────────────────────────────────────────────┘    │
 * └─────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Metric Thresholds
 *
 * Metrics are color-coded based on Web Vitals standards:
 * - 🟢 Green: Good performance (meets targets)
 * - 🟡 Yellow: Needs improvement (may cause issues)
 * - 🔴 Red: Poor performance (likely causing issues)
 *
 * ## Communication
 *
 * Uses Storybook's channel API to receive metrics:
 * - `PERF_EVENTS.METRICS_UPDATE` - Receives metrics from decorator
 * - `PERF_EVENTS.RESET` - Emits to reset all metrics
 * - `PERF_EVENTS.REQUEST_METRICS` - Requests immediate metrics update
 *
 * @module performance-panel
 * @see {@link ./performance-decorator.tsx} - The metrics collector
 * @see {@link ./performance-types.ts} - Shared types and constants
 */

import {SyncIcon} from '@storybook/icons'
import React from 'react'
import {AddonPanel, Badge, Button, Code, Popover, WithTooltip} from 'storybook/internal/components'
import {useChannel, useStorybookState} from 'storybook/manager-api'
import {useTheme} from 'storybook/theming'

import {computeP95} from './collectors/utils'
import {
  ContentArea,
  DetailValue,
  EmptyState,
  EmptyStateHint,
  EmptyStateSubtitle,
  EmptyStateTitle,
  InfoIcon,
  InspectButton,
  MetricItem,
  MetricItemWithDetail,
  MetricLabel,
  MetricsList,
  MetricValue,
  NoDataHint,
  PanelWrapper,
  SecondaryValue,
  Section,
  SectionHeader,
  SectionIcon,
  SectionsGrid,
  SectionTitle,
  SideToolbar,
  SparklineContainer,
  SparklineRow,
  TimingArrow,
  TimingBreakdown,
  TimingPhase,
  WebVitalBadge,
} from './panel/components'
import {formatMb, formatMs, formatNumber, formatPercent, formatRate, formatScore} from './panel/formatters'
import {
  DEFAULT_METRICS,
  getStatusVariant,
  getZeroIsGoodStatus,
  type InteractionInfo,
  PERF_EVENTS,
  type PerformanceMetrics,
  type ReactMetrics,
  type StatusVariant,
  THRESHOLDS,
} from './performance-types'

// ============================================================================
// Profiler Types
// ============================================================================

/**
 * Information about a registered profiler.
 * The profiler ID serves as both identifier and display label.
 */
export interface ProfilerInfo {
  id: string
  metrics: ReactMetrics
  lastUpdated: number
}

// ============================================================================
// Status Badge Helper
// ============================================================================

/** Maps internal status variants to Storybook Badge status values */
type BadgeStatus = 'positive' | 'negative' | 'neutral' | 'warning'

/** Static mapping - defined once outside component to avoid recreation */
const VARIANT_TO_BADGE_STATUS: Record<StatusVariant, BadgeStatus> = {
  success: 'positive',
  warning: 'warning',
  error: 'negative',
  neutral: 'neutral',
}

/** Status badge component using Storybook's Badge */
const StatusBadge = React.memo(function StatusBadge({
  variant,
  children,
}: {
  variant: StatusVariant
  children: React.ReactNode
}) {
  return <Badge status={VARIANT_TO_BADGE_STATUS[variant]}>{children}</Badge>
})

// ============================================================================
// Sparkline Component
// ============================================================================

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  goodThreshold?: number
  badThreshold?: number
  higherIsBetter?: boolean
}

const Sparkline = React.memo(function Sparkline({
  data,
  width = 80,
  height = 20,
  goodThreshold,
  badThreshold,
  higherIsBetter = false,
}: SparklineProps) {
  const theme = useTheme()

  // Memoize expensive path calculations
  const {pathData, min, max, currentValue, getY} = React.useMemo(() => {
    if (data.length < 2) {
      return {pathData: '', min: 0, max: 0, currentValue: 0, getY: () => height / 2}
    }

    const padding = 2
    const innerWidth = width - padding * 2
    const innerHeight = height - padding * 2

    const minVal = Math.min(...data)
    const maxVal = Math.max(...data)
    const range = maxVal - minVal || 1

    const getX = (index: number) => padding + (index / (data.length - 1)) * innerWidth
    const getYFn = (value: number) => padding + innerHeight - ((value - minVal) / range) * innerHeight

    const path = data
      .map((value, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getYFn(value).toFixed(1)}`)
      .join(' ')

    return {
      pathData: path,
      min: minVal,
      max: maxVal,
      currentValue: data[data.length - 1] ?? NaN,
      getY: getYFn,
    }
  }, [data, width, height])

  if (data.length < 2) {
    return (
      <SparklineContainer>
        <svg width={width} height={height} aria-hidden="true">
          <line
            x1={0}
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke={theme.color.medium}
            strokeWidth={1}
            strokeDasharray="3,3"
          />
        </svg>
      </SparklineContainer>
    )
  }

  const padding = 2
  const getX = (index: number) => padding + (index / (data.length - 1)) * (width - padding * 2)

  let lineColor = theme.color.secondary
  if (goodThreshold !== undefined) {
    const isGood = higherIsBetter ? currentValue >= goodThreshold : currentValue <= goodThreshold
    const isBad =
      badThreshold !== undefined && (higherIsBetter ? currentValue < badThreshold : currentValue > badThreshold)

    if (isBad) {
      lineColor = theme.color.negative
    } else if (isGood) {
      lineColor = theme.color.positive
    } else {
      lineColor = theme.color.warning
    }
  }

  return (
    <SparklineContainer>
      <svg width={width} height={height} aria-hidden="true">
        {/* Threshold line */}
        {goodThreshold !== undefined && goodThreshold >= min && goodThreshold <= max && (
          <line
            x1={padding}
            y1={getY(goodThreshold)}
            x2={width - padding}
            y2={getY(goodThreshold)}
            stroke={theme.color.medium}
            strokeWidth={1}
            strokeDasharray="2,2"
            opacity={0.5}
          />
        )}
        {/* Data line */}
        <path d={pathData} fill="none" stroke={lineColor} strokeWidth={1.5} strokeLinecap="round" />
        {/* Current value dot */}
        <circle cx={getX(data.length - 1)} cy={getY(currentValue)} r={2.5} fill={lineColor} />
      </svg>
    </SparklineContainer>
  )
})

// ============================================================================
// Helper Functions (aliases for imported utilities)
// ============================================================================

/** Alias for getStatusVariant from performance-types */
const getStatus = getStatusVariant

/** Alias for getZeroIsGoodStatus from performance-types */
const getZeroStatus = getZeroIsGoodStatus

// ============================================================================
// Metric Components
// ============================================================================

interface MetricProps {
  label: string
  tooltip?: string
  sparkline?: React.ReactNode
  /** Whether this is a Core Web Vital metric */
  isWebVital?: boolean
  /** Secondary detail row content (full width, below main value) */
  detail?: React.ReactNode
  /** Reserve space for detail row even when empty (prevents layout shift) */
  reserveDetailSpace?: boolean
  children: React.ReactNode
}

const Metric = React.memo(function Metric({
  label,
  tooltip,
  sparkline,
  isWebVital,
  detail,
  reserveDetailSpace,
  children,
}: MetricProps) {
  const hasDetail = detail != null || reserveDetailSpace === true
  const Container = hasDetail ? MetricItemWithDetail : MetricItem

  return (
    <Container>
      {sparkline ? <SparklineRow>{sparkline}</SparklineRow> : null}
      <MetricLabel>
        {label}
        {isWebVital && <WebVitalBadge>Vital</WebVitalBadge>}
        {tooltip && (
          <WithTooltip tooltip={<Popover hasChrome={false}>{tooltip}</Popover>} closeOnOutsideClick>
            <InfoIcon type="button" aria-label={`Info about ${label}`}>
              i
            </InfoIcon>
          </WithTooltip>
        )}
      </MetricLabel>
      <MetricValue>{children}</MetricValue>
      {hasDetail ? <DetailValue>{detail}</DetailValue> : null}
    </Container>
  )
})

// ============================================================================
// Section Components
// ============================================================================

interface SectionProps {
  icon: string
  title: string
  children: React.ReactNode
}

const MetricsSection = React.memo(function MetricsSection({icon, title, children}: SectionProps) {
  return (
    <Section>
      <SectionHeader>
        <SectionIcon>{icon}</SectionIcon>
        <SectionTitle>{title}</SectionTitle>
      </SectionHeader>
      <MetricsList>{children}</MetricsList>
    </Section>
  )
})

// ============================================================================
// Section Components
// ============================================================================

/**
 * Frame Timing Section - Core rendering performance metrics.
 *
 * Displays:
 * - FPS: Frames per second with sparkline trend
 * - Frame Time: Average/max frame duration
 * - Dropped Frames: Count of frames exceeding 2× budget
 * - Frame Jitter: Sudden spikes in frame time
 *
 * @component
 */
type FrameTimingSectionProps = Pick<
  PerformanceMetrics,
  | 'fps'
  | 'fpsHistory'
  | 'frameTime'
  | 'maxFrameTime'
  | 'frameTimeHistory'
  | 'droppedFrames'
  | 'frameJitter'
  | 'frameStability'
  | 'paintTime'
  | 'maxPaintTime'
  | 'paintJitter'
>

const FrameTimingSection = React.memo(function FrameTimingSection({
  fps,
  fpsHistory,
  frameTime,
  maxFrameTime,
  frameTimeHistory,
  droppedFrames,
  frameJitter,
  frameStability,
  paintTime,
  maxPaintTime,
  paintJitter,
}: FrameTimingSectionProps) {
  const fpsStatus = getStatus(fps, THRESHOLDS.FPS_GOOD, THRESHOLDS.FPS_WARNING, true)
  const droppedStatus =
    droppedFrames > THRESHOLDS.DROPPED_FRAMES_WARNING ? 'error' : droppedFrames > 0 ? 'warning' : 'success'
  const frameJitterStatus = getZeroStatus(frameJitter)
  const stabilityStatus = frameStability >= 90 ? 'success' : frameStability >= 70 ? 'warning' : 'error'
  const paintJitterStatus = getZeroStatus(paintJitter)

  return (
    <MetricsSection icon="📊" title="Frame Timing">
      <Metric
        label="FPS"
        tooltip="Frames per second. Target: 60fps. Below 30 causes visible stuttering."
        sparkline={
          <Sparkline
            data={fpsHistory}
            goodThreshold={THRESHOLDS.FPS_GOOD}
            badThreshold={THRESHOLDS.FPS_WARNING}
            higherIsBetter
          />
        }
      >
        <StatusBadge variant={fpsStatus}>{fps}</StatusBadge>
      </Metric>

      <Metric
        label="Frame Time"
        tooltip="Average time per frame. Target: ≤16.67ms for 60fps."
        sparkline={
          <Sparkline
            data={frameTimeHistory}
            goodThreshold={THRESHOLDS.FRAME_TIME_TARGET}
            badThreshold={THRESHOLDS.FRAME_TIME_WARNING}
          />
        }
        detail={<>max {formatMs(maxFrameTime)}</>}
      >
        {formatMs(frameTime)}
      </Metric>

      <Metric label="Dropped Frames" tooltip="Frames taking >2× expected time. High count indicates stuttering.">
        <StatusBadge variant={droppedStatus}>
          <span>{droppedFrames}</span>
          {droppedFrames === 0 ? <span> ✨</span> : <span> 💧</span>}
        </StatusBadge>
      </Metric>

      <Metric
        label="Frame Jitter"
        tooltip="Sudden spikes in frame time vs recent baseline. Indicates inconsistent rendering."
      >
        <StatusBadge variant={frameJitterStatus}>
          {frameJitter === 0 ? '✨ Smooth' : `⚡ ${String(frameJitter)} spikes`}
        </StatusBadge>
      </Metric>

      <Metric
        label="Frame Stability"
        tooltip="Frame time consistency (0-100%). 100% = perfectly smooth, lower = choppy/variable frame pacing."
      >
        <StatusBadge variant={stabilityStatus}>
          <span>{frameStability >= 90 ? '🎯 ' : frameStability >= 70 ? '📊 ' : '📉 '}</span>
          <span>{frameStability}%</span>
        </StatusBadge>
      </Metric>

      <Metric label="Paint Time" tooltip="Browser rendering time via double-RAF technique.">
        {formatMs(paintTime)}
        <SecondaryValue>/ {formatMs(maxPaintTime)} max</SecondaryValue>
      </Metric>

      <Metric
        label="Paint Jitter"
        tooltip="Sudden spikes in paint time vs recent baseline. Indicates rendering inconsistency."
      >
        <StatusBadge variant={paintJitterStatus}>
          {paintJitter === 0 ? '✨ None' : `🎢 ${String(paintJitter)} spikes`}
        </StatusBadge>
      </Metric>
    </MetricsSection>
  )
})

// ----------------------------------------------------------------------------
// Input Responsiveness Section
// ----------------------------------------------------------------------------

/**
 * Input Section - User interaction latency metrics.
 *
 * Displays:
 * - INP: Interaction to Next Paint (Core Web Vital)
 * - FID: First Input Delay (Core Web Vital - deprecated but still useful)
 * - Last/Slowest Interaction: Real-time details with inspect capability
 *
 * @component
 */
type InputSectionProps = Pick<
  PerformanceMetrics,
  | 'inputLatency'
  | 'maxInputLatency'
  | 'eventTimingSupported'
  | 'inpMs'
  | 'interactionCount'
  | 'firstInputDelay'
  | 'firstInputType'
  | 'lastInteraction'
  | 'slowestInteraction'
> & {
  onInspectElement?: (selector: string) => void
}

const InputSection = React.memo(function InputSection({
  inputLatency,
  maxInputLatency,
  eventTimingSupported,
  inpMs,
  interactionCount,
  firstInputDelay,
  firstInputType,
  lastInteraction,
  slowestInteraction,
  onInspectElement,
}: InputSectionProps) {
  const inputStatus = getStatus(inputLatency, THRESHOLDS.INPUT_LATENCY_GOOD, THRESHOLDS.INPUT_LATENCY_WARNING)
  const inpStatus = getStatus(inpMs, THRESHOLDS.INP_GOOD, THRESHOLDS.INP_WARNING)

  // Determine status for interaction based on INP thresholds
  const getInteractionStatus = (interaction: InteractionInfo | null) => {
    if (!interaction) return 'neutral'
    return getStatus(interaction.duration, THRESHOLDS.INP_GOOD, THRESHOLDS.INP_WARNING)
  }

  const handleInspect = (selector: string | undefined) => {
    if (selector && selector !== 'unknown' && onInspectElement) {
      onInspectElement(selector)
    }
  }

  return (
    <MetricsSection icon="👆" title="Input Responsiveness">
      <Metric
        label="INP"
        isWebVital
        tooltip="Interaction to Next Paint - p98 worst click/key latency. Core Web Vital. Good: ≤200ms, Poor: >500ms."
        reserveDetailSpace
        detail={
          eventTimingSupported && interactionCount > 0 ? (
            <>
              {interactionCount} interactions
              {slowestInteraction && slowestInteraction.targetSelector !== 'unknown' && (
                <>
                  <span>·</span>
                  <span>worst:</span>
                  <Code>{slowestInteraction.targetSelector.slice(0, 20)}</Code>
                  <InspectButton
                    onClick={() => {
                      handleInspect(slowestInteraction.targetSelector)
                    }}
                    title="Inspect slowest interaction element"
                  >
                    🔍
                  </InspectButton>
                </>
              )}
            </>
          ) : null
        }
      >
        {!eventTimingSupported ? (
          <NoDataHint>Chrome/Edge only</NoDataHint>
        ) : interactionCount > 0 ? (
          <StatusBadge variant={inpStatus}>{Math.round(inpMs)}ms</StatusBadge>
        ) : (
          <SecondaryValue>—</SecondaryValue>
        )}
      </Metric>

      <Metric
        label="Last Interaction"
        tooltip="Most recent user interaction. Shows timing breakdown: input delay (waiting) → processing (JS) → paint (render)."
        reserveDetailSpace
        detail={
          !eventTimingSupported ? null : lastInteraction ? (
            <>
              {lastInteraction.eventType}
              <span>·</span>
              <TimingBreakdown>
                <TimingPhase phase="delay">
                  <abbr title="Input delay - time waiting for main thread">wait</abbr>
                  {Math.round(lastInteraction.inputDelay)}
                </TimingPhase>
                <TimingArrow>→</TimingArrow>
                <TimingPhase phase="process">
                  <abbr title="Processing time - event handler execution">js</abbr>
                  {Math.round(lastInteraction.processingTime)}
                </TimingPhase>
                <TimingArrow>→</TimingArrow>
                <TimingPhase phase="paint">
                  <abbr title="Presentation delay - render and paint">paint</abbr>
                  {Math.round(lastInteraction.presentationDelay)}
                </TimingPhase>
              </TimingBreakdown>
              {lastInteraction.targetSelector !== 'unknown' && (
                <>
                  <span>·</span>
                  <Code>{lastInteraction.targetSelector.slice(0, 18)}</Code>
                  <InspectButton
                    onClick={() => {
                      handleInspect(lastInteraction.targetSelector)
                    }}
                    title="Highlight element in preview"
                  >
                    🔍
                  </InspectButton>
                </>
              )}
            </>
          ) : null
        }
      >
        {!eventTimingSupported ? (
          <NoDataHint>Chrome/Edge only</NoDataHint>
        ) : lastInteraction ? (
          <StatusBadge variant={getInteractionStatus(lastInteraction)}>
            {Math.round(lastInteraction.duration)}ms
          </StatusBadge>
        ) : (
          <SecondaryValue>—</SecondaryValue>
        )}
      </Metric>

      <Metric
        label="Slowest"
        tooltip="Slowest interaction observed during this session. Shows timing breakdown."
        reserveDetailSpace
        detail={
          !eventTimingSupported ? null : slowestInteraction ? (
            <>
              {slowestInteraction.eventType}
              <span>·</span>
              <TimingBreakdown>
                <TimingPhase phase="delay">
                  <abbr title="Input delay - time waiting for main thread">wait</abbr>
                  {Math.round(slowestInteraction.inputDelay)}
                </TimingPhase>
                <TimingArrow>→</TimingArrow>
                <TimingPhase phase="process">
                  <abbr title="Processing time - event handler execution">js</abbr>
                  {Math.round(slowestInteraction.processingTime)}
                </TimingPhase>
                <TimingArrow>→</TimingArrow>
                <TimingPhase phase="paint">
                  <abbr title="Presentation delay - render and paint">paint</abbr>
                  {Math.round(slowestInteraction.presentationDelay)}
                </TimingPhase>
              </TimingBreakdown>
              {slowestInteraction.targetSelector !== 'unknown' && (
                <>
                  <span>·</span>
                  <Code>{slowestInteraction.targetSelector.slice(0, 18)}</Code>
                  <InspectButton
                    onClick={() => {
                      handleInspect(slowestInteraction.targetSelector)
                    }}
                    title="Highlight element in preview"
                  >
                    🔍
                  </InspectButton>
                </>
              )}
            </>
          ) : null
        }
      >
        {!eventTimingSupported ? (
          <NoDataHint>Chrome/Edge only</NoDataHint>
        ) : slowestInteraction ? (
          <StatusBadge variant={getInteractionStatus(slowestInteraction)}>
            {Math.round(slowestInteraction.duration)}ms
          </StatusBadge>
        ) : (
          <SecondaryValue>—</SecondaryValue>
        )}
      </Metric>

      <Metric
        label="FID"
        isWebVital
        tooltip="First Input Delay - latency of the very first interaction. Core Web Vital. Good: ≤100ms, Poor: >300ms."
        reserveDetailSpace
        detail={firstInputType ? <>{firstInputType}</> : null}
      >
        {firstInputDelay !== null ? (
          <StatusBadge variant={getStatus(firstInputDelay, 100, 300)}>{Math.round(firstInputDelay)}ms</StatusBadge>
        ) : (
          <SecondaryValue>—</SecondaryValue>
        )}
      </Metric>

      <Metric
        label="Pointer Latency"
        tooltip="Time from pointer move to next frame. High values indicate main thread contention."
      >
        <StatusBadge variant={inputStatus}>{formatMs(inputLatency)}</StatusBadge>
        <SecondaryValue>/ {formatMs(maxInputLatency)} max</SecondaryValue>
      </Metric>
    </MetricsSection>
  )
})

// ----------------------------------------------------------------------------
// Main Thread Section
// ----------------------------------------------------------------------------

/**
 * Main Thread Section - Thread blocking and jank metrics.
 *
 * Displays:
 * - Long Tasks: Tasks >50ms blocking the main thread
 * - TBT: Total Blocking Time (Core Web Vital correlate)
 * - Thrashing: Style write + forced layout combinations
 * - DOM Churn: Mutations per measurement period
 *
 * @component
 */
type MainThreadSectionProps = Pick<
  PerformanceMetrics,
  'longTasks' | 'longestTask' | 'totalBlockingTime' | 'thrashingScore' | 'domMutationsPerFrame'
>

const MainThreadSection = React.memo(function MainThreadSection({
  longTasks,
  longestTask,
  totalBlockingTime,
  thrashingScore,
  domMutationsPerFrame,
}: MainThreadSectionProps) {
  const longTaskStatus = getStatus(longTasks, 0, THRESHOLDS.LONG_TASKS_WARNING)
  const tbtStatus = getStatus(totalBlockingTime, 0, THRESHOLDS.TBT_WARNING)
  const thrashingStatus = getZeroStatus(thrashingScore)
  const domMutationStatus = getStatus(domMutationsPerFrame, 0, THRESHOLDS.DOM_MUTATIONS_WARNING)

  return (
    <MetricsSection icon="⏱️" title="Main Thread">
      <Metric
        label="Long Tasks"
        tooltip="Tasks blocking main thread >50ms. Target: 0 during interactions."
        detail={longestTask > 0 ? <>longest: {Math.round(longestTask)}ms</> : null}
      >
        <StatusBadge variant={longTaskStatus}>
          <span>{longTasks === 0 ? '✨ ' : '🐢 '}</span>
          <span>{longTasks}</span>
        </StatusBadge>
      </Metric>

      <Metric
        label="TBT"
        isWebVital
        tooltip="Total Blocking Time - sum of time beyond 50ms for each long task. Correlates to TTI. Good: <200ms, Poor: >600ms."
      >
        <StatusBadge variant={tbtStatus}>
          <span>{totalBlockingTime === 0 ? '🚀 ' : totalBlockingTime > 600 ? '🧱 ' : '⏳ '}</span>
          <span>{totalBlockingTime}ms</span>
        </StatusBadge>
      </Metric>

      <Metric label="Thrashing" tooltip="Frame blocking >50ms near style writes. Indicates forced synchronous layout.">
        <StatusBadge variant={thrashingStatus}>
          {thrashingScore === 0 ? '✨ None' : `🔄 ${String(thrashingScore)} stalls`}
        </StatusBadge>
      </Metric>

      <Metric label="DOM Churn" tooltip="DOM mutations per sample period. High values indicate excessive re-rendering.">
        <StatusBadge variant={domMutationStatus}>
          <span>{domMutationsPerFrame === 0 ? '✨ ' : domMutationsPerFrame > 10 ? '🌪️ ' : '🔨 '}</span>
          <span>{domMutationsPerFrame}</span>
        </StatusBadge>
        <SecondaryValue>/period</SecondaryValue>
      </Metric>
    </MetricsSection>
  )
})

// ----------------------------------------------------------------------------
// Long Animation Frames Section
// ----------------------------------------------------------------------------

/**
 * Long Animation Frames Section - Detailed frame attribution.
 *
 * Displays:
 * - LoAF Count: Number of long animation frames (>50ms)
 * - Blocking Duration: Total and longest blocking time
 * - P95 Duration: 95th percentile frame duration
 * - Script Attribution: Count of LoAFs with script info
 *
 * This API provides more detail than Long Tasks API, specifically for
 * animation/rendering performance with script attribution.
 *
 * @component
 */
type LoAFSectionProps = Pick<
  PerformanceMetrics,
  | 'loafSupported'
  | 'loafCount'
  | 'totalLoafBlockingDuration'
  | 'longestLoafDuration'
  | 'longestLoafBlockingDuration'
  | 'avgLoafDuration'
  | 'p95LoafDuration'
  | 'loafsWithScripts'
  | 'lastLoaf'
  | 'worstLoaf'
>

const LoAFSection = React.memo(function LoAFSection({
  loafSupported,
  loafCount,
  totalLoafBlockingDuration,
  longestLoafDuration,
  longestLoafBlockingDuration,
  avgLoafDuration,
  p95LoafDuration,
  loafsWithScripts,
  worstLoaf,
}: LoAFSectionProps) {
  if (!loafSupported) {
    return (
      <MetricsSection icon="🎞️" title="Long Animation Frames">
        <Metric label="Status" tooltip="Long Animation Frames API is only supported in Chrome 123+">
          <StatusBadge variant="neutral">
            <span>⚠️ Not supported</span>
          </StatusBadge>
        </Metric>
      </MetricsSection>
    )
  }

  const countStatus = getStatus(loafCount, 0, THRESHOLDS.LOAF_COUNT_WARNING)
  const blockingStatus = getStatus(totalLoafBlockingDuration, 0, THRESHOLDS.LOAF_BLOCKING_WARNING)
  const durationStatus = getStatus(longestLoafDuration, 0, THRESHOLDS.LOAF_DURATION_WARNING)

  return (
    <MetricsSection icon="🎞️" title="Long Animation Frames">
      <Metric
        label="LoAF Count"
        tooltip="Count of animation frames exceeding 50ms. More detailed than Long Tasks - includes rendering attribution."
        detail={loafsWithScripts > 0 ? <>{loafsWithScripts} with scripts</> : null}
      >
        <StatusBadge variant={countStatus}>
          <span>{loafCount === 0 ? '✨ ' : loafCount > 10 ? '🐢 ' : '⚠️ '}</span>
          <span>{loafCount}</span>
        </StatusBadge>
      </Metric>

      <Metric
        label="Blocking"
        tooltip="Total blocking duration from all LoAFs (time beyond 50ms threshold). Good: <200ms, Poor: >500ms."
        detail={longestLoafBlockingDuration > 0 ? <>worst: {longestLoafBlockingDuration}ms</> : null}
      >
        <StatusBadge variant={blockingStatus}>
          <span>{totalLoafBlockingDuration === 0 ? '🚀 ' : totalLoafBlockingDuration > 500 ? '🧱 ' : '⏳ '}</span>
          <span>{totalLoafBlockingDuration}ms</span>
        </StatusBadge>
      </Metric>

      <Metric
        label="Longest"
        tooltip="Duration of the longest long animation frame. Good: <100ms, Poor: >200ms."
        detail={avgLoafDuration > 0 ? <>avg: {avgLoafDuration}ms</> : null}
      >
        <StatusBadge variant={durationStatus}>
          <span>{longestLoafDuration === 0 ? '✨ ' : longestLoafDuration > 200 ? '🐌 ' : '⏱️ '}</span>
          <span>{longestLoafDuration}ms</span>
        </StatusBadge>
      </Metric>

      <Metric label="P95 Duration" tooltip="95th percentile LoAF duration. Shows worst-case frame times.">
        <StatusBadge variant={getStatus(p95LoafDuration, 0, THRESHOLDS.LOAF_DURATION_WARNING)}>
          <span>{p95LoafDuration === 0 ? '✨ ' : '📊 '}</span>
          <span>{p95LoafDuration}ms</span>
        </StatusBadge>
      </Metric>

      {worstLoaf?.topScript && (
        <Metric
          label="Top Script"
          tooltip={`Worst LoAF caused by: ${worstLoaf.topScript.invokerType} (${worstLoaf.topScript.invoker})`}
        >
          <Code style={{fontSize: '10px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis'}}>
            {worstLoaf.topScript.sourceFunctionName || worstLoaf.topScript.invoker}
          </Code>
          <SecondaryValue>{Math.round(worstLoaf.topScript.duration)}ms</SecondaryValue>
        </Metric>
      )}
    </MetricsSection>
  )
})

// ----------------------------------------------------------------------------
// Element Timing Section
// ----------------------------------------------------------------------------

/**
 * Element Timing Section - Tracks render time for elements with elementtiming attribute.
 *
 * Displays:
 * - Element Count: Number of elements tracked
 * - Largest Render Time: Slowest element to render (similar to LCP concept)
 * - Element List: Individual elements with their render times
 *
 * Usage: Add `elementtiming="hero-image"` attribute to elements in your stories
 * to track their render timing.
 *
 * NOTE: Consider reusing @github-ui/web-vitals/element-timing for:
 * - ElementTimingObserver: Has soft-nav reset handling
 * - ElementTimingMetric: Provides structured metric with element reference
 *
 * @component
 */
type ElementTimingSectionProps = Pick<
  PerformanceMetrics,
  'elementTimingSupported' | 'elementTimingCount' | 'largestElementRenderTime' | 'elementTimings'
>

const ElementTimingSection = React.memo(function ElementTimingSection({
  elementTimingSupported,
  elementTimingCount,
  largestElementRenderTime,
  elementTimings,
}: ElementTimingSectionProps) {
  if (!elementTimingSupported) {
    return (
      <MetricsSection icon="🎯" title="Element Timing">
        <Metric label="Status" tooltip="Element Timing API is only supported in Chromium browsers">
          <StatusBadge variant="neutral">
            <span>⚠️ Not supported</span>
          </StatusBadge>
        </Metric>
      </MetricsSection>
    )
  }

  if (elementTimingCount === 0) {
    return (
      <MetricsSection icon="🎯" title="Element Timing">
        <Metric
          label="No elements tracked"
          tooltip="Add `elementtiming` attribute to elements to track their render time"
        >
          <Code style={{fontSize: '10px'}}>elementtiming=&quot;name&quot;</Code>
        </Metric>
      </MetricsSection>
    )
  }

  // Sort by render time, largest first
  const sortedElements = [...elementTimings].sort((a, b) => b.renderTime - a.renderTime)

  return (
    <MetricsSection icon="🎯" title="Element Timing">
      <Metric
        label="Elements"
        tooltip="Number of elements with `elementtiming` attribute tracked"
        detail={sortedElements.length > 3 ? <>{sortedElements.length} total</> : null}
      >
        <StatusBadge variant="success">
          <span>📍 </span>
          <span>{elementTimingCount}</span>
        </StatusBadge>
      </Metric>

      <Metric label="Largest" tooltip="Slowest element to render. Similar concept to LCP but for tracked elements.">
        <StatusBadge variant={getStatus(largestElementRenderTime, 100, 250)}>
          <span>{largestElementRenderTime < 100 ? '⚡ ' : largestElementRenderTime < 250 ? '⏱️ ' : '🐌 '}</span>
          <span>{largestElementRenderTime}ms</span>
        </StatusBadge>
      </Metric>

      {sortedElements.slice(0, 3).map((el, i) => (
        <Metric
          key={el.identifier}
          label={el.identifier}
          tooltip={`Element: ${el.selector}\nRender time: ${String(el.renderTime)}ms`}
        >
          <StatusBadge variant={getStatus(el.renderTime, 100, 250)}>
            <span>{i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : '🥉 '}</span>
            <span>{el.renderTime}ms</span>
          </StatusBadge>
        </Metric>
      ))}
    </MetricsSection>
  )
})

// ----------------------------------------------------------------------------
// Layout & Stability Section
// ----------------------------------------------------------------------------

/**
 * Layout & Internals Section - Layout stability and browser internals.
 *
 * Displays:
 * - CLS: Cumulative Layout Shift (Core Web Vital)
 * - Forced Reflows: Synchronous layout caused by read-after-write
 * - Style Writes: Inline style mutations
 * - Jitter: Input latency spikes
 *
 * @component
 */
type LayoutAndInternalsSectionProps = Pick<
  PerformanceMetrics,
  | 'layoutShiftScore'
  | 'layoutShiftCount'
  | 'currentSessionCLS'
  | 'forcedReflowCount'
  | 'styleWrites'
  | 'cssVarChanges'
  | 'inputJitter'
>

const LayoutAndInternalsSection = React.memo(function LayoutAndInternalsSection({
  layoutShiftScore,
  layoutShiftCount,
  currentSessionCLS,
  forcedReflowCount,
  styleWrites,
  cssVarChanges,
  inputJitter,
}: LayoutAndInternalsSectionProps) {
  const clsStatus = getStatus(layoutShiftScore, THRESHOLDS.CLS_GOOD, THRESHOLDS.CLS_WARNING)
  const reflowStatus = getStatus(forcedReflowCount, 0, THRESHOLDS.FORCED_REFLOW_WARNING)
  const jitterStatus = getZeroStatus(inputJitter)

  // Build detail parts - always show both when available
  const detailParts: string[] = []
  if (layoutShiftCount > 0) {
    detailParts.push(`${String(layoutShiftCount)} shifts`)
  }
  if (currentSessionCLS > 0) {
    detailParts.push(`session: ${formatScore(currentSessionCLS)}`)
  }

  return (
    <MetricsSection icon="📐" title="Layout & Stability">
      <Metric
        label="CLS"
        isWebVital
        tooltip="Cumulative Layout Shift (max session window). Core Web Vital. Good: <0.1, Poor: >0.25. Uses session windowing per spec."
        detail={detailParts.length > 0 ? <>{detailParts.join(' · ')}</> : null}
      >
        <StatusBadge variant={clsStatus}>
          {layoutShiftScore === 0
            ? '🎯 0'
            : layoutShiftScore > 0.25
              ? `📦 ${formatScore(layoutShiftScore)}`
              : formatScore(layoutShiftScore)}
        </StatusBadge>
      </Metric>

      <Metric
        label="Forced Reflows"
        tooltip="Layout reads after style writes force synchronous layout. Major perf killer during drag."
      >
        <StatusBadge variant={reflowStatus}>
          <span>{forcedReflowCount === 0 ? '✨ ' : '💥 '}</span>
          <span>{forcedReflowCount}</span>
        </StatusBadge>
      </Metric>

      <Metric
        label="Style Writes"
        tooltip="Inline style mutations observed via MutationObserver."
        detail={cssVarChanges > 0 ? <>{cssVarChanges} CSS var changes</> : null}
      >
        <span>🎨 {styleWrites}</span>
      </Metric>

      <Metric
        label="Input Jitter"
        tooltip="Unexpected input latency spikes causing visible hitches during interaction."
      >
        <StatusBadge variant={jitterStatus}>
          {inputJitter === 0 ? '✨ None' : `😵 ${String(inputJitter)} hitches`}
        </StatusBadge>
      </Metric>
    </MetricsSection>
  )
})

// ----------------------------------------------------------------------------
// React Profiler Section
// ----------------------------------------------------------------------------

/**
 * Single React profiler panel - displays metrics for one profiler.
 */
interface ReactPerformancePanelProps {
  /** Panel title (profiler ID or "React Performance" for aggregated) */
  id: string
  /** Metrics to display */
  reactMountCount: number
  reactMountDuration: number
  reactRenderCount: number
  reactPostMountUpdateCount: number
  slowReactUpdates: number
  reactP95Duration: number
  renderCascades: number
  memoizationEfficiency: number
}

const ReactPerformancePanel = React.memo(function ReactPerformancePanel({
  id,
  reactMountCount,
  reactMountDuration,
  reactRenderCount,
  reactPostMountUpdateCount,
  slowReactUpdates,
  reactP95Duration,
  renderCascades,
  memoizationEfficiency,
}: ReactPerformancePanelProps) {
  const slowUpdateStatus = getStatus(slowReactUpdates, 0, THRESHOLDS.SLOW_UPDATES_WARNING)
  const p95Status = getStatus(reactP95Duration, 0, THRESHOLDS.REACT_P95_WARNING)
  const cascadeStatus = getStatus(renderCascades, 0, THRESHOLDS.CASCADE_WARNING)

  // Convert ratio to "work saved" percentage
  // memoizationEfficiency = actual/base, so saved = 1 - ratio
  const workSaved = Math.max(0, Math.min(100, (1 - memoizationEfficiency) * 100))
  const savedStatus = workSaved >= 20 ? 'success' : workSaved > 0 ? 'neutral' : 'warning'

  return (
    <Section>
      <SectionHeader>
        <SectionIcon>⚛️</SectionIcon>
        <SectionTitle>React Performance</SectionTitle>
      </SectionHeader>
      <MetricsList>
        <Metric label="ID" tooltip="Profiler ID (React element ID or custom name)">
          {id}
        </Metric>
        <Metric
          label="Mount"
          tooltip="Initial render count and total duration."
          detail={reactMountDuration > 0 ? <>{formatMs(reactMountDuration)} total</> : null}
        >
          {reactMountCount}×
        </Metric>

        <Metric
          label="Slow Updates"
          tooltip="React updates taking >16ms (one frame budget). These cause visible jank."
          detail={
            reactRenderCount > 0 && reactPostMountUpdateCount > 0 ? (
              <>{reactPostMountUpdateCount} total updates</>
            ) : null
          }
        >
          {reactRenderCount > 0 ? (
            <StatusBadge variant={slowUpdateStatus}>
              <span>{slowReactUpdates === 0 ? '⚡ ' : '🐌 '}</span>
              <span>{slowReactUpdates}</span>
            </StatusBadge>
          ) : (
            <NoDataHint>No renders</NoDataHint>
          )}
        </Metric>

        <Metric
          label="P95 Duration"
          tooltip="95th percentile React update duration. Represents worst-case user experience."
        >
          {reactP95Duration > 0 ? (
            <StatusBadge variant={p95Status}>
              <span>{reactP95Duration < THRESHOLDS.REACT_P95_WARNING ? '🎯 ' : '🐢 '}</span>
              <span>{formatMs(reactP95Duration)}</span>
            </StatusBadge>
          ) : (
            <SecondaryValue>—</SecondaryValue>
          )}
        </Metric>

        <Metric label="Cascades" tooltip="Nested updates during commit phase. Often from setState in useLayoutEffect.">
          <StatusBadge variant={cascadeStatus}>
            <span>{renderCascades === 0 ? '✨ ' : '🌀 '}</span>
            <span>{renderCascades}</span>
          </StatusBadge>
        </Metric>

        <Metric
          label="Work Saved"
          tooltip="How much render work is being skipped by memoization (React.memo, useMemo). Higher is better. 0% means everything re-renders every time."
        >
          {reactRenderCount > 0 ? (
            <StatusBadge variant={savedStatus}>
              <span>{workSaved >= 20 ? '🎯 ' : workSaved > 0 ? '' : '⚠️ '}</span>
              <span>{formatPercent(workSaved)}</span>
            </StatusBadge>
          ) : (
            <SecondaryValue>—</SecondaryValue>
          )}
        </Metric>
      </MetricsList>
    </Section>
  )
})

/**
 * React Section - Shows one panel per React profiler.
 *
 * When there's only one profiler (the main story), shows a single panel.
 * When there are multiple profilers, shows one panel per profiler.
 * This makes it clear which metrics belong to which React tree.
 *
 * @component
 */
interface ReactSectionProps {
  /** List of registered profilers */
  profilers?: ProfilerInfo[]
}

// Default empty profilers array - stable reference to avoid re-renders
const EMPTY_PROFILERS: ProfilerInfo[] = []

const ReactSection = React.memo(function ReactSection({profilers = EMPTY_PROFILERS}: ReactSectionProps) {
  if (profilers.length === 0) {
    return (
      <Section>
        <SectionHeader>
          <SectionIcon>⚛️</SectionIcon>
          <SectionTitle>React Performance</SectionTitle>
        </SectionHeader>
        <EmptyState>
          <EmptyStateTitle>Awaiting profiler data</EmptyStateTitle>
          <EmptyStateSubtitle>
            Wrap components with <Code>ProfiledComponent</Code> or interact with the story to trigger renders.
          </EmptyStateSubtitle>
        </EmptyState>
      </Section>
    )
  }

  return (
    <>
      {profilers.map(profiler => (
        <ReactPerformancePanel
          key={profiler.id}
          id={profiler.id}
          reactMountCount={profiler.metrics.reactMountCount}
          reactMountDuration={profiler.metrics.reactMountDuration}
          reactRenderCount={profiler.metrics.reactRenderCount}
          reactPostMountUpdateCount={profiler.metrics.reactPostMountUpdateCount}
          slowReactUpdates={profiler.metrics.slowReactUpdates}
          reactP95Duration={computeP95(profiler.metrics.reactUpdateDurations)}
          renderCascades={profiler.metrics.nestedUpdateCount}
          memoizationEfficiency={profiler.metrics.memoizationEfficiency}
        />
      ))}
    </>
  )
})

// ----------------------------------------------------------------------------
// Memory & Rendering Section
// ----------------------------------------------------------------------------

/**
 * Memory & Rendering Section - Heap usage and rendering metrics.
 *
 * Displays:
 * - Heap: Current JS heap size with sparkline (Chrome only)
 * - Peak / DOM: Peak memory and DOM node count
 * - GC Pressure: Memory allocation rate (MB/s)
 * - Paint / Layers: Paint count and compositor layers
 *
 * Shows alternate view when memory API is unavailable (Firefox/Safari).
 *
 * @component
 */
type MemoryAndRenderingSectionProps = Pick<
  PerformanceMetrics,
  | 'memoryUsedMB'
  | 'memoryDeltaMB'
  | 'peakMemoryMB'
  | 'memoryHistory'
  | 'gcPressure'
  | 'domElements'
  | 'paintCount'
  | 'compositorLayers'
>

const MemoryAndRenderingSection = React.memo(function MemoryAndRenderingSection({
  memoryUsedMB,
  memoryDeltaMB,
  peakMemoryMB,
  memoryHistory,
  gcPressure,
  domElements,
  paintCount,
  compositorLayers,
}: MemoryAndRenderingSectionProps) {
  const gcStatus = getStatus(gcPressure, 0, THRESHOLDS.GC_PRESSURE_WARNING)
  const layerStatus = compositorLayers === null ? 'neutral' : getStatus(compositorLayers, 0, THRESHOLDS.LAYERS_WARNING)

  const deltaStatus =
    memoryDeltaMB === null
      ? 'neutral'
      : memoryDeltaMB > THRESHOLDS.MEMORY_DELTA_DANGER
        ? 'error'
        : memoryDeltaMB > THRESHOLDS.MEMORY_DELTA_WARNING
          ? 'warning'
          : 'success'

  const deltaText =
    memoryDeltaMB === null
      ? ''
      : memoryDeltaMB > 0.5
        ? `+${formatMb(memoryDeltaMB)}`
        : memoryDeltaMB < -0.5
          ? formatMb(memoryDeltaMB)
          : '±0'

  if (memoryUsedMB === null) {
    return (
      <MetricsSection icon="🧠" title="Memory & Rendering">
        <Metric label="Heap">
          <SecondaryValue>Not available (Chrome only)</SecondaryValue>
        </Metric>
        <Metric label="Paint Count" tooltip="Number of paint operations.">
          {paintCount}
        </Metric>
        <Metric label="Compositor Layers" tooltip="Elements promoted to GPU layers.">
          {compositorLayers !== null ? <StatusBadge variant={layerStatus}>{compositorLayers}</StatusBadge> : '—'}
        </Metric>
      </MetricsSection>
    )
  }

  return (
    <MetricsSection icon="🧠" title="Memory & Rendering">
      <Metric
        label="Heap"
        tooltip="Current JS heap size. Watch for sustained growth indicating leaks."
        sparkline={<Sparkline data={memoryHistory} />}
      >
        <span>
          {formatMb(memoryUsedMB)}MB
          {deltaText && <StatusBadge variant={deltaStatus}> ({deltaText})</StatusBadge>}
        </span>
      </Metric>

      <Metric label="Peak" tooltip="Peak heap memory observed.">
        {peakMemoryMB !== null ? `${formatMb(peakMemoryMB)}MB` : '—'}
      </Metric>

      <Metric label="DOM Nodes" tooltip="Current DOM element count in story container.">
        {domElements !== null ? formatNumber(domElements) : '—'}
      </Metric>

      <Metric label="GC Pressure" tooltip="Memory allocation rate. High values cause GC pauses.">
        <StatusBadge variant={gcStatus}>
          {gcPressure > 0.01 ? `🗑️ ${formatRate(gcPressure, 'MB/s')}` : '✨ Low'}
        </StatusBadge>
      </Metric>

      <Metric label="Paint / Layers" tooltip="Paint operations and compositor layer count.">
        <span>{paintCount}</span>
        <SecondaryValue>
          /{' '}
          {compositorLayers !== null ? (
            <StatusBadge variant={layerStatus}>{compositorLayers} layers</StatusBadge>
          ) : (
            <span>—</span>
          )}
        </SecondaryValue>
      </Metric>
    </MetricsSection>
  )
})

// ============================================================================
// Panel State Management
// ============================================================================

/**
 * Connection status represents the panel's relationship with the story/decorator.
 */
export type ConnectionStatus = 'loading' | 'connected' | 'error' | 'no-decorator'

/**
 * Profilers are stored by storyId to support:
 * 1. Multiple profilers per story
 * 2. Easy cleanup when story changes
 * 3. No race conditions between story navigation and profiler updates
 */
export interface PanelState {
  status: ConnectionStatus
  metrics: PerformanceMetrics
  /** Map of storyId → array of profilers for that story */
  profilersByStory: Record<string, ProfilerInfo[]>
  errorMessage: string | null
}

export type PanelAction =
  | {type: 'METRICS_RECEIVED'; metrics: PerformanceMetrics}
  | {type: 'PROFILER_UPDATE'; storyId: string; id: string; metrics: ReactMetrics}
  | {type: 'CLEANUP_OLD_STORIES'; currentStoryId: string}
  | {type: 'STORY_ERROR'; message: string}
  | {type: 'NO_DECORATOR'}
  | {type: 'RESET_METRICS'}

export const INITIAL_STATE: PanelState = {
  status: 'loading',
  metrics: DEFAULT_METRICS,
  profilersByStory: {},
  errorMessage: null,
}

export function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case 'METRICS_RECEIVED':
      return {
        ...state,
        status: 'connected',
        metrics: action.metrics,
        errorMessage: null,
      }

    case 'PROFILER_UPDATE': {
      const {storyId, id, metrics} = action
      const storyProfilers = state.profilersByStory[storyId] ?? []
      const existing = storyProfilers.findIndex(p => p.id === id)
      const newProfiler: ProfilerInfo = {
        id,
        metrics,
        lastUpdated: Date.now(),
      }

      let updatedProfilers: ProfilerInfo[]
      if (existing >= 0) {
        updatedProfilers = [...storyProfilers]
        updatedProfilers[existing] = newProfiler
      } else {
        updatedProfilers = [...storyProfilers, newProfiler]
      }

      return {
        ...state,
        profilersByStory: {
          ...state.profilersByStory,
          [storyId]: updatedProfilers,
        },
      }
    }

    case 'CLEANUP_OLD_STORIES': {
      // Keep only the current story's profilers
      const currentProfilers = state.profilersByStory[action.currentStoryId]
      return {
        ...state,
        profilersByStory: currentProfilers ? {[action.currentStoryId]: currentProfilers} : {},
      }
    }

    case 'STORY_ERROR':
      return {
        ...state,
        status: 'error',
        errorMessage: action.message,
      }

    case 'NO_DECORATOR':
      // Only transition if we're still loading
      if (state.status === 'loading') {
        return {...state, status: 'no-decorator'}
      }
      return state

    case 'RESET_METRICS':
      return {...state, metrics: DEFAULT_METRICS}

    default:
      return state
  }
}

// ============================================================================
// Main Panel Content
// ============================================================================

/**
 * Connected panel content - only rendered when we have a valid storyId.
 * Stores profilers by storyId to support multiple profilers per story
 * and clean up old entries when story changes.
 *
 * @component
 * @private
 */
function ConnectedPanelContent({storyId}: {storyId: string}) {
  const [state, dispatch] = React.useReducer(panelReducer, INITIAL_STATE)
  const {previewInitialized} = useStorybookState()

  // Get profilers for the current story (supports multiple profilers per story)
  const currentProfilers = state.profilersByStory[storyId] ?? []

  // Once we have the current story's profilers, clean up old stories
  // This ensures we don't lose mount data due to race conditions
  React.useEffect(() => {
    dispatch({type: 'CLEANUP_OLD_STORIES', currentStoryId: storyId})
  }, [storyId])

  // Track connected status for stale closure avoidance in useChannel
  const isConnected = () => state.status === 'connected'

  // Channel event handlers - maps Storybook events to reducer actions
  const emit = useChannel({
    [PERF_EVENTS.METRICS_UPDATE]: (data: PerformanceMetrics) => {
      dispatch({type: 'METRICS_RECEIVED', metrics: data})
    },

    [PERF_EVENTS.PROFILER_UPDATE]: (data: {id: string; metrics: ReactMetrics; storyId: string}) => {
      dispatch({type: 'PROFILER_UPDATE', storyId: data.storyId, id: data.id, metrics: data.metrics})
    },

    // Story rendered - request metrics from decorator
    storyRendered: () => {
      emit(PERF_EVENTS.REQUEST_METRICS)
    },

    // Story finished (including play function) - request final metrics
    storyFinished: () => {
      // Request metrics after play function completes for accurate final measurements
      emit(PERF_EVENTS.REQUEST_METRICS)
    },

    storyErrored: () => {
      dispatch({type: 'STORY_ERROR', message: 'Story failed to render'})
    },
    storyMissing: () => {
      dispatch({type: 'STORY_ERROR', message: 'Story not found'})
    },
    storyThrewException: (error: Error) => {
      dispatch({type: 'STORY_ERROR', message: error.message || 'Story threw an exception'})
    },
    playFunctionThrewException: (error: Error) => {
      dispatch({type: 'STORY_ERROR', message: `Play function error: ${error.message || 'Unknown error'}`})
    },

    storyArgsUpdated: () => {
      if (isConnected()) {
        emit(PERF_EVENTS.RESET)
        dispatch({type: 'RESET_METRICS'})
      }
    },
  })

  // Request metrics on mount and when preview initializes
  // This handles the case where we mount after the story has already rendered
  React.useEffect(() => {
    if (previewInitialized) {
      emit(PERF_EVENTS.REQUEST_METRICS)
    }
  }, [previewInitialized, emit])

  // After preview is ready, wait briefly for metrics before showing no-decorator hint
  React.useEffect(() => {
    if (!previewInitialized || state.status !== 'loading') return undefined

    // Preview ready but no metrics yet - give decorator a moment to respond
    const timeoutId = setTimeout(() => {
      dispatch({type: 'NO_DECORATOR'})
    }, 500)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [previewInitialized, state.status])

  const handleReset = React.useCallback(() => {
    emit(PERF_EVENTS.RESET)
    dispatch({type: 'RESET_METRICS'})
  }, [emit])

  const handleInspectElement = React.useCallback(
    (selector: string) => {
      emit(PERF_EVENTS.INSPECT_ELEMENT, selector)
    },
    [emit],
  )

  // Render based on connection status
  if (state.status !== 'connected') {
    if (state.status === 'error') {
      return (
        <EmptyState>
          <EmptyStateTitle>Story error</EmptyStateTitle>
          <EmptyStateSubtitle>{state.errorMessage}</EmptyStateSubtitle>
          <EmptyStateHint>
            <span>Fix the error in your story to see performance metrics.</span>
          </EmptyStateHint>
        </EmptyState>
      )
    }

    if (state.status === 'no-decorator') {
      return (
        <EmptyState>
          <EmptyStateTitle>Performance monitoring not active for this story</EmptyStateTitle>
          <EmptyStateHint>
            Add the <Code>withPerformanceMonitor</Code> decorator to enable metrics collection.
          </EmptyStateHint>
        </EmptyState>
      )
    }

    return (
      <EmptyState>
        <EmptyStateTitle>Loading story…</EmptyStateTitle>
        <EmptyStateSubtitle>Waiting for performance metrics</EmptyStateSubtitle>
      </EmptyState>
    )
  }

  const {metrics} = state

  return (
    <PanelWrapper>
      <ContentArea>
        <SectionsGrid>
          <FrameTimingSection
            fps={metrics.fps}
            fpsHistory={metrics.fpsHistory}
            frameTime={metrics.frameTime}
            maxFrameTime={metrics.maxFrameTime}
            frameTimeHistory={metrics.frameTimeHistory}
            droppedFrames={metrics.droppedFrames}
            frameJitter={metrics.frameJitter}
            frameStability={metrics.frameStability}
            paintTime={metrics.paintTime}
            maxPaintTime={metrics.maxPaintTime}
            paintJitter={metrics.paintJitter}
          />
          <InputSection
            inputLatency={metrics.inputLatency}
            maxInputLatency={metrics.maxInputLatency}
            eventTimingSupported={metrics.eventTimingSupported}
            inpMs={metrics.inpMs}
            interactionCount={metrics.interactionCount}
            firstInputDelay={metrics.firstInputDelay}
            firstInputType={metrics.firstInputType}
            lastInteraction={metrics.lastInteraction}
            slowestInteraction={metrics.slowestInteraction}
            onInspectElement={handleInspectElement}
          />
          <MainThreadSection
            longTasks={metrics.longTasks}
            longestTask={metrics.longestTask}
            totalBlockingTime={metrics.totalBlockingTime}
            thrashingScore={metrics.thrashingScore}
            domMutationsPerFrame={metrics.domMutationsPerFrame}
          />
          <LoAFSection
            loafSupported={metrics.loafSupported}
            loafCount={metrics.loafCount}
            totalLoafBlockingDuration={metrics.totalLoafBlockingDuration}
            longestLoafDuration={metrics.longestLoafDuration}
            longestLoafBlockingDuration={metrics.longestLoafBlockingDuration}
            avgLoafDuration={metrics.avgLoafDuration}
            p95LoafDuration={metrics.p95LoafDuration}
            loafsWithScripts={metrics.loafsWithScripts}
            lastLoaf={metrics.lastLoaf}
            worstLoaf={metrics.worstLoaf}
          />
          <ReactSection profilers={currentProfilers} />
          <LayoutAndInternalsSection
            layoutShiftScore={metrics.layoutShiftScore}
            layoutShiftCount={metrics.layoutShiftCount}
            currentSessionCLS={metrics.currentSessionCLS}
            forcedReflowCount={metrics.forcedReflowCount}
            styleWrites={metrics.styleWrites}
            cssVarChanges={metrics.cssVarChanges}
            inputJitter={metrics.inputJitter}
          />
          <MemoryAndRenderingSection
            memoryUsedMB={metrics.memoryUsedMB}
            memoryDeltaMB={metrics.memoryDeltaMB}
            peakMemoryMB={metrics.peakMemoryMB}
            memoryHistory={metrics.memoryHistory}
            gcPressure={metrics.gcPressure}
            domElements={metrics.domElements}
            paintCount={metrics.paintCount}
            compositorLayers={metrics.compositorLayers}
          />
          <ElementTimingSection
            elementTimingSupported={metrics.elementTimingSupported}
            elementTimingCount={metrics.elementTimingCount}
            largestElementRenderTime={metrics.largestElementRenderTime}
            elementTimings={metrics.elementTimings}
          />
        </SectionsGrid>
      </ContentArea>
      <SideToolbar>
        <Button variant="ghost" padding="small" onClick={handleReset} ariaLabel="Reset all metrics">
          <SyncIcon />
        </Button>
      </SideToolbar>
    </PanelWrapper>
  )
}

/**
 * Outer panel content - handles storyId gating.
 *
 * ConnectedPanelContent stores all profiler data and cleans up old entries
 * after confirming the new story's profiler is registered. This avoids
 * losing mount data due to timing issues with React's key-based remounting.
 *
 * Uses Storybook lifecycle hooks for:
 * - viewMode: Detect docs vs story mode
 *
 * @component
 * @param props.active - Whether the panel tab is currently selected
 * @private
 */
function PanelContent({active}: {active: boolean}) {
  const {storyId, previewInitialized, viewMode} = useStorybookState()

  if (!active) return null

  if (!storyId) {
    return (
      <EmptyState>
        <EmptyStateTitle>No story selected</EmptyStateTitle>
        <EmptyStateSubtitle>Select a story to view performance metrics</EmptyStateSubtitle>
      </EmptyState>
    )
  }

  // In docs mode, metrics may not be meaningful since stories are rendered differently
  if (viewMode === 'docs') {
    return (
      <EmptyState>
        <EmptyStateTitle>Docs mode</EmptyStateTitle>
        <EmptyStateSubtitle>
          Performance metrics are optimized for story view. Switch to Canvas view for accurate measurements.
        </EmptyStateSubtitle>
        <EmptyStateHint>
          <span>Docs mode renders stories in iframes which affects timing accuracy.</span>
        </EmptyStateHint>
      </EmptyState>
    )
  }

  if (!previewInitialized) {
    return (
      <EmptyState>
        <EmptyStateTitle>Preview not initialized</EmptyStateTitle>
        <EmptyStateSubtitle>The preview is still initializing. Please wait...</EmptyStateSubtitle>
      </EmptyState>
    )
  }

  // Don't key by storyId - we manage profiler cleanup internally to avoid
  // losing mount data during story transitions
  return <ConnectedPanelContent storyId={storyId} />
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Props for the PerformancePanel component.
 * @interface PerformancePanelProps
 */
interface PerformancePanelProps {
  /** Whether the panel is currently visible/active */
  active: boolean
}

/**
 * Main addon panel component for the Performance Monitor.
 *
 * This is the entry point registered with Storybook's addon API.
 * Wraps PanelContent in an AddonPanel for proper Storybook integration.
 *
 * @component
 * @param props - Component props
 * @param props.active - Whether the panel is currently visible
 *
 * @example
 * // Registered in manager.tsx via addons.add()
 * addons.add(PANEL_ID, {
 *   type: types.PANEL,
 *   render: ({active}) => <PerformancePanel active={active} />,
 * })
 *
 * @see {@link ./performance-types.tsx} - Where this panel is registered
 */
export function PerformancePanel({active}: PerformancePanelProps) {
  return (
    <ErrorBoundary>
      <AddonPanel active={active}>
        <PanelContent active={active} />
      </AddonPanel>
    </ErrorBoundary>
  )
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props)
    this.state = {hasError: false}
  }

  static getDerivedStateFromError() {
    return {hasError: true}
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can log the error to an error reporting service

    console.error('Error in PerformancePanel:', error, errorInfo)
  }

  override render() {
    if (this.state.hasError) {
      return (
        <EmptyState>
          <EmptyStateTitle>Something went wrong</EmptyStateTitle>
          <EmptyStateSubtitle>The performance panel failed to load.</EmptyStateSubtitle>
        </EmptyState>
      )
    }

    return this.props.children
  }
}
