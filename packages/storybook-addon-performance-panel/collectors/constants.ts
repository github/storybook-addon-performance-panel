/**
 * @fileoverview Configuration constants for metric collectors
 * @module collectors/constants
 */

// ============================================================================
// Frame Timing Constants
// ============================================================================

/** Number of stable RAF intervals required before estimating the display refresh rate */
export const FRAME_RATE_CALIBRATION_SAMPLES = 8

/** Rolling window used to adapt when the story moves between displays */
export const FRAME_RATE_CALIBRATION_WINDOW = 30

/** RAF gaps at or above this duration are treated as inactive/throttled iframe periods */
export const FRAME_INACTIVE_GAP_MS = 250

/** Fastest plausible display interval used during refresh-rate calibration */
export const FRAME_INTERVAL_MIN_MS = 1000 / 300

/** Slowest plausible display interval used during refresh-rate calibration */
export const FRAME_INTERVAL_MAX_MS = 1000 / 24

/** Frame time threshold (ms) for detecting layout thrashing */
export const THRASHING_FRAME_THRESHOLD = 50

/** Time window (ms) for associating style writes with long frames */
export const THRASHING_STYLE_WRITE_WINDOW = 50

// ============================================================================
// Rolling Window Sizes
// ============================================================================

/** Max interaction latencies to keep for INP calculation */
export const INTERACTION_LATENCIES_WINDOW = 50

/** Rolling window size for frame time samples */
export const FRAME_TIMES_WINDOW = 60

/** Rolling window size for input latency samples */
export const INPUT_LATENCIES_WINDOW = 30

/** Rolling window size for double-RAF pointer frame interval samples */
export const PAINT_TIMES_WINDOW = 30

/** Number of data points to keep for sparkline charts */
export const SPARKLINE_HISTORY_SIZE = 30

// ============================================================================
// Jitter Detection Constants
// ============================================================================

/** Number of recent samples to use for jitter baseline */
export const JITTER_BASELINE_SIZE = 5

/** Jitter = spike exceeding baseline × this multiplier */
export const JITTER_MULTIPLIER = 3

/** Minimum delta (ms) from baseline to count as input jitter */
export const JITTER_INPUT_DELTA = 30

/** Minimum absolute value (ms) to count as input jitter */
export const JITTER_INPUT_ABSOLUTE = 50

/** Minimum delta (ms) from baseline to count as frame jitter */
export const JITTER_FRAME_DELTA = 20

/** Minimum absolute value (ms) to count as frame jitter */
export const JITTER_FRAME_ABSOLUTE = 40

/** Minimum delta (ms) from baseline to count as pointer frame interval jitter */
export const JITTER_PAINT_DELTA = 20

/** Minimum absolute value (ms) to count as pointer frame interval jitter */
export const JITTER_PAINT_ABSOLUTE = 35

// ============================================================================
// Max Value Decay Constants
// ============================================================================

/** Threshold below which max values start to decay */
export const MAX_DECAY_THRESHOLD = 20

/** Decay rate per frame for max frame time */
export const MAX_DECAY_RATE = 0.99

/** Threshold below which max input latency starts to decay */
export const MAX_INPUT_DECAY_THRESHOLD = 20

/** Decay rate per frame for max input latency */
export const MAX_INPUT_DECAY_RATE = 0.98

/** Threshold below which the max pointer frame interval starts to decay */
export const MAX_PAINT_DECAY_THRESHOLD = 10

/** Decay rate per frame for the max pointer frame interval */
export const MAX_PAINT_DECAY_RATE = 0.98
