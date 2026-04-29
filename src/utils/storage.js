const KEYS = {
  EVENTS: 'poker_events',
  SETTINGS: 'poker_settings',
  PLAYER: 'poker_player',
  PLAYERS: 'poker_players',
};

const DEFAULT_SETTINGS = {
  groupName: 'חבורת הפוקר',
  recurringDay: 3,
  defaultTime: '21:00',
  defaultLocation: '',
  defaultMaxSeats: 9,
};

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('localStorage write failed', e);
  }
}

function loadPlayers() {
  const existing = safeGet(KEYS.PLAYERS, null);
  if (existing !== null) return existing;
  // migrate from old poker_regular_players key
  const old = safeGet('poker_regular_players', []);
  const migrated = old.map((p, i) => ({
    id: String(Date.now() + i),
    name: p.name,
    phone: p.phone || '',
    isRegular: true,
  }));
  safeSet(KEYS.PLAYERS, migrated);
  return migrated;
}

export const storage = {
  getEvents: () => safeGet(KEYS.EVENTS, []),
  setEvents: (events) => safeSet(KEYS.EVENTS, events),

  getSettings: () => ({ ...DEFAULT_SETTINGS, ...safeGet(KEYS.SETTINGS, {}) }),
  setSettings: (settings) => safeSet(KEYS.SETTINGS, settings),

  getPlayer: () => safeGet(KEYS.PLAYER, null),
  setPlayer: (player) => safeSet(KEYS.PLAYER, player),
  clearPlayer: () => localStorage.removeItem(KEYS.PLAYER),

  getPlayers: () => loadPlayers(),
  setPlayers: (players) => safeSet(KEYS.PLAYERS, players),
};
