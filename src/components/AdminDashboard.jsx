import { useState, useCallback } from 'react';
import { generateId, formatDate, daysUntilLabel, isPast } from '../utils/dates.js';
import EventForm from './EventForm.jsx';
import PokerTable from './PokerTable.jsx';

const STATUS_COLOR = {
  'מגיע': '#27ae60',
  'לא מגיע': '#c0392b',
  'אולי': '#e67e22',
  'ממתין לאישור': '#888',
};
const STATUS_BG = {
  'מגיע': '#0d3a1e',
  'לא מגיע': '#3a0d0d',
  'אולי': '#2e1c00',
  'ממתין לאישור': '#1c1c1c',
};

const STATUSES = ['מגיע', 'לא מגיע', 'אולי', 'ממתין לאישור'];

function getConfirmed(event) {
  const coming = event.registrations
    .filter((r) => r.status === 'מגיע')
    .sort((a, b) => new Date(a.joinedAt || 0) - new Date(b.joinedAt || 0));
  return coming.slice(0, event.maxSeats);
}

function getWaitlist(event) {
  const coming = event.registrations
    .filter((r) => r.status === 'מגיע')
    .sort((a, b) => new Date(a.joinedAt || 0) - new Date(b.joinedAt || 0));
  return coming.slice(event.maxSeats);
}

export default function AdminDashboard({ events = [], settings, players = [], onSaveEvents, onSaveSettings, onSavePlayers, onLogout }) {
  const [showEventForm, setShowEventForm] = useState(false);
  const [formType, setFormType] = useState('recurring');
  const [editingEvent, setEditingEvent] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedTab, setExpandedTab] = useState('players');
  const [addingToId, setAddingToId] = useState(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newStatus, setNewStatus] = useState('מגיע');
  const [newIsRegular, setNewIsRegular] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState(settings);
  const [showPast, setShowPast] = useState(false);

  // ─── Players management state ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('events');
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPhone, setNewPlayerPhone] = useState('');
  const [newPlayerIsRegular, setNewPlayerIsRegular] = useState(true);

  const upcoming = events
    .filter((e) => !isPast(e.date))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const past = events
    .filter((e) => isPast(e.date))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // ─── Event CRUD ───────────────────────────────────────────────────────────

  const openCreate = (type) => {
    setFormType(type);
    setEditingEvent(null);
    setShowEventForm(true);
  };

  const openEdit = (event) => {
    setFormType(event.type);
    setEditingEvent(event);
    setShowEventForm(true);
  };

  const handleSaveEvent = useCallback((formData) => {
    let next;
    if (editingEvent) {
      next = events.map((e) => (e.id === editingEvent.id ? { ...e, ...formData } : e));
    } else {
      const regularPlayers = players.filter((p) => p.isRegular);
      const autoRegs = regularPlayers.map((p) => ({
        id: generateId(),
        name: p.name,
        phone: p.phone || '',
        status: 'ממתין לאישור',
        isRegular: true,
        joinedAt: new Date().toISOString(),
      }));
      next = [
        ...events,
        {
          id: generateId(),
          ...formData,
          registrations: formData.type === 'recurring' ? autoRegs : [],
        },
      ];
    }
    onSaveEvents(next);
    setShowEventForm(false);
    setEditingEvent(null);
  }, [editingEvent, events, players, onSaveEvents]);

  const handleDeleteEvent = (id) => {
    if (!window.confirm('למחוק את המשחק? פעולה זו אינה הפיכה.')) return;
    onSaveEvents(events.filter((e) => e.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  // ─── Player management ────────────────────────────────────────────────────

  const updateEvent = useCallback((id, updater) => {
    onSaveEvents(events.map((e) => (e.id === id ? updater(e) : e)));
  }, [events, onSaveEvents]);

  const handleAddPlayer = (eventId) => {
    if (!newName.trim()) return;
    const playerName = newName.trim();
    const playerPhone = newPhone.trim();

    if (newIsRegular) {
      const exists = players.find((p) => p.name === playerName);
      const updatedPlayers = exists
        ? players.map((p) => p.name === playerName ? { ...p, isRegular: true } : p)
        : [...players, { id: generateId(), name: playerName, phone: playerPhone, isRegular: true }];
      onSavePlayers(updatedPlayers);
    }

    const reg = {
      id: generateId(),
      name: playerName,
      phone: playerPhone,
      status: newStatus,
      isRegular: newIsRegular,
      joinedAt: new Date().toISOString(),
    };
    updateEvent(eventId, (e) => ({ ...e, registrations: [...e.registrations, reg] }));
    setNewName('');
    setNewPhone('');
    setNewStatus('מגיע');
    setNewIsRegular(false);
    setAddingToId(null);
  };

  const handleDeletePlayer = (eventId, playerId) => {
    updateEvent(eventId, (e) => ({
      ...e,
      registrations: e.registrations.filter((r) => r.id !== playerId),
    }));
  };

  const handleStatusChange = (eventId, playerId, status) => {
    updateEvent(eventId, (e) => ({
      ...e,
      registrations: e.registrations.map((r) =>
        r.id === playerId ? { ...r, status } : r
      ),
    }));
  };

  const handleToggleRegular = (eventId, playerId) => {
    updateEvent(eventId, (e) => {
      const target = e.registrations.find((r) => r.id === playerId);
      if (!target) return e;
      const nowRegular = !target.isRegular;
      const exists = players.find((p) => p.name === target.name);
      const updatedPlayers = exists
        ? players.map((p) => p.name === target.name ? { ...p, isRegular: nowRegular } : p)
        : [...players, { id: generateId(), name: target.name, phone: target.phone || '', isRegular: nowRegular }];
      onSavePlayers(updatedPlayers);
      return {
        ...e,
        registrations: e.registrations.map((r) =>
          r.id === playerId ? { ...r, isRegular: nowRegular } : r
        ),
      };
    });
  };

  // ─── Global Players Management ────────────────────────────────────────────

  const savePlayers = (updated) => onSavePlayers(updated);

  const handleAddGlobalPlayer = () => {
    if (!newPlayerName.trim()) return;
    savePlayers([...players, {
      id: generateId(),
      name: newPlayerName.trim(),
      phone: newPlayerPhone.trim(),
      isRegular: newPlayerIsRegular,
    }]);
    setNewPlayerName('');
    setNewPlayerPhone('');
    setNewPlayerIsRegular(true);
    setAddingPlayer(false);
  };

  const handleDeleteGlobalPlayer = (id) => {
    savePlayers(players.filter((p) => p.id !== id));
  };

  const handleToggleGlobalRegular = (id) => {
    savePlayers(players.map((p) => p.id === id ? { ...p, isRegular: !p.isRegular } : p));
  };

  // ─── Link copy ────────────────────────────────────────────────────────────

  const copyLink = (eventId) => {
    const base = window.location.origin + window.location.pathname;
    const url = eventId ? `${base}?event=${eventId}` : `${base}?player=1`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(eventId || '__group__');
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  // ─── Settings ─────────────────────────────────────────────────────────────

  const saveSettings = () => {
    onSaveSettings(settingsForm);
    setShowSettings(false);
  };

  // ─── Styles ──────────────────────────────────────────────────────────────

  const inputSt = {
    background: '#0f0f0f',
    border: '1px solid #2a2a2a',
    borderRadius: 9,
    padding: '10px 12px',
    color: '#f0f0f0',
    fontFamily: 'Heebo, sans-serif',
    fontSize: 14,
    outline: 'none',
  };

  const btnGold = {
    padding: '9px 18px', background: '#c9a84c', color: '#0a0a0a',
    border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
  };
  const btnGhost = {
    padding: '9px 16px', background: 'transparent', color: '#777',
    border: '1px solid #2a2a2a', borderRadius: 9, fontSize: 14,
    cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
  };
  const btnDark = {
    padding: '9px 16px', background: '#1e1e1e', color: '#d0d0d0',
    border: '1px solid #2a2a2a', borderRadius: 9, fontSize: 14,
    cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
  };

  // ─── Player row ───────────────────────────────────────────────────────────

  const renderPlayerRow = (event, reg, note) => (
    <div key={reg.id} style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: '10px 12px',
      background: '#0f0f0f',
      borderRadius: 9,
      marginBottom: 5,
      borderRight: `3px solid ${STATUS_COLOR[reg.status] || '#333'}`,
    }}>
      <div style={{ flex: 1, minWidth: 100 }}>
        <span style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 14 }}>
          {reg.name}
        </span>
        {reg.isRegular && (
          <span style={{ color: '#c9a84c', fontSize: 11, marginRight: 6 }}>★ קבוע</span>
        )}
        {note && (
          <span style={{ color: '#c0392b', fontSize: 11, marginRight: 6 }}>({note})</span>
        )}
        {reg.phone && (
          <div style={{ color: '#555', fontSize: 12, marginTop: 1 }}>{reg.phone}</div>
        )}
      </div>

      <select
        value={reg.status}
        onChange={(e) => handleStatusChange(event.id, reg.id, e.target.value)}
        style={{
          ...inputSt,
          padding: '5px 8px',
          background: STATUS_BG[reg.status] || '#1a1a1a',
          color: STATUS_COLOR[reg.status] || '#888',
          border: 'none',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <button
        onClick={() => handleToggleRegular(event.id, reg.id)}
        title={reg.isRegular ? 'הסר מקבועים' : 'סמן כשחקן קבוע'}
        style={{
          background: reg.isRegular ? '#2a1e00' : 'transparent',
          color: reg.isRegular ? '#c9a84c' : '#3a3a3a',
          border: `1px solid ${reg.isRegular ? '#4a3500' : '#252525'}`,
          borderRadius: 7,
          padding: '5px 8px',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        ★
      </button>

      <button
        onClick={() => handleDeletePlayer(event.id, reg.id)}
        style={{
          background: 'transparent', color: '#3a3a3a',
          border: '1px solid #252525', borderRadius: 7,
          padding: '5px 8px', cursor: 'pointer', fontSize: 13,
        }}
      >
        🗑
      </button>
    </div>
  );

  // ─── Event card ──────────────────────────────────────────────────────────

  const renderEventCard = (event, isPastEvent) => {
    const confirmed = getConfirmed(event);
    const waitlist = getWaitlist(event);
    const maybe = event.registrations.filter((r) => r.status === 'אולי');
    const notComing = event.registrations.filter((r) => r.status === 'לא מגיע');
    const pending = event.registrations.filter((r) => r.status === 'ממתין לאישור');
    const isExpanded = expandedId === event.id;
    const remaining = event.maxSeats - confirmed.length;

    return (
      <div key={event.id} className="card-hover" style={{
        background: '#141414',
        border: '1px solid #252525',
        borderRadius: 14,
        marginBottom: 14,
        overflow: 'hidden',
        opacity: isPastEvent ? 0.55 : 1,
        transition: 'border-color 0.2s',
      }}>
        {/* Header (clickable) */}
        <div
          onClick={() => setExpandedId(isExpanded ? null : event.id)}
          style={{ padding: '18px 20px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                  color: event.type === 'recurring' ? '#27ae60' : '#8b7cc9',
                  background: event.type === 'recurring' ? '#0a2e16' : '#1a1530',
                  padding: '3px 10px', borderRadius: 20,
                }}>
                  {event.type === 'recurring' ? '↺ שבועי' : '✦ חד-פעמי'}
                </span>
                {!isPastEvent && (
                  <span style={{ fontSize: 11, color: '#888' }}>
                    {daysUntilLabel(event.date)}
                  </span>
                )}
              </div>
              <h3 style={{ color: '#f0f0f0', fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>
                {formatDate(event.date)}
              </h3>
              <p style={{ color: '#666', fontSize: 13, margin: 0 }}>
                {event.time} · {event.location || 'מיקום לא הוגדר'}
              </p>
            </div>

            <div style={{ textAlign: 'left', flexShrink: 0 }}>
              <div style={{ color: remaining > 0 ? '#c9a84c' : '#c0392b', fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                {confirmed.length}/{event.maxSeats}
              </div>
              <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>
                {remaining > 0 ? `נותרו ${remaining}` : 'מלא'}
              </div>
            </div>
          </div>

          {/* Status summary */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {confirmed.length > 0 && <Pill color="#27ae60" bg="#0a2e16">✓ {confirmed.length} מגיעים</Pill>}
            {maybe.length > 0 && <Pill color="#e67e22" bg="#2e1c00">? {maybe.length} אולי</Pill>}
            {pending.length > 0 && <Pill color="#888" bg="#1a1a1a">⏳ {pending.length} ממתינים</Pill>}
            {waitlist.length > 0 && <Pill color="#c0392b" bg="#3a0a0a">📋 המתנה {waitlist.length}</Pill>}
          </div>
        </div>

        {/* Action bar */}
        <div style={{
          borderTop: '1px solid #1e1e1e', padding: '10px 20px',
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <button
            onClick={() => copyLink(event.id)}
            style={btnGhost}
          >
            {copiedId === event.id ? '✓ הועתק!' : '🔗 העתק קישור'}
          </button>
          {!isPastEvent && (
            <>
              <button onClick={() => openEdit(event)} style={btnDark}>✏️ עריכה</button>
              <button
                onClick={() => { setAddingToId(event.id); setExpandedId(event.id); }}
                style={btnDark}
              >
                + הוסף שחקן
              </button>
            </>
          )}
          <button
            onClick={() => handleDeleteEvent(event.id)}
            style={{ ...btnGhost, color: '#8b2020', borderColor: '#3a1010', marginRight: 'auto' }}
          >
            🗑 מחק
          </button>
          <button
            onClick={() => setExpandedId(isExpanded ? null : event.id)}
            style={{ ...btnGhost, padding: '9px 12px' }}
          >
            {isExpanded ? '▲' : '▼'}
          </button>
        </div>

        {/* Expanded body */}
        {isExpanded && (
          <div style={{ borderTop: '1px solid #1e1e1e', padding: '20px' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #1e1e1e', paddingBottom: 12 }}>
              {['players', 'table'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setExpandedTab(tab)}
                  style={{
                    padding: '6px 16px',
                    background: expandedTab === tab ? '#c9a84c' : 'transparent',
                    color: expandedTab === tab ? '#0a0a0a' : '#777',
                    border: expandedTab === tab ? 'none' : '1px solid #252525',
                    borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                  }}
                >
                  {tab === 'players' ? 'שחקנים' : 'שולחן'}
                </button>
              ))}
            </div>

            {expandedTab === 'table' && (
              <PokerTable registrations={event.registrations} maxSeats={event.maxSeats} />
            )}

            {expandedTab === 'players' && (
              <>
                {/* Add player form */}
                {addingToId === event.id && (
                  <div style={{
                    background: '#0f0f0f', border: '1px solid #252525',
                    borderRadius: 10, padding: 16, marginBottom: 20,
                  }}>
                    <p style={{ color: '#aaa', fontSize: 14, margin: '0 0 12px', fontWeight: 600 }}>הוספת שחקן ידנית</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <input
                        placeholder="שם מלא *"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer(event.id)}
                        style={{ ...inputSt, flex: 2, minWidth: 120 }}
                      />
                      <input
                        placeholder="טלפון"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        style={{ ...inputSt, flex: 1, minWidth: 100 }}
                      />
                      <button
                        type="button"
                        onClick={() => setNewIsRegular((v) => !v)}
                        title="שחקן קבוע — יישאר בכל שבוע"
                        style={{
                          background: newIsRegular ? '#2a1e00' : 'transparent',
                          color: newIsRegular ? '#c9a84c' : '#3a3a3a',
                          border: `1px solid ${newIsRegular ? '#4a3500' : '#252525'}`,
                          borderRadius: 7, padding: '8px 10px',
                          cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
                          fontFamily: 'Heebo, sans-serif',
                        }}
                      >
                        ★ קבוע
                      </button>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        style={{ ...inputSt, minWidth: 110 }}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button onClick={() => handleAddPlayer(event.id)} style={btnGold}>הוסף</button>
                      <button onClick={() => setAddingToId(null)} style={btnGhost}>ביטול</button>
                    </div>
                  </div>
                )}

                {/* Player sections */}
                {confirmed.length > 0 && (
                  <Section title={`✓ מגיעים (${confirmed.length}/${event.maxSeats})`} color="#27ae60">
                    {confirmed.map((r) => renderPlayerRow(event, r))}
                  </Section>
                )}
                {waitlist.length > 0 && (
                  <Section title={`📋 רשימת המתנה (${waitlist.length})`} color="#c0392b">
                    {waitlist.map((r, i) => renderPlayerRow(event, r, `מקום ${i + 1} בהמתנה`))}
                  </Section>
                )}
                {maybe.length > 0 && (
                  <Section title={`? אולי (${maybe.length})`} color="#e67e22">
                    {maybe.map((r) => renderPlayerRow(event, r))}
                  </Section>
                )}
                {pending.length > 0 && (
                  <Section title={`⏳ ממתינים לאישור (${pending.length})`} color="#888">
                    {pending.map((r) => renderPlayerRow(event, r))}
                  </Section>
                )}
                {notComing.length > 0 && (
                  <Section title={`✗ לא מגיעים (${notComing.length})`} color="#555">
                    {notComing.map((r) => renderPlayerRow(event, r))}
                  </Section>
                )}
                {event.registrations.length === 0 && (
                  <p style={{ color: '#444', textAlign: 'center', padding: '24px 0', fontSize: 14 }}>
                    אין שחקנים רשומים עדיין
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'Heebo, sans-serif', direction: 'rtl' }}>
      {/* Header */}
      <header style={{
        background: '#111', borderBottom: '1px solid #1e1e1e',
        padding: '14px 20px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#c9a84c', fontSize: 22 }}>♠</span>
          <div>
            <div style={{ color: '#f0f0f0', fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>
              {settings.groupName}
            </div>
            <div style={{ color: '#555', fontSize: 11 }}>לוח ניהול</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => copyLink(null)}
            style={btnGhost}
          >
            {copiedId === '__group__' ? '✓ הועתק!' : '🔗 קישור כללי'}
          </button>
          <button onClick={() => { setSettingsForm(settings); setShowSettings(true); }} style={btnDark}>
            ⚙️
          </button>
          <button onClick={onLogout} style={btnGhost}>יציאה</button>
        </div>
      </header>

      <main style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px' }}>
        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid #1e1e1e' }}>
          {[{ id: 'events', label: '📅 משחקים' }, { id: 'players', label: '👥 שחקנים' }].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 22px',
                background: 'transparent',
                color: activeTab === tab.id ? '#c9a84c' : '#555',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab.id ? '#c9a84c' : 'transparent'}`,
                fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Events tab ──────────────────────────────────────────────────── */}
        {activeTab === 'events' && (
          <>
            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
              <button
                onClick={() => openCreate('recurring')}
                style={{
                  padding: '13px 22px', background: '#c9a84c', color: '#0a0a0a',
                  border: 'none', borderRadius: 11, fontSize: 15, fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                ↺ פתח משחק שבועי
              </button>
              <button
                onClick={() => openCreate('oneTime')}
                style={{
                  padding: '13px 22px', background: '#1a1a1a', color: '#f0f0f0',
                  border: '1px solid #2a2a2a', borderRadius: 11, fontSize: 15, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                ✦ משחק חד-פעמי
              </button>
            </div>

            {/* Upcoming */}
            <SectionHeader label="משחקים קרובים" count={upcoming.length} color="#c9a84c" />
            {upcoming.length === 0 ? (
              <EmptyState text="אין משחקים קרובים" sub='לחץ על "פתח משחק שבועי" כדי להתחיל' />
            ) : (
              upcoming.map((e) => renderEventCard(e, false))
            )}

            {/* Past */}
            {past.length > 0 && (
              <>
                <button
                  onClick={() => setShowPast((p) => !p)}
                  style={{ ...btnGhost, marginTop: 24, marginBottom: 12 }}
                >
                  {showPast ? '▲ הסתר' : '▼ הצג'} משחקים שעברו ({past.length})
                </button>
                {showPast && past.map((e) => renderEventCard(e, true))}
              </>
            )}
          </>
        )}

        {/* ── Players tab ──────────────────────────────────────────────────── */}
        {activeTab === 'players' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <SectionHeader label="ניהול שחקנים" count={players.length} color="#c9a84c" />
              <button onClick={() => setAddingPlayer(true)} style={btnGold}>+ הוסף שחקן</button>
            </div>

            {addingPlayer && (
              <div style={{
                background: '#0f0f0f', border: '1px solid #252525',
                borderRadius: 10, padding: 16, marginBottom: 20,
              }}>
                <p style={{ color: '#aaa', fontSize: 14, margin: '0 0 12px', fontWeight: 600 }}>הוספת שחקן</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <input
                    placeholder="שם מלא *"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddGlobalPlayer()}
                    style={{ ...inputSt, flex: 2, minWidth: 120 }}
                    autoFocus
                  />
                  <input
                    placeholder="טלפון"
                    value={newPlayerPhone}
                    onChange={(e) => setNewPlayerPhone(e.target.value)}
                    style={{ ...inputSt, flex: 1, minWidth: 100 }}
                  />
                  <button
                    onClick={() => setNewPlayerIsRegular((v) => !v)}
                    style={{
                      background: newPlayerIsRegular ? '#2a1e00' : 'transparent',
                      color: newPlayerIsRegular ? '#c9a84c' : '#3a3a3a',
                      border: `1px solid ${newPlayerIsRegular ? '#4a3500' : '#252525'}`,
                      borderRadius: 7, padding: '8px 12px',
                      cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap',
                      fontFamily: 'Heebo, sans-serif',
                    }}
                  >
                    ★ קבוע
                  </button>
                  <button onClick={handleAddGlobalPlayer} style={btnGold}>הוסף</button>
                  <button onClick={() => setAddingPlayer(false)} style={btnGhost}>ביטול</button>
                </div>
              </div>
            )}

            {players.length === 0 ? (
              <EmptyState text="אין שחקנים רשומים" sub='לחץ על "+ הוסף שחקן" כדי להתחיל' />
            ) : (
              players.map((p) => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                  padding: '12px 16px',
                  background: '#141414',
                  border: '1px solid #252525',
                  borderRadius: 10,
                  marginBottom: 8,
                  borderRight: `3px solid ${p.isRegular ? '#c9a84c' : '#333'}`,
                }}>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <span style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                    {p.isRegular && (
                      <span style={{ color: '#c9a84c', fontSize: 11, marginRight: 8 }}>★ קבוע</span>
                    )}
                    {p.phone && (
                      <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{p.phone}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleGlobalRegular(p.id)}
                    title={p.isRegular ? 'הסר מקבועים' : 'סמן כשחקן קבוע'}
                    style={{
                      background: p.isRegular ? '#2a1e00' : 'transparent',
                      color: p.isRegular ? '#c9a84c' : '#3a3a3a',
                      border: `1px solid ${p.isRegular ? '#4a3500' : '#252525'}`,
                      borderRadius: 7, padding: '6px 12px',
                      cursor: 'pointer', fontSize: 13,
                      fontFamily: 'Heebo, sans-serif',
                    }}
                  >
                    ★ {p.isRegular ? 'קבוע' : 'סמן קבוע'}
                  </button>
                  <button
                    onClick={() => handleDeleteGlobalPlayer(p.id)}
                    style={{
                      background: 'transparent', color: '#3a3a3a',
                      border: '1px solid #252525', borderRadius: 7,
                      padding: '6px 8px', cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    🗑
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Event form modal */}
      {showEventForm && (
        <EventForm
          type={formType}
          event={editingEvent}
          settings={settings}
          onSave={handleSaveEvent}
          onClose={() => { setShowEventForm(false); setEditingEvent(null); }}
        />
      )}

      {/* Settings modal */}
      {showSettings && (
        <Modal onClose={() => setShowSettings(false)}>
          <h2 style={{ color: '#f0f0f0', fontSize: 20, fontWeight: 700, margin: '0 0 24px' }}>הגדרות</h2>
          <Field label="שם הקבוצה">
            <input
              value={settingsForm.groupName || ''}
              onChange={(e) => setSettingsForm((s) => ({ ...s, groupName: e.target.value }))}
              style={{ ...inputSt, width: '100%' }}
            />
          </Field>
          <Field label="יום שבועי קבוע">
            <select
              value={settingsForm.recurringDay ?? 3}
              onChange={(e) => setSettingsForm((s) => ({ ...s, recurringDay: Number(e.target.value) }))}
              style={{ ...inputSt, width: '100%' }}
            >
              {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map((d, i) => (
                <option key={i} value={i}>יום {d}</option>
              ))}
            </select>
          </Field>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="שעת ברירת מחדל" style={{ flex: 1 }}>
              <input
                type="time"
                value={settingsForm.defaultTime || '21:00'}
                onChange={(e) => setSettingsForm((s) => ({ ...s, defaultTime: e.target.value }))}
                style={{ ...inputSt, width: '100%' }}
              />
            </Field>
            <Field label="מקסימום שחקנים" style={{ flex: 1 }}>
              <input
                type="number"
                min="2" max="20"
                value={settingsForm.defaultMaxSeats || 9}
                onChange={(e) => setSettingsForm((s) => ({ ...s, defaultMaxSeats: Number(e.target.value) }))}
                style={{ ...inputSt, width: '100%' }}
              />
            </Field>
          </div>
          <Field label="מיקום ברירת מחדל">
            <input
              value={settingsForm.defaultLocation || ''}
              onChange={(e) => setSettingsForm((s) => ({ ...s, defaultLocation: e.target.value }))}
              placeholder="לדוגמה: בית של יוסי"
              style={{ ...inputSt, width: '100%' }}
            />
          </Field>
          <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-start' }}>
            <button onClick={saveSettings} style={btnGold}>שמור</button>
            <button onClick={() => setShowSettings(false)} style={btnGhost}>ביטול</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function Pill({ color, bg, children }) {
  return (
    <span style={{
      background: bg, color, padding: '3px 10px',
      borderRadius: 20, fontSize: 12, fontWeight: 600,
    }}>
      {children}
    </span>
  );
}

function Section({ title, color, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ color, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function SectionHeader({ label, count, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span style={{ color, fontSize: 15, fontWeight: 700 }}>{label}</span>
      {count > 0 && (
        <span style={{
          background: '#1e1e1e', color: '#888',
          fontSize: 12, padding: '2px 8px', borderRadius: 20,
        }}>{count}</span>
      )}
    </div>
  );
}

function EmptyState({ text, sub }) {
  return (
    <div style={{
      background: '#141414', border: '1px solid #1e1e1e', borderRadius: 14,
      padding: '48px 24px', textAlign: 'center', marginBottom: 24,
    }}>
      <div style={{ fontSize: 32, color: '#2a2a2a', marginBottom: 10 }}>♠</div>
      <p style={{ color: '#666', fontSize: 15, margin: '0 0 4px' }}>{text}</p>
      {sub && <p style={{ color: '#444', fontSize: 13, margin: 0 }}>{sub}</p>}
    </div>
  );
}

function Modal({ onClose, children }) {
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)',
      }}
    >
      <div className="slide-down" style={{
        background: '#141414', border: '1px solid #252525',
        borderRadius: 18, padding: 32, width: '100%', maxWidth: 440,
        direction: 'rtl',
      }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, style: s }) {
  return (
    <div style={{ marginBottom: 16, ...s }}>
      <label style={{ display: 'block', color: '#777', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
