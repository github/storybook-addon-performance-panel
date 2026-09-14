import {readFile} from 'node:fs/promises'
import {argv} from 'node:process'

interface BenchmarkSummary {
  group: string
  name: string
  mean: number
  p99: number
}

const [baselinePath, candidatePath] = argv.slice(2)

if (!baselinePath || !candidatePath) {
  throw new Error('Usage: compare-results.ts <baseline.json> <candidate.json>')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function readBenchmarks(filePath: string): Promise<Map<string, BenchmarkSummary>> {
  const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'))
  if (!isRecord(parsed)) {
    throw new Error(`${filePath} is not a Vitest benchmark result`)
  }

  const benchmarks = new Map<string, BenchmarkSummary>()
  if (Array.isArray(parsed.files)) {
    for (const file of parsed.files) {
      if (!isRecord(file) || !Array.isArray(file.groups)) continue
      for (const group of file.groups) {
        if (!isRecord(group) || typeof group.fullName !== 'string' || !Array.isArray(group.benchmarks)) continue
        for (const benchmark of group.benchmarks) {
          if (
            !isRecord(benchmark) ||
            typeof benchmark.name !== 'string' ||
            typeof benchmark.mean !== 'number' ||
            typeof benchmark.p99 !== 'number'
          ) {
            continue
          }
          benchmarks.set(`${group.fullName}::${benchmark.name}`, {
            group: group.fullName.split(' > ').at(-1) ?? group.fullName,
            name: benchmark.name,
            mean: benchmark.mean,
            p99: benchmark.p99,
          })
        }
      }
    }
  }

  if (Array.isArray(parsed.testResults)) {
    for (const testResult of parsed.testResults) {
      if (!isRecord(testResult) || !Array.isArray(testResult.assertionResults)) continue
      for (const assertion of testResult.assertionResults) {
        if (!isRecord(assertion) || !Array.isArray(assertion.benchmarks)) continue
        const ancestorTitles = Array.isArray(assertion.ancestorTitles)
          ? assertion.ancestorTitles.filter((title): title is string => typeof title === 'string')
          : []
        const groupName = ancestorTitles.at(-1) ?? 'benchmark'
        const groupKey = ancestorTitles.join(' > ') || groupName

        for (const benchmark of assertion.benchmarks) {
          if (!isRecord(benchmark) || !Array.isArray(benchmark.tasks)) continue
          for (const task of benchmark.tasks) {
            if (!isRecord(task) || typeof task.name !== 'string' || !isRecord(task.latency)) continue
            if (typeof task.latency.mean !== 'number' || typeof task.latency.p99 !== 'number') continue
            benchmarks.set(`${groupKey}::${task.name}`, {
              group: groupName,
              name: task.name,
              mean: task.latency.mean,
              p99: task.latency.p99,
            })
          }
        }
      }
    }
  }

  if (benchmarks.size === 0) {
    throw new Error(`${filePath} does not contain benchmark measurements`)
  }
  return benchmarks
}

function formatDuration(value: number): string {
  return `${value.toFixed(4)} ms`
}

function formatDelta(baseline: number, candidate: number): string {
  if (baseline === 0) return 'n/a'
  const delta = ((candidate - baseline) / baseline) * 100
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`
}

const baseline = await readBenchmarks(baselinePath)
const candidate = await readBenchmarks(candidatePath)
const rows: {baseline: BenchmarkSummary; candidate: BenchmarkSummary}[] = []

for (const [key, baselineResult] of baseline) {
  const candidateResult = candidate.get(key)
  if (!candidateResult) {
    throw new Error(`Candidate results are missing ${key}`)
  }
  rows.push({baseline: baselineResult, candidate: candidateResult})
}

console.log('| Workload | State | Baseline mean | Candidate mean | Mean delta | Baseline p99 | Candidate p99 |')
console.log('| --- | --- | ---: | ---: | ---: | ---: | ---: |')
for (const row of rows) {
  console.log(
    `| ${row.baseline.group} | ${row.baseline.name} | ${formatDuration(row.baseline.mean)} | ${formatDuration(row.candidate.mean)} | ${formatDelta(row.baseline.mean, row.candidate.mean)} | ${formatDuration(row.baseline.p99)} | ${formatDuration(row.candidate.p99)} |`,
  )
}
