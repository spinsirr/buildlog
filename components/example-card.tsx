'use client'

import { CalendarDays, GitBranch, GitCommit, GitMerge, Rocket } from 'lucide-react'
import { useState } from 'react'

type Platform = 'twitter' | 'linkedin' | 'bluesky'

const PLATFORMS: { key: Platform; label: string; bg: string; text?: string }[] = [
  { key: 'twitter', label: 'Twitter / X', bg: 'bg-neo-secondary' },
  { key: 'linkedin', label: 'LinkedIn', bg: 'bg-[#0A66C2]', text: 'text-white' },
  { key: 'bluesky', label: 'Bluesky', bg: 'bg-[#0085FF]', text: 'text-white' },
]

export type ExampleType = 'commit' | 'pr' | 'release' | 'recap' | 'branch'

const TYPE_CONFIG: Record<ExampleType, { Icon: typeof GitCommit; label: string }> = {
  commit: { Icon: GitCommit, label: 'Push' },
  pr: { Icon: GitMerge, label: 'PR Merged' },
  release: { Icon: Rocket, label: 'Release' },
  recap: { Icon: CalendarDays, label: 'Weekly Recap' },
  branch: { Icon: GitBranch, label: 'Branch Recap' },
}

export interface ExampleData {
  type: ExampleType
  repo: string
  stack: string
  trigger: { title: string; detail: string }
  posts: Record<Platform, string>
  accent: string
}

export function ExampleCard({ example }: { example: ExampleData }) {
  const [platform, setPlatform] = useState<Platform>('twitter')
  const { Icon, label } = TYPE_CONFIG[example.type]

  return (
    <article className="border-4 border-black bg-neo-cream">
      {/* Header */}
      <div className={`px-6 py-4 border-b-4 border-black ${example.accent}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" strokeWidth={3} />
            <span className="font-mono-ui text-xs font-bold uppercase tracking-wider">{label}</span>
          </div>
          <span className="font-mono-ui text-xs font-bold uppercase tracking-wider opacity-60">
            {example.stack}
          </span>
        </div>
        <p className="font-code text-sm font-bold">{example.trigger.title}</p>
        <p className="font-code text-xs opacity-60 mt-1">{example.trigger.detail}</p>
      </div>

      {/* Platform tabs + content */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPlatform(p.key)}
              className={`border-2 border-black px-2.5 py-0.5 transition-all ${
                platform === p.key
                  ? `${p.bg} ${p.text ?? ''}`
                  : 'bg-transparent opacity-40 hover:opacity-60'
              }`}
              style={platform === p.key ? { boxShadow: '2px 2px 0 0 #000' } : undefined}
            >
              <span
                className={`font-mono-ui text-[10px] font-bold uppercase tracking-wider ${
                  platform === p.key && p.text ? p.text : ''
                }`}
              >
                {p.label}
              </span>
            </button>
          ))}
        </div>
        <p className="font-mono-ui text-sm leading-relaxed whitespace-pre-line">
          {example.posts[platform]}
        </p>
      </div>
    </article>
  )
}
