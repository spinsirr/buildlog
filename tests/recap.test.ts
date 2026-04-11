import { describe, expect, it } from 'vitest'
import {
  buildRecapSystemPrompt,
  buildRecapUserPrompt,
  type BundleDecision,
  type RecapPost,
} from '@/lib/recap-prompts'

describe('buildRecapSystemPrompt', () => {
  it('includes char limit in system prompt', () => {
    const prompt = buildRecapSystemPrompt('casual', 280)
    expect(prompt).toContain('under 280 characters')
  })

  it('uses x_premium char limit', () => {
    const prompt = buildRecapSystemPrompt('casual', 4000)
    expect(prompt).toContain('under 4000 characters')
  })

  it('includes casual tone instructions', () => {
    const prompt = buildRecapSystemPrompt('casual', 280)
    expect(prompt).toContain('friendly, conversational')
  })

  it('includes professional tone instructions', () => {
    const prompt = buildRecapSystemPrompt('professional', 280)
    expect(prompt).toContain('polished, professional')
  })

  it('includes technical tone instructions', () => {
    const prompt = buildRecapSystemPrompt('technical', 280)
    expect(prompt).toContain('technical tone')
  })

  it('falls back to casual for unknown tone', () => {
    const prompt = buildRecapSystemPrompt('unknown', 280)
    expect(prompt).toContain('friendly, conversational')
  })
})

describe('buildRecapUserPrompt', () => {
  const mockBundle: BundleDecision = {
    id: '1',
    source_type: 'commit',
    source_data: { message: 'feat: add CSV export' },
    reason: 'meaningful but incomplete',
    angle: 'data export feature',
    created_at: '2026-04-10T00:00:00Z',
  }

  const mockPost: RecapPost = {
    id: '2',
    content: 'Shipped dark mode for the dashboard. #buildinpublic',
    source_type: 'commit',
    source_data: null,
    created_at: '2026-04-09T00:00:00Z',
  }

  it('includes bundles section when bundles exist', () => {
    const prompt = buildRecapUserPrompt([mockBundle], [])
    expect(prompt).toContain('BUNDLED EVENTS')
    expect(prompt).toContain('feat: add CSV export')
    expect(prompt).toContain('meaningful but incomplete')
  })

  it('includes angle in bundle line when present', () => {
    const prompt = buildRecapUserPrompt([mockBundle], [])
    expect(prompt).toContain('(angle: data export feature)')
  })

  it('omits angle when null', () => {
    const noAngle = { ...mockBundle, angle: null }
    const prompt = buildRecapUserPrompt([noAngle], [])
    expect(prompt).not.toContain('(angle:')
  })

  it('includes published posts section when posts exist', () => {
    const prompt = buildRecapUserPrompt([], [mockPost])
    expect(prompt).toContain('ALREADY SHARED THIS WEEK')
    expect(prompt).toContain('Shipped dark mode')
  })

  it('includes both sections when both exist', () => {
    const prompt = buildRecapUserPrompt([mockBundle], [mockPost])
    expect(prompt).toContain('BUNDLED EVENTS')
    expect(prompt).toContain('ALREADY SHARED THIS WEEK')
  })

  it('handles empty data gracefully', () => {
    const prompt = buildRecapUserPrompt([], [])
    expect(prompt).toContain('Generate ONE weekly recap post')
    expect(prompt).not.toContain('BUNDLED EVENTS')
    expect(prompt).not.toContain('ALREADY SHARED')
  })

  it('uses title fallback when message is missing', () => {
    const prBundle = { ...mockBundle, source_data: { title: 'Fix login bug' } }
    const prompt = buildRecapUserPrompt([prBundle], [])
    expect(prompt).toContain('Fix login bug')
  })
})
