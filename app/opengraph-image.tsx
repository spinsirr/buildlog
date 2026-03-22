import { ImageResponse } from 'next/og'

export const alt = 'BuildLog — Turn Commits into Content'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const runtime = 'edge'

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: '#0a0a0a',
        color: '#fafafa',
        fontFamily: 'system-ui, sans-serif',
        padding: '60px 80px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Git timeline decoration — left side */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'absolute',
          left: 80,
          top: 60,
          bottom: 60,
          width: 4,
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 4,
            height: '100%',
            background: 'linear-gradient(to bottom, #f87171, #facc15, #a3e635)',
            borderRadius: 2,
          }}
        />
      </div>

      {/* Commit dots on the timeline */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 72,
          top: 120,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#f87171',
          boxShadow: '0 0 20px rgba(248, 113, 113, 0.5)',
        }}
      />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 72,
          top: 280,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#facc15',
          boxShadow: '0 0 20px rgba(250, 204, 21, 0.5)',
        }}
      />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 72,
          top: 440,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#a3e635',
          boxShadow: '0 0 20px rgba(163, 230, 53, 0.5)',
        }}
      />

      {/* Main content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          marginLeft: 60,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        {/* Logo text */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              fontWeight: 700,
              color: '#a1a1aa',
              letterSpacing: '-0.02em',
            }}
          >
            buildlog
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1.1,
              color: '#fafafa',
            }}
          >
            Turn Commits
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1.1,
            }}
          >
            <span style={{ color: '#fafafa' }}>into </span>
            <span
              style={{
                background: 'linear-gradient(135deg, #f87171, #facc15, #a3e635)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Content
            </span>
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: 'flex',
            fontSize: 24,
            color: '#71717a',
            marginTop: 28,
            letterSpacing: '-0.01em',
          }}
        >
          Connect GitHub · AI writes the post · Publish everywhere
        </div>

        {/* Platform badges */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 32,
          }}
        >
          {['Twitter/X', 'LinkedIn', 'Bluesky'].map((platform) => (
            <div
              key={platform}
              style={{
                display: 'flex',
                padding: '8px 20px',
                borderRadius: 9999,
                border: '1px solid #27272a',
                fontSize: 16,
                color: '#a1a1aa',
              }}
            >
              {platform}
            </div>
          ))}
        </div>
      </div>

      {/* Subtle grid pattern in background */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: 0,
          right: 0,
          width: 400,
          height: '100%',
          background:
            'radial-gradient(circle at 100% 50%, rgba(248,113,113,0.06) 0%, transparent 60%)',
        }}
      />
    </div>,
    { ...size }
  )
}
