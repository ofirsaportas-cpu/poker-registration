import { useState, useEffect, useCallback, useRef } from 'react';
import { storage } from './utils/storage.js';
import { isPast, addDays, toLocalDateString } from './utils/dates.js';
import { supabase } from './supabaseClient.js';
import {
  fetchAllEvents, fetchAllPlayers, fetchSettings,
  upsertEvent, deleteEvent, syncRegistrations,
  syncPlayers, upsertSettings,
} from './utils/db.js';
import AdminLogin from './components/AdminLogin.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import PlayerView from './components/PlayerView.jsx';

const FALLBACK_SETTINGS = {
  groupName: 'חבורת הפוקר',
  recurringDay: 3,
  defaultTime: '21:00',
  defaultLocation: '',
  defaultMaxSeats: 9,
  adminPassword: '1001',
};

export default function App() {
  const [events, setEvents] = useState(null);
  const [settings, setSettings] = useState(null);
  const [players, setPlayers] = useState(null);
  const [view, setView] = useState('loading');
  const [currentEventId, setCurrentEventId] = useState(null);

  // Guard: skip realtime-triggered loadAll() while a manual save is in progress
  const savingRef = useRef(false);

  // ─── Load all data + auto-advance recurring events ───────────────────────

  const loadAll = useCallback(async () => {
    if (savingRef.current) {
      console.log('[loadAll] skipped — save in progress');
      return;
    }
    console.log('[loadAll] starting. today =', toLocalDateString());
    try {
      const [loadedEvents, loadedPlayers, loadedSettings] = await Promise.all([
        fetchAllEvents(),
        fetchAllPlayers(),
        fetchSettings(),
      ]);

      // Auto-advance recurring events whose date has passed
      let needsSave = false;
      const advancedEvents = loadedEvents.map((e) => {
        if (e.type !== 'recurring') return e;
        const past = isPast(e.date);
        console.log(`[loadAll] event ${e.id} type=${e.type} date=${e.date} today=${toLocalDateString()} isPast=${past}`);
        if (!past) return e;
        let newDate = e.date;
        while (isPast(newDate)) newDate = addDays(newDate, 7);
        console.log(`[loadAll] AUTO-ADVANCING event ${e.id}: ${e.date} → ${newDate}`);
        const regularRegs = e.registrations
          .filter((r) => r.isRegular)
          .map((r) => ({ ...r, status: 'ממתין לאישור' }));
        needsSave = true;
        return { ...e, date: newDate, registrations: regularRegs };
      });

      if (needsSave) {
        console.log('[loadAll] saving auto-advanced events to DB...');
        for (const event of advancedEvents) {
          const original = loadedEvents.find((e) => e.id === event.id);
          if (original && original.date !== event.date) {
            console.log(`[loadAll] writing advanced event ${event.id} date=${event.date}`);
            await upsertEvent(event);
            await syncRegistrations(event.id, original.registrations, event.registrations);
          }
        }
      }

      // If a save started while we were fetching, don't overwrite the optimistic state
      if (savingRef.current) {
        console.log('[loadAll] skipping setEvents — save started while fetching');
        return;
      }
      console.log('[loadAll] setEvents with', advancedEvents.map((e) => `${e.id}/${e.date}`));
      setEvents(advancedEvents);
      setPlayers(loadedPlayers);
      setSettings(loadedSettings);
    } catch (err) {
      console.error('[loadAll] FAILED:', err);
      setEvents((prev) => prev ?? []);
      setPlayers((prev) => prev ?? []);
      setSettings((prev) => prev ?? FALLBACK_SETTINGS);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eventParam = params.get('event');
    const playerParam = params.get('player');

    if (eventParam) {
      setCurrentEventId(eventParam);
      setView('player');
      // PlayerView fetches its own data — no loadAll needed
    } else if (playerParam) {
      setView('player');
      // PlayerView fetches its own data — no loadAll needed
    } else {
      setView('adminLogin');
      loadAll();
    }
  }, [loadAll]);

  // ─── Real-time subscriptions ──────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        console.log('[realtime] events table changed');
        loadAll();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
        console.log('[realtime] registrations table changed');
        loadAll();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () =>
        fetchAllPlayers().then(setPlayers).catch(console.error)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () =>
        fetchSettings().then(setSettings).catch(console.error)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadAll]);

  // ─── Save Events ──────────────────────────────────────────────────────────

  const handleSaveEvents = useCallback(async (newEvents) => {
    console.log('[handleSaveEvents] called with events:', newEvents.map((e) => `${e.id}/${e.type}/${e.date}`));
    let oldEvents = [];
    setEvents((prev) => { oldEvents = prev || []; return newEvents; }); // optimistic

    savingRef.current = true;
    try {
      const deletedIds = oldEvents
        .filter((oe) => !newEvents.find((ne) => ne.id === oe.id))
        .map((e) => e.id);
      if (deletedIds.length > 0) {
        console.log('[handleSaveEvents] deleting events:', deletedIds);
        for (const id of deletedIds) {
          await deleteEvent(id);
        }
      }

      const changed = newEvents.filter((ne) => {
        const old = oldEvents.find((oe) => oe.id === ne.id);
        return !old || JSON.stringify(old) !== JSON.stringify(ne);
      });
      console.log('[handleSaveEvents] changed events to upsert:', changed.map((e) => `${e.id}/${e.date}`));

      for (const event of changed) {
        const oldEvent = oldEvents.find((oe) => oe.id === event.id);
        console.log(`[handleSaveEvents] upserting event ${event.id}, date=${event.date}, regs=${event.registrations.length}`);
        await upsertEvent(event);
        console.log(`[handleSaveEvents] syncing regs for ${event.id}: old=${oldEvent?.registrations?.length ?? 0} → new=${event.registrations.length}`);
        await syncRegistrations(event.id, oldEvent?.registrations || [], event.registrations);
      }
      console.log('[handleSaveEvents] all saves completed successfully');
    } catch (err) {
      console.error('[handleSaveEvents] FAILED — rolling back to', oldEvents.map((e) => e.id), err);
      setEvents(oldEvents); // rollback
    } finally {
      savingRef.current = false;
      // After save completes, do one fresh loadAll to sync any realtime events we skipped
      console.log('[handleSaveEvents] save done, refreshing from DB...');
      loadAll();
    }
  }, [loadAll]);

  // ─── Save Players ─────────────────────────────────────────────────────────

  const handleSavePlayers = useCallback(async (newPlayers) => {
    let oldPlayers = [];
    setPlayers((prev) => { oldPlayers = prev || []; return newPlayers; }); // optimistic

    try {
      await syncPlayers(oldPlayers, newPlayers);
    } catch (err) {
      console.error('Failed to save players:', err);
      setPlayers(oldPlayers); // rollback
    }
  }, []);

  // ─── Save Settings ────────────────────────────────────────────────────────

  const handleSaveSettings = useCallback(async (newSettings) => {
    let oldSettings;
    setSettings((prev) => { oldSettings = prev; return newSettings; }); // optimistic

    try {
      await upsertSettings(newSettings);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSettings(oldSettings); // rollback
    }
  }, []);

  const handleLogin = useCallback(() => setView('adminDash'), []);
  const handleLogout = useCallback(() => setView('adminLogin'), []);

  // Player view is self-contained — render immediately, no admin data needed
  if (view === 'player') {
    return <PlayerView currentEventId={currentEventId} />;
  }

  // Admin paths wait for all data to load
  if (!settings || !events || !players) {
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

  if (view === 'adminLogin') {
    return (
      <AdminLogin
        onLogin={handleLogin}
        correctPassword={settings.adminPassword || '1001'}
      />
    );
  }

  if (view === 'adminDash') {
    return (
      <AdminDashboard
        events={events}
        settings={settings}
        players={players}
        onSaveEvents={handleSaveEvents}
        onSaveSettings={handleSaveSettings}
        onSavePlayers={handleSavePlayers}
        onLogout={handleLogout}
      />
    );
  }

  return null;
}
