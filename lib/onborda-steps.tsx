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
            BuildLog turns your GitHub activity into ready-to-publish social posts. Here&apos;s a
            quick tour of how it works.
          </>
        ),
        selector: '#onborda-nav-dashboard',
        side: 'bottom',
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: <>&#128279;</>,
        title: 'Your repos',
        content: (
          <>
            Manage your connected GitHub repos here. BuildLog watches commits, PRs, and releases to
            generate posts automatically.
          </>
        ),
        selector: '#onborda-nav-repos',
        side: 'right',
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: <>&#128225;</>,
        title: 'Your socials',
        content: (
          <>
            Connect Twitter/X, LinkedIn, or Bluesky in Settings to publish your posts across
            platforms.
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
        title: 'Your posts',
        content: (
          <>
            All your AI-generated drafts and published posts live here. Review, edit, and publish
            with one click.
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
