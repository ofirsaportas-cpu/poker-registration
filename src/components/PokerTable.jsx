const STATUS_COLOR = {
  'מגיע': '#27ae60',
  'אולי': '#e67e22',
  'ממתין לאישור': '#666',
  'לא מגיע': '#555',
};

const STATUS_BG = {
  'מגיע': '#0d3a1e',
  'אולי': '#2e1c00',
  'ממתין לאישור': '#1a1a1a',
  'לא מגיע': '#111',
};

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[parts.length - 1][0];
}

function shortName(name) {
  if (!name) return '';
  const parts = name.trim().split(' ');
  if (parts[0].length <= 7) return parts[0];
  return parts[0].slice(0, 6) + '…';
}

export default function PokerTable({ registrations, maxSeats }) {
  const coming = registrations
    .filter((r) => r.status === 'מגיע')
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

  const seated = coming.slice(0, maxSeats);
  const waitlist = coming.slice(maxSeats);
  const maybe = registrations.filter((r) => r.status === 'אולי');
  const notComing = registrations.filter((r) => r.status === 'לא מגיע');

  const totalSlots = maxSeats;
  const W = 560;
  const H = 340;
  const cx = W / 2;
  const cy = H / 2;
  const rx = 195;
  const ry = 120;
  const SR = 30;

  const seatPositions = Array.from({ length: totalSlots }, (_, i) => {
    const angle = (2 * Math.PI * i) / totalSlots - Math.PI / 2;
    return {
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    };
  });

  const gradId = 'felt-grad';
  const shadowId = 'table-shadow';

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif', direction: 'rtl' }}>
      <div style={{ overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', maxWidth: W, display: 'block', margin: '0 auto' }}
        >
          <defs>
            <radialGradient id={gradId} cx="50%" cy="40%">
              <stop offset="0%" stopColor="#1e5534" />
              <stop offset="70%" stopColor="#174426" />
              <stop offset="100%" stopColor="#0d2e18" />
            </radialGradient>
            <filter id={shadowId}>
              <feDropShadow dx="0" dy="6" stdDeviation="12" floodColor="#000" floodOpacity="0.7" />
            </filter>
          </defs>

          {/* Table outer rim (wood) */}
          <ellipse
            cx={cx} cy={cy}
            rx={rx + 16} ry={ry + 12}
            fill="#2a1a0a"
            filter={`url(#${shadowId})`}
          />

          {/* Table felt */}
          <ellipse
            cx={cx} cy={cy}
            rx={rx} ry={ry}
            fill={`url(#${gradId})`}
          />

          {/* Inner felt line */}
          <ellipse
            cx={cx} cy={cy}
            rx={rx - 12} ry={ry - 8}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1.5}
          />

          {/* Center suit pattern */}
          <text
            x={cx} y={cy + 6}
            textAnchor="middle"
            fill="rgba(255,255,255,0.06)"
            fontSize={20}
            fontFamily="serif"
          >
            ♠ ♥ ♦ ♣
          </text>

          {/* Seats */}
          {seatPositions.map((pos, i) => {
            const player = seated[i];
            const occupied = !!player;

            return (
              <g key={i}>
                {/* Seat shadow */}
                <circle cx={pos.x} cy={pos.y + 3} r={SR} fill="rgba(0,0,0,0.4)" />

                {/* Seat circle */}
                <circle
                  cx={pos.x} cy={pos.y} r={SR}
                  fill={occupied ? '#1a3d25' : '#111'}
                  stroke={occupied ? STATUS_COLOR['מגיע'] : '#252525'}
                  strokeWidth={occupied ? 2.5 : 1.5}
                />

                {occupied ? (
                  <>
                    {/* Initials */}
                    <text
                      x={pos.x} y={pos.y + 5}
                      textAnchor="middle"
                      fill="#f0f0f0"
                      fontSize={13}
                      fontWeight="700"
                      fontFamily="Heebo, sans-serif"
                    >
                      {initials(player.name)}
                    </text>
                    {/* Name below seat */}
                    <text
                      x={pos.x} y={pos.y + SR + 14}
                      textAnchor="middle"
                      fill="#c0c0c0"
                      fontSize={11}
                      fontFamily="Heebo, sans-serif"
                      fontWeight="500"
                    >
                      {shortName(player.name)}
                    </text>
                    {player.isRegular && (
                      <text
                        x={pos.x + SR - 8} y={pos.y - SR + 10}
                        textAnchor="middle"
                        fill="#c9a84c"
                        fontSize={10}
                      >
                        ★
                      </text>
                    )}
                  </>
                ) : (
                  <text
                    x={pos.x} y={pos.y + 5}
                    textAnchor="middle"
                    fill="#303030"
                    fontSize={18}
                    fontFamily="sans-serif"
                  >
                    +
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Maybe players */}
      {maybe.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ color: '#e67e22', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            אולי ({maybe.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {maybe.map((r) => (
              <PlayerChip key={r.id} player={r} status="אולי" />
            ))}
          </div>
        </div>
      )}

      {/* Waitlist */}
      {waitlist.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ color: '#c0392b', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            📋 רשימת המתנה ({waitlist.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {waitlist.map((r, i) => (
              <PlayerChip key={r.id} player={r} status="המתנה" position={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Not coming */}
      {notComing.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ color: '#555', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            לא מגיעים ({notComing.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {notComing.map((r) => (
              <PlayerChip key={r.id} player={r} status="לא מגיע" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerChip({ player, status, position }) {
  const colors = {
    'אולי': { bg: '#2e1c00', border: '#e67e22', text: '#e67e22' },
    'המתנה': { bg: '#2a0a0a', border: '#8b2020', text: '#c0392b' },
    'לא מגיע': { bg: '#111', border: '#252525', text: '#555' },
  };
  const c = colors[status] || colors['לא מגיע'];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 24,
      padding: '5px 12px',
      opacity: status === 'אולי' ? 0.75 : 1,
    }}>
      {position && (
        <span style={{ color: c.text, fontSize: 11, fontWeight: 700 }}>#{position}</span>
      )}
      <span style={{ color: '#ccc', fontSize: 13, fontWeight: 500 }}>{player.name}</span>
      {player.isRegular && <span style={{ color: '#c9a84c', fontSize: 10 }}>★</span>}
    </div>
  );
}
