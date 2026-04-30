import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient.js';
import { storage } from '../utils/storage.js';
import { generateId, formatDate, daysUntilLabel, isPast, addDays } from '../utils/dates.js';
import {
  fetchCurrentGame, fetchSettings,
  upsertEvent, syncRegistrations,
  upsertRegistration, updateRegistrationStatus,
} from '../utils/db.js';
import PokerTable from './PokerTable.jsx';

const STATUS_LABELS = {
  'מגיע':     { label: 'מגיע',     emoji: '✓', color: '#27ae60', bg: '#0a2e16', border: '#1a5e30' },
  'לא מגיע':  { label: 'לא מגיע',  emoji: '✕', color: '#c0392b', bg: '#2e0a0a', border: '#5e1a1a' },
  'אולי':     { label: 'אולי',     emoji: '?', color: '#e67e22', bg: '#2e1c00', border: '#5e3a00' },
};

export default function PlayerView({ currentEventId }) {
  const [event, setEvent]           = useState(null);
  const [settings, setSettings]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [savedPlayer, setSavedPlayer] = useState(null);
  const [regName, setRegName]       = useState('');
  const [regPhone, setRegPhone]     = useState('');
  const [regStatus, setRegStatus]   = useState('מגיע');
  const [regError, setRegError]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);

  // ─── Load player identity from localStorage ────────────────────────────────

  useEffect(() => {
    setSavedPlayer(storage.getPlayer());
  }, []);

  // ─── Fetch game + settings from Supabase ──────────────────────────────────

  const loadGame = useCallback(async () => {
    try {
      const [gameData, settingsData] = await Promise.all([
        fetchCurrentGame(currentEventId || null),
        fetchSettings(),
      ]);

      setSettings(settingsData);

      if (!gameData) {
        setEvent(null);
        return;
      }

      // Auto-advance recurring events whose date has passed
      if (gameData.type === 'recurring' && isPast(gameData.date)) {
        let newDate = gameData.date;
        while (isPast(newDate)) newDate = addDays(newDate, 7);
        const regularRegs = gameData.registrations
          .filter((r) => r.isRegular)
          .map((r) => ({ ...r, status: 'ממתין לאישור' }));
        const advanced = { ...gameData, date: newDate, registrations: regularRegs };
        await upsertEvent(advanced);
        await syncRegistrations(advanced.id, gameData.registrations, regularRegs);
        setEvent(advanced);
      } else {
        setEvent(gameData);
      }
    } catch (err) {
      console.error('PlayerView: failed to load game', err);
      setEvent(null);
      setSettings({ groupName: 'פוקר', adminPassword: '1001' });
    } finally {
      setLoading(false);
    }
  }, [currentEventId]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  // ─── Real-time: re-fetch registrations when they change ───────────────────

  useEffect(() => {
    if (!event?.id) return;

    const channel = supabase
      .channel(`player-regs-${event.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registrations', filter: `event_id=eq.${event.id}` },
        async () => {
          const { data, error } = await supabase
            .from('registrations')
            .select('*')
            .eq('event_id', event.id);
          if (!error && data) {
            setEvent((prev) =>
              prev
                ? {
                    ...prev,
                    registrations: data.map((r) => ({
                      id: r.id,
                      name: r.name,
                      phone: r.phone || '',
                      status: r.status,
                      isRegular: r.is_regular,
                      joinedAt: r.joined_at,
                    })),
                  }
                : prev
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [event?.id]);

  // ─── Derived state ─────────────────────────────────────────────────────────

  const confirmedCount = event
    ? event.registrations.filter((r) => r.status === 'מגיע').length
    : 0;
  const isFull     = event ? confirmedCount >= event.maxSeats : false;
  const remaining  = event ? Math.max(0, event.maxSeats - confirmedCount) : 0;
  const myReg      = event && savedPlayer
    ? event.registrations.find((r) => r.name === savedPlayer.name) || null
    : null;

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleRegister = async () => {
    if (!regName.trim()) { setRegError('נא להזין שם'); return; }
    if (!event) return;
    setSubmitting(true);
    try {
      const newPlayer = { name: regName.trim(), phone: regPhone.trim() };
      storage.setPlayer(newPlayer);
      setSavedPlayer(newPlayer);

      const existing = event.registrations.find((r) => r.name === newPlayer.name);
      if (existing) {
        const newStatus = regStatus === 'מגיע' && isFull ? 'ממתין לאישור' : regStatus;
        await updateRegistrationStatus(existing.id, newStatus);
        setEvent((prev) => ({
          ...prev,
          registrations: prev.registrations.map((r) =>
            r.id === existing.id ? { ...r, status: newStatus } : r
          ),
        }));
      } else {
        const reg = {
          id: generateId(),
          name: newPlayer.name,
          phone: newPlayer.phone,
          status: regStatus === 'מגיע' && isFull ? 'ממתין לאישור' : regStatus,
          isRegular: false,
          joinedAt: new Date().toISOString(),
        };
        await upsertRegistration(reg, event.id);
        setEvent((prev) => ({
          ...prev,
          registrations: [...prev.registrations, reg],
        }));
      }

      setRegName('');
      setRegPhone('');
      setJustUpdated(true);
      setTimeout(() => setJustUpdated(false), 3000);
    } catch (err) {
      console.error('Registration failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickUpdate = async (status) => {
    if (!event || !savedPlayer) return;
    setJustUpdated(false);

    const existing = event.registrations.find((r) => r.name === savedPlayer.name);
    try {
      if (existing) {
        // No isFull check for existing registrations (mirrors original behaviour)
        await updateRegistrationStatus(existing.id, status);
        setEvent((prev) => ({
          ...prev,
          registrations: prev.registrations.map((r) =>
            r.id === existing.id ? { ...r, status } : r
          ),
        }));
      } else {
        const newReg = {
          id: generateId(),
          name: savedPlayer.name,
          phone: savedPlayer.phone || '',
          status: status === 'מגיע' && isFull ? 'ממתין לאישור' : status,
          isRegular: false,
          joinedAt: new Date().toISOString(),
        };
        await upsertRegistration(newReg, event.id);
        setEvent((prev) => ({
          ...prev,
          registrations: [...prev.registrations, newReg],
        }));
      }
      setJustUpdated(true);
      setTimeout(() => setJustUpdated(false), 3000);
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  const handleForgetMe = () => {
    storage.clearPlayer();
    setSavedPlayer(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0a0a0a', color: '#888',
        fontSize: 16, fontFamily: 'Heebo, sans-serif',
      }}>
        <span className="pulse">טוען...</span>
      </div>
    );
  }

  if (!event) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0a',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 24, textAlign: 'center',
        fontFamily: 'Heebo, sans-serif', direction: 'rtl',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16, color: '#2a2a2a' }}>♠</div>
        <h2 style={{ color: '#f0f0f0', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
          {settings?.groupName || 'פוקר'}
        </h2>
        <p style={{ color: '#666', fontSize: 15, margin: 0 }}>עדיין לא נפתח משחק</p>
        <p style={{ color: '#444', fontSize: 13, marginTop: 6 }}>בדקו שוב בקרוב 🃏</p>
      </div>
    );
  }

  const s = { bg: '#0a0a0a', card: '#141414', border: '#1e1e1e' };

  return (
    <div style={{ minHeight: '100vh', background: s.bg, fontFamily: 'Heebo, sans-serif', direction: 'rtl' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)',
        borderBottom: `1px solid ${s.border}`,
        padding: '20px 20px 0',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, color: '#c9a84c', marginBottom: 4 }}>♠</div>
        <h1 style={{ color: '#f0f0f0', fontSize: 20, fontWeight: 800, margin: '0 0 2px' }}>
          {settings?.groupName}
        </h1>
        <p style={{ color: '#555', fontSize: 13, margin: '0 0 16px' }}>הרשמה למשחק</p>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>

        {/* Event info card */}
        <div style={{
          background: s.card, border: `1px solid ${s.border}`,
          borderRadius: 14, padding: '20px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <span style={{ color: '#555', fontSize: 12, fontWeight: 600 }}>
                {daysUntilLabel(event.date)}
              </span>
              <h2 style={{ color: '#f0f0f0', fontSize: 18, fontWeight: 800, margin: '2px 0 6px' }}>
                {formatDate(event.date)}
              </h2>
              <p style={{ color: '#666', fontSize: 14, margin: 0 }}>
                🕘 {event.time}
                {event.location && <> · 📍 {event.location}</>}
              </p>
            </div>
            <div style={{ textAlign: 'left', flexShrink: 0 }}>
              <div style={{ color: isFull ? '#c0392b' : '#c9a84c', fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                {confirmedCount}/{event.maxSeats}
              </div>
              <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>
                {isFull ? 'אין מקום' : `נותרו ${remaining}`}
              </div>
            </div>
          </div>
        </div>

        {/* Returning player greeting */}
        {savedPlayer && (
          <div style={{
            background: s.card, border: `1px solid ${s.border}`,
            borderRadius: 14, padding: '20px', marginBottom: 16,
            animation: 'fadeIn 0.3s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <p style={{ color: '#f0f0f0', fontSize: 17, fontWeight: 700, margin: '0 0 2px' }}>
                  היי {savedPlayer.name} 👋
                </p>
                <p style={{ color: '#666', fontSize: 13, margin: 0 }}>
                  {myReg
                    ? <>הסטטוס שלך: <StatusBadge status={myReg.status} /></>
                    : 'טרם נרשמת למשחק הזה'}
                </p>
              </div>
              <button
                onClick={handleForgetMe}
                style={{ background: 'transparent', color: '#444', border: 'none', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
              >
                זה לא אני
              </button>
            </div>

            {justUpdated && (
              <div style={{
                marginTop: 12, padding: '8px 14px',
                background: '#0a2e16', border: '1px solid #1a5e30',
                borderRadius: 8, color: '#27ae60', fontSize: 13, fontWeight: 600,
              }}>
                ✓ הסטטוס עודכן בהצלחה
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              {Object.entries(STATUS_LABELS).map(([key, meta]) => {
                const isActive = myReg?.status === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleQuickUpdate(key)}
                    style={{
                      flex: 1, minWidth: 90, padding: '12px 8px',
                      background: isActive ? meta.bg : '#0f0f0f',
                      color: isActive ? meta.color : '#777',
                      border: `2px solid ${isActive ? meta.border : '#1e1e1e'}`,
                      borderRadius: 10, fontSize: 15, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 18 }}>{meta.emoji}</div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>{meta.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* New player registration form */}
        {!savedPlayer && (
          <div style={{
            background: s.card, border: `1px solid ${s.border}`,
            borderRadius: 14, padding: '20px', marginBottom: 16,
            animation: 'fadeIn 0.3s ease',
          }}>
            <p style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 16, margin: '0 0 4px' }}>
              הצטרפות למשחק
            </p>
            <p style={{ color: '#666', fontSize: 14, margin: '0 0 16px' }}>
              הזינו את שמכם כדי להירשם
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', color: '#777', fontSize: 13, marginBottom: 5 }}>שם מלא *</label>
                <input
                  value={regName}
                  onChange={(e) => { setRegName(e.target.value); setRegError(''); }}
                  placeholder="ישראל ישראלי"
                  style={{
                    width: '100%', padding: '12px 14px', background: '#0f0f0f',
                    border: `1px solid ${regError ? '#8b2020' : '#2a2a2a'}`,
                    borderRadius: 10, color: '#f0f0f0', fontSize: 15,
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                {regError && <p style={{ color: '#c0392b', fontSize: 12, marginTop: 4 }}>{regError}</p>}
              </div>
              <div>
                <label style={{ display: 'block', color: '#777', fontSize: 13, marginBottom: 5 }}>טלפון (אופציונלי)</label>
                <input
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="050-0000000"
                  type="tel"
                  style={{
                    width: '100%', padding: '12px 14px', background: '#0f0f0f',
                    border: '1px solid #2a2a2a', borderRadius: 10, color: '#f0f0f0',
                    fontSize: 15, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#777', fontSize: 13, marginBottom: 8 }}>הגעה</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Object.entries(STATUS_LABELS).map(([key, meta]) => (
                    <button
                      key={key}
                      onClick={() => setRegStatus(key)}
                      style={{
                        flex: 1, padding: '11px 4px',
                        background: regStatus === key ? meta.bg : '#0f0f0f',
                        color: regStatus === key ? meta.color : '#666',
                        border: `2px solid ${regStatus === key ? meta.border : '#1e1e1e'}`,
                        borderRadius: 10, fontSize: 14, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                        transition: 'all 0.15s',
                      }}
                    >
                      {meta.label}
                    </button>
                  ))}
                </div>
              </div>

              {isFull && regStatus === 'מגיע' && (
                <div style={{
                  padding: '10px 14px', background: '#2e0a0a',
                  border: '1px solid #5e1a1a', borderRadius: 8, color: '#e07070', fontSize: 13,
                }}>
                  ⚠️ המשחק מלא — תרשמו לרשימת המתנה
                </div>
              )}

              <button
                onClick={handleRegister}
                disabled={submitting}
                style={{
                  padding: '14px', background: submitting ? '#8a6f28' : '#c9a84c',
                  color: '#0a0a0a', border: 'none', borderRadius: 10,
                  fontSize: 16, fontWeight: 800,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'Heebo, sans-serif', transition: 'background 0.2s',
                }}
              >
                {submitting ? 'שומר...' : 'אישור הגעה'}
              </button>
            </div>
          </div>
        )}

        {/* Poker table */}
        {event.registrations.length > 0 && (
          <div style={{
            background: s.card, border: `1px solid ${s.border}`,
            borderRadius: 14, padding: '20px', marginBottom: 16,
          }}>
            <h3 style={{ color: '#f0f0f0', fontSize: 15, fontWeight: 700, margin: '0 0 16px' }}>
              שולחן המשחק
            </h3>
            <PokerTable registrations={event.registrations} maxSeats={event.maxSeats} />
          </div>
        )}

        {/* Player list */}
        {event.registrations.length > 0 && (
          <div style={{
            background: s.card, border: `1px solid ${s.border}`,
            borderRadius: 14, padding: '20px',
          }}>
            <h3 style={{ color: '#f0f0f0', fontSize: 15, fontWeight: 700, margin: '0 0 16px' }}>
              כל השחקנים ({event.registrations.length})
            </h3>
            {event.registrations
              .slice()
              .sort((a, b) => {
                const order = { 'מגיע': 0, 'אולי': 1, 'ממתין לאישור': 2, 'לא מגיע': 3 };
                return (order[a.status] ?? 4) - (order[b.status] ?? 4);
              })
              .map((reg, i) => {
                const isMine = savedPlayer && reg.name === savedPlayer.name;
                return (
                  <div key={reg.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 9, marginBottom: 5,
                    background: isMine ? '#1a1a2a' : '#0f0f0f',
                    border: `1px solid ${isMine ? '#2a2a5a' : 'transparent'}`,
                  }}>
                    <span style={{ color: '#555', fontSize: 12, width: 20, textAlign: 'center', flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <span style={{ flex: 1, color: isMine ? '#c9a84c' : '#d0d0d0', fontSize: 14, fontWeight: isMine ? 700 : 500 }}>
                      {reg.name}
                      {isMine && <span style={{ color: '#c9a84c', fontSize: 11, marginRight: 6 }}>(אני)</span>}
                      {reg.isRegular && <span style={{ color: '#c9a84c', fontSize: 11, marginRight: 4 }}>★</span>}
                    </span>
                    <StatusBadge status={reg.status} />
                  </div>
                );
              })}
          </div>
        )}

      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    'מגיע':           { color: '#27ae60', bg: '#0a2e16' },
    'לא מגיע':        { color: '#c0392b', bg: '#2e0a0a' },
    'אולי':           { color: '#e67e22', bg: '#2e1c00' },
    'ממתין לאישור':   { color: '#888',    bg: '#1a1a1a' },
  };
  const c = map[status] || map['ממתין לאישור'];
  return (
    <span style={{
      background: c.bg, color: c.color,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}
