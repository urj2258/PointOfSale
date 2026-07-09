const COLORS = {
  g1: '--gradient-rgb-1',
  g2: '--gradient-rgb-2',
  g3: '--gradient-rgb-3',
  g4: '--gradient-rgb-4',
  g5: '--gradient-rgb-5',
}

function Bubbles({ count, className }: { count: number; className?: string }) {
  const bubbles = Array.from({ length: count }, (_, i) => ({
    id: i,
    size: 20 + Math.random() * 60,
    left: Math.random() * 100,
    delay: Math.random() * 8,
    duration: 8 + Math.random() * 12,
    color: [COLORS.g1, COLORS.g2, COLORS.g3, COLORS.g4][i % 4],
  }))

  return (
    <div className={className}>
      {bubbles.map((b) => (
        <div
          key={b.id}
          className="absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            left: `${b.left}%`,
            bottom: '-10%',
            background: `rgba(var(${b.color}), 0.12)`,
            boxShadow: `0 0 ${b.size}px rgba(var(${b.color}), 0.08)`,
            animation: `bubble-float ${b.duration}s ease-in-out ${b.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

function GlowingOrbs() {
  const orbs = [
    { top: '15%', left: '10%', size: 180, color: '1', opacity: '0.12', blur: 120, delay: '0s' },
    { top: '60%', left: '75%', size: 220, color: '2', opacity: '0.1', blur: 150, delay: '-2s' },
    { top: '75%', left: '20%', size: 160, color: '3', opacity: '0.15', blur: 100, delay: '-4s' },
    { top: '30%', left: '80%', size: 140, color: '4', opacity: '0.12', blur: 100, delay: '-1s' },
    { top: '50%', left: '50%', size: 300, color: '1', opacity: '0.06', blur: 200, delay: '-3s' },
  ]

  return (
    <>
      {orbs.map((o, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: o.size,
            height: o.size,
            top: o.top,
            left: o.left,
            background: `radial-gradient(circle, rgba(var(--gradient-rgb-${o.color}), ${o.opacity}) 0%, transparent 70%)`,
            filter: `blur(${o.blur}px)`,
            animation: `glow-drift ${12 + i * 2}s ease-in-out ${o.delay} infinite`,
          }}
        />
      ))}
    </>
  )
}

function ScanLines() {
  const lines = [
    { top: '20%', delay: '0s' },
    { top: '55%', delay: '3s' },
    { top: '75%', delay: '6s' },
  ]

  return (
    <>
      {lines.map((p, i) => (
        <div
          key={i}
          className="absolute h-px w-full"
          style={{
            top: p.top,
            animation: `scan-beam ${4 + i * 0.5}s linear ${p.delay} infinite`,
            background: 'linear-gradient(90deg, transparent, rgba(var(--gradient-rgb-1), 0.25), rgba(var(--gradient-rgb-2), 0.25), transparent)',
          }}
        />
      ))}
    </>
  )
}

function DataStreams() {
  const streams = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    left: 8 + Math.random() * 84,
    delay: Math.random() * 6,
    duration: 3 + Math.random() * 4,
    width: 1 + Math.random() * 2,
    height: 40 + Math.random() * 80,
    color: [COLORS.g1, COLORS.g2, COLORS.g3][i % 3],
  }))

  return (
    <>
      {streams.map((s) => (
        <div
          key={s.id}
          className="absolute"
          style={{
            left: `${s.left}%`,
            width: s.width,
            height: s.height,
            top: -s.height,
            background: `linear-gradient(to bottom, transparent, rgba(var(${s.color}), 0.15))`,
            animation: `data-stream ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </>
  )
}

const posIcons = [
  {
    className: 'top-[10%] right-[6%] w-36 h-36 text-brand-primary/8',
    anim: 'float-up 20s ease-in-out infinite',
    paths: (
      <>
        <rect x="20" y="15" width="80" height="65" rx="8" />
        <rect x="30" y="25" width="60" height="28" rx="4" strokeWidth="1" />
        <line x1="30" y1="60" x2="80" y2="60" strokeWidth="1" />
        <rect x="48" y="65" width="24" height="8" rx="3" />
        <circle cx="60" cy="39" r="5" />
        <line x1="20" y1="82" x2="100" y2="82" strokeDasharray="4 4" strokeWidth="1" />
        <circle cx="40" cy="19" r="3" fill="currentColor" stroke="none" opacity="0.5" />
        <circle cx="55" cy="19" r="3" fill="currentColor" stroke="none" opacity="0.5" />
        <circle cx="70" cy="19" r="3" fill="currentColor" stroke="none" opacity="0.5" />
      </>
    ),
  },
  {
    className: 'bottom-[25%] left-[4%] w-24 h-24 text-accent-purple/8',
    anim: 'float-up 25s ease-in-out -5s infinite',
    paths: (
      <>
        <rect x="15" y="20" width="70" height="55" rx="6" />
        <rect x="25" y="30" width="50" height="7" rx="2" strokeWidth="1" />
        <rect x="25" y="42" width="50" height="7" rx="2" strokeWidth="1" />
        <rect x="25" y="54" width="35" height="7" rx="2" strokeWidth="1" />
        <line x1="15" y1="75" x2="85" y2="75" strokeDasharray="3 3" strokeWidth="1" />
        <rect x="10" y="78" width="35" height="4" rx="2" />
        <rect x="55" y="78" width="35" height="4" rx="2" />
      </>
    ),
  },
  {
    className: 'top-[40%] right-[3%] w-20 h-20 text-accent-orange/7',
    anim: 'float-up 22s ease-in-out -10s infinite',
    paths: (
      <>
        <rect x="10" y="10" width="80" height="60" rx="8" />
        <circle cx="50" cy="36" r="14" strokeWidth="1.5" />
        <line x1="50" y1="22" x2="50" y2="50" strokeWidth="2" />
        <line x1="36" y1="36" x2="64" y2="36" strokeWidth="2" />
        <rect x="25" y="58" width="50" height="5" rx="2" />
        <line x1="35" y1="65" x2="65" y2="65" strokeWidth="1" />
        <line x1="10" y1="72" x2="90" y2="72" strokeDasharray="2 4" strokeWidth="1" />
      </>
    ),
  },
  {
    className: 'bottom-[10%] right-[12%] w-28 h-28 text-brand-primary/6',
    anim: 'float-up 28s ease-in-out -3s infinite',
    paths: (
      <>
        <rect x="20" y="10" width="80" height="60" rx="6" />
        <rect x="30" y="20" width="60" height="8" rx="2" strokeWidth="1" opacity="0.6" />
        <text x="35" y="36" fontSize="5" stroke="none" fill="currentColor" opacity="0.5">*** 4532</text>
        <text x="35" y="46" fontSize="4" stroke="none" fill="currentColor" opacity="0.4">AUTHORIZED</text>
        <rect x="25" y="55" width="60" height="4" rx="2" />
        <rect x="30" y="62" width="40" height="4" rx="2" />
        <rect x="20" y="72" width="80" height="6" rx="3" />
        <line x1="20" y1="80" x2="100" y2="80" strokeDasharray="8 4" strokeWidth="1" />
        <line x1="20" y1="88" x2="100" y2="88" strokeDasharray="4 4" strokeWidth="1" opacity="0.4" />
      </>
    ),
  },
  {
    className: 'top-[18%] left-[20%] w-16 h-16 text-accent-purple/6',
    anim: 'float-up 18s ease-in-out -8s infinite',
    paths: (
      <>
        <rect x="10" y="25" width="80" height="40" rx="4" />
        <circle cx="50" cy="45" r="10" strokeWidth="1.5" />
        <circle cx="50" cy="45" r="4" strokeWidth="1" fill="currentColor" fillOpacity="0.2" />
        <line x1="10" y1="55" x2="90" y2="55" strokeWidth="0.5" />
        <line x1="25" y1="60" x2="75" y2="60" strokeDasharray="2 3" strokeWidth="1" />
        <rect x="50" y="65" width="20" height="4" rx="2" />
        <rect x="30" y="65" width="15" height="4" rx="2" />
      </>
    ),
  },
  {
    className: 'bottom-[40%] right-[28%] w-14 h-14 text-accent-orange/6',
    anim: 'float-up 30s ease-in-out -15s infinite',
    paths: (
      <>
        <rect x="15" y="15" width="70" height="70" rx="10" />
        <circle cx="50" cy="40" r="12" strokeWidth="1.5" />
        <line x1="50" y1="28" x2="50" y2="52" strokeWidth="1.5" />
        <line x1="38" y1="40" x2="62" y2="40" strokeWidth="1.5" />
        <line x1="20" y1="58" x2="80" y2="58" strokeWidth="1" opacity="0.5" />
        <line x1="24" y1="64" x2="76" y2="64" strokeWidth="1" opacity="0.3" />
        <line x1="28" y1="70" x2="72" y2="70" strokeWidth="1" opacity="0.15" />
      </>
    ),
  },
]

export default function PosBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <style>{`
        @keyframes bubble-float {
          0% { transform: translateY(100vh) scale(0); opacity: 0; }
          10% { opacity: 0.4; }
          90% { opacity: 0.25; }
          100% { transform: translateY(-20vh) scale(1); opacity: 0; }
        }
        @keyframes glow-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -20px) scale(1.08); }
          50% { transform: translate(-20px, 30px) scale(0.95); }
          75% { transform: translate(-30px, -10px) scale(1.04); }
        }
        @keyframes scan-beam {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes data-stream {
          0% { transform: translateY(-100%); opacity: 0; }
          20% { opacity: 0.5; }
          80% { opacity: 0.5; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes float-up {
          0% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
          100% { transform: translateY(0); }
        }
        @keyframes blink-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse at 15% 45%, rgba(var(--gradient-rgb-1), 0.4) 0%, transparent 60%),
          radial-gradient(ellipse at 85% 25%, rgba(var(--gradient-rgb-2), 0.35) 0%, transparent 55%),
          radial-gradient(ellipse at 45% 85%, rgba(var(--gradient-rgb-3), 0.5) 0%, transparent 50%),
          radial-gradient(ellipse at 75% 70%, rgba(var(--gradient-rgb-4), 0.3) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 30%, rgba(var(--gradient-rgb-5), 0.15) 0%, transparent 60%)
        `,
      }} />

      <GlowingOrbs />
      <Bubbles count={10} className="absolute inset-0" />
      <ScanLines />
      <DataStreams />

      {posIcons.map((icon, i) => (
        <svg
          key={i}
          className={`absolute ${icon.className}`}
          viewBox="0 0 120 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ animation: icon.anim }}
        >
          {icon.paths}
        </svg>
      ))}

      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `
          linear-gradient(rgba(0,0,0,0.5) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.5) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px'
      }} />

      <div className="absolute top-1/4 left-0 w-48 h-px" style={{ animation: 'scan-beam 4s linear 0s infinite', background: 'linear-gradient(90deg, transparent, rgba(var(--gradient-rgb-1), 0.2), transparent)' }} />
      <div className="absolute top-2/4 right-0 w-48 h-px" style={{ animation: 'scan-beam 5s linear 2s infinite', background: 'linear-gradient(90deg, transparent, rgba(var(--gradient-rgb-2), 0.15), transparent)' }} />
      <div className="absolute top-3/4 left-0 w-48 h-px" style={{ animation: 'scan-beam 6s linear 4s infinite', background: 'linear-gradient(90deg, transparent, rgba(var(--gradient-rgb-3), 0.1), transparent)' }} />

      <div className="absolute top-[30%] right-[15%] w-1 h-1 rounded-full" style={{ animation: 'blink-dot 1.5s ease-in-out 0s infinite', background: 'rgba(var(--gradient-rgb-1), 0.3)', boxShadow: '0 0 6px 2px rgba(var(--gradient-rgb-1), 0.2)' }} />
      <div className="absolute top-[60%] left-[20%] w-1 h-1 rounded-full" style={{ animation: 'blink-dot 1.8s ease-in-out 0.5s infinite', background: 'rgba(var(--gradient-rgb-2), 0.3)', boxShadow: '0 0 6px 2px rgba(var(--gradient-rgb-2), 0.2)' }} />
      <div className="absolute top-[40%] left-[55%] w-1 h-1 rounded-full" style={{ animation: 'blink-dot 2s ease-in-out 1s infinite', background: 'rgba(var(--gradient-rgb-4), 0.3)', boxShadow: '0 0 6px 2px rgba(var(--gradient-rgb-4), 0.2)' }} />
    </div>
  )
}
