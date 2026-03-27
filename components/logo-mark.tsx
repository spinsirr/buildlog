export function LogoMark({ size = 32 }: { size?: number }) {
  const cell = Math.round(size * 0.42)
  const start2 = size - cell
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      aria-hidden="true"
      role="img"
    >
      <rect x="0" y="0" width={cell} height={cell} fill="#000000" />
      <rect x={start2} y="0" width={cell} height={cell} fill="#FF6B6B" />
      <rect x="0" y={start2} width={cell} height={cell} fill="#FFD93D" />
      <rect x={start2} y={start2} width={cell} height={cell} fill="#000000" />
    </svg>
  )
}
