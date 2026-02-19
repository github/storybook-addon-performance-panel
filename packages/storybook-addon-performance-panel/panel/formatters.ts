/**
 * Formatter for milliseconds with 1 decimal place.
 */
const msFormatter = new Intl.NumberFormat('en-US', {
  style: 'unit',
  unit: 'millisecond',
  unitDisplay: 'narrow',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * Formats a number as milliseconds with 1 decimal place.
 * @param value - Duration in milliseconds
 * @returns Formatted string (e.g., "16.7ms")
 */
export const formatMs = (value: number): string => msFormatter.format(value)

/**
 * Formatter for megabytes with 1 decimal place.
 */
const mbFormatter = new Intl.NumberFormat('en-US', {
  style: 'unit',
  unit: 'megabyte',
  unitDisplay: 'narrow',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * Formats a number as megabytes with 1 decimal place.
 * @param value - Size in megabytes
 * @returns Formatted string (e.g., "45.2MB")
 */
export const formatMb = (value: number): string => mbFormatter.format(value)

/**
 * Formatter for numbers with thousand separators.
 */
const numberFormatter = new Intl.NumberFormat('en-US')

/**
 * Formats a number with thousand separators.
 * @param value - Number to format
 * @returns Formatted string (e.g., "1,234")
 */
export const formatNumber = (value: number): string => numberFormatter.format(value)

/**
 * Formatter for scores with 3 decimal places.
 */
const scoreFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})

/**
 * Formats a score with 3 decimal places.
 * @param value - Score value (e.g., CLS)
 * @returns Formatted string (e.g., "0.125")
 */
export const formatScore = (value: number): string => scoreFormatter.format(value)

/**
 * Formats a number as a percentage (integer).
 * @param value - Percentage value (0-100)
 * @returns Formatted string (e.g., "48%")
 */
export const formatPercent = (value: number): string => `${String(Math.round(value))}%`

/**
 * Formatter for rate values with 2 decimal places.
 */
const rateFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Formats a rate with 2 decimal places and unit suffix.
 * @param value - Rate value
 * @param unit - Unit string (e.g., "MB/s")
 * @returns Formatted string (e.g., "1.25 MB/s")
 */
export const formatRate = (value: number, unit: string): string => `${rateFormatter.format(value)} ${unit}`
