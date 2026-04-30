import { supabase } from '../supabaseClient.js';
import { isPast, toLocalDateString } from './dates.js';

// ─── Mappers ──────────────────────────────────────────────────────────────────

function dbEventToJs(row, allRegs) {
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    time: row.time,
    location: row.location || '',
    maxSeats: row.max_seats,
    registrations: allRegs
      .filter((r) => r.event_id === row.id)
      .map(dbRegToJs),
  };
}

function dbRegToJs(r) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone || '',
    status: r.status,
    isRegular: r.is_regular,
    joinedAt: r.joined_at,
  };
}

function dbPlayerToJs(p) {
  return {
    id: p.id,
    name: p.name,
    phone: p.phone || '',
    isRegular: p.is_regular,
  };
}

function dbSettingsToJs(s) {
  return {
    groupName: s.group_name,
    recurringDay: s.recurring_day,
    defaultTime: s.default_time,
    defaultLocation: s.default_location || '',
    defaultMaxSeats: s.default_max_seats,
    adminPassword: s.admin_password || '1001',
  };
}

const DEFAULT_SETTINGS = {
  groupName: 'חבורת הפוקר',
  recurringDay: 3,
  defaultTime: '21:00',
  defaultLocation: '',
  defaultMaxSeats: 9,
  adminPassword: '1001',
};

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchAllEvents() {
  const [eventsRes, regsRes] = await Promise.all([
    supabase.from('events').select('*'),
    supabase.from('registrations').select('*'),
  ]);
  if (eventsRes.error) {
    console.error('[fetchAllEvents] events error:', eventsRes.error);
    throw eventsRes.error;
  }
  if (regsRes.error) {
    console.error('[fetchAllEvents] registrations error:', regsRes.error);
    throw regsRes.error;
  }
  const events = (eventsRes.data || []).map((e) => dbEventToJs(e, regsRes.data || []));
  console.log(`[fetchAllEvents] OK — ${events.length} events, ${regsRes.data?.length ?? 0} regs. Events:`,
    events.map((e) => `${e.id}/${e.type}/${e.date}/${e.registrations.length}regs`));
  return events;
}

export async function fetchAllPlayers() {
  const { data, error } = await supabase.from('players').select('*');
  if (error) throw error;
  return (data || []).map(dbPlayerToJs);
}

export async function fetchSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? dbSettingsToJs(data) : DEFAULT_SETTINGS;
}

// ─── Fetch current game (player-facing) ──────────────────────────────────────

export async function fetchCurrentGame(eventId = null) {
  if (eventId) {
    const [eventRes, regsRes] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).single(),
      supabase.from('registrations').select('*').eq('event_id', eventId),
    ]);
    if (eventRes.error || !eventRes.data) return null;
    return dbEventToJs(eventRes.data, regsRes.data || []);
  }

  // No specific event — find the active recurring game
  const [eventsRes, regsRes] = await Promise.all([
    supabase.from('events').select('*').eq('type', 'recurring'),
    supabase.from('registrations').select('*'),
  ]);
  if (eventsRes.error || !eventsRes.data?.length) return null;

  const all = eventsRes.data.map((e) => dbEventToJs(e, regsRes.data || []));
  all.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Prefer the nearest upcoming; fall back to the most recent past (will be auto-advanced)
  return all.find((e) => !isPast(e.date)) || all[all.length - 1];
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function upsertEvent(event) {
  const payload = {
    id: event.id,
    type: event.type,
    date: event.date,
    time: event.time,
    location: event.location || '',
    max_seats: event.maxSeats,
  };
  console.log('[upsertEvent] upserting:', payload);
  const { error } = await supabase.from('events').upsert(payload);
  if (error) {
    console.error('[upsertEvent] FAILED:', error);
    throw error;
  }
  console.log('[upsertEvent] success for', event.id);
}

export async function deleteEvent(eventId) {
  console.log('[deleteEvent] deleting event:', eventId);
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) {
    console.error('[deleteEvent] FAILED:', error);
    throw error;
  }
}

// ─── Registrations ────────────────────────────────────────────────────────────

export async function syncRegistrations(eventId, oldRegs, newRegs) {
  console.log(`[syncRegistrations] event=${eventId}, oldRegs=${oldRegs.length}, newRegs=${newRegs.length}`);

  const removedIds = oldRegs
    .filter((or) => !newRegs.find((nr) => nr.id === or.id))
    .map((r) => r.id);
  if (removedIds.length > 0) {
    console.log('[syncRegistrations] deleting regs:', removedIds);
    const { error } = await supabase.from('registrations').delete().in('id', removedIds);
    if (error) {
      console.error('[syncRegistrations] delete FAILED:', error);
      throw error;
    }
  }

  const toUpsert = newRegs.filter((nr) => {
    const old = oldRegs.find((or) => or.id === nr.id);
    return !old || JSON.stringify(old) !== JSON.stringify(nr);
  });
  if (toUpsert.length > 0) {
    const rows = toUpsert.map((r) => ({
      id: r.id,
      event_id: eventId,
      name: r.name,
      phone: r.phone || '',
      status: r.status,
      is_regular: r.isRegular,
      joined_at: r.joinedAt,
    }));
    console.log('[syncRegistrations] upserting regs:', rows.map((r) => `${r.name}/${r.status}`));
    const { error } = await supabase.from('registrations').upsert(rows);
    if (error) {
      console.error('[syncRegistrations] upsert FAILED:', error);
      throw error;
    }
  }
  console.log('[syncRegistrations] done for event', eventId);
}

export async function upsertRegistration(reg, eventId) {
  const { error } = await supabase.from('registrations').upsert({
    id: reg.id,
    event_id: eventId,
    name: reg.name,
    phone: reg.phone || '',
    status: reg.status,
    is_regular: reg.isRegular,
    joined_at: reg.joinedAt,
  });
  if (error) throw error;
}

export async function updateRegistrationStatus(regId, status) {
  const { error } = await supabase
    .from('registrations')
    .update({ status })
    .eq('id', regId);
  if (error) throw error;
}

// ─── Players ──────────────────────────────────────────────────────────────────

export async function syncPlayers(oldPlayers, newPlayers) {
  const removedIds = oldPlayers
    .filter((op) => !newPlayers.find((np) => np.id === op.id))
    .map((p) => p.id);
  if (removedIds.length > 0) {
    const { error } = await supabase.from('players').delete().in('id', removedIds);
    if (error) throw error;
  }

  const toUpsert = newPlayers.filter((np) => {
    const old = oldPlayers.find((op) => op.id === np.id);
    return !old || JSON.stringify(old) !== JSON.stringify(np);
  });
  if (toUpsert.length > 0) {
    const { error } = await supabase.from('players').upsert(
      toUpsert.map((p) => ({
        id: p.id,
        name: p.name,
        phone: p.phone || '',
        is_regular: p.isRegular,
      }))
    );
    if (error) throw error;
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function upsertSettings(settings) {
  const { error } = await supabase.from('settings').upsert({
    id: 1,
    group_name: settings.groupName,
    recurring_day: settings.recurringDay,
    default_time: settings.defaultTime,
    default_location: settings.defaultLocation || '',
    default_max_seats: settings.defaultMaxSeats,
    admin_password: settings.adminPassword || '1001',
  });
  if (error) throw error;
}
