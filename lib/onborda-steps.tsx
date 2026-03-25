import type { Step } from 'onborda'

interface Tour {
  tour: string
  steps: Step[]
}

export const tours: Tour[] = [
  {
    tour: 'onboarding',
    steps: [
      {
        icon: <>&#128075;</>,
        title: 'Welcome to BuildLog',
        content: (
          <>
            Turn your GitHub commits into social posts. Let&apos;s get you set up in 3 quick steps.
          </>
        ),
        selector: '#onborda-stats',
        side: 'bottom',
        showControls: true,
        pointerPadding: 12,
        pointerRadius: 12,
      },
      {
        icon: <>&#128279;</>,
        title: 'Connect a repo',
        content: (
          <>
            First, connect a GitHub repo. BuildLog watches your commits and generates posts from
            them.
          </>
        ),
        selector: '#onborda-connect-repo',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 10,
      },
      {
        icon: <>&#128225;</>,
        title: 'Link your socials',
        content: (
          <>
            Head to Settings to connect Twitter/X, LinkedIn, or Bluesky &mdash; wherever you build
            in public.
          </>
        ),
        selector: '#onborda-nav-settings',
        side: 'right',
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: <>&#10024;</>,
        title: 'Generate posts',
        content: (
          <>
            Once connected, go to Posts to generate AI-written content from your commits and publish
            it.
          </>
        ),
        selector: '#onborda-nav-posts',
        side: 'right',
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 8,
      },
    ],
  },
]
