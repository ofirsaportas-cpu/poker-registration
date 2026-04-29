import { useState, useEffect, useCallback } from 'react';
import { storage } from './utils/storage.js';
import { isPast, addDays } from './utils/dates.js';
import AdminLogin from './components/AdminLogin.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import PlayerView from './components/PlayerView.jsx';

export default function App() {
  const [events, setEvents] = useState(null);
  const [settings, setSettings] = useState(null);
  const [view, setView] = useState('loading');
  const [currentEventId, setCurrentEventId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eventParam = params.get('event');
    const playerParam = params.get('player');

    let loadedEvents = storage.getEvents();
    let changed = false;
    loadedEvents = loadedEvents.map((e) => {
      if (e.type !== 'recurring' || !isPast(e.date)) return e;
      let newDate = e.date;
      while (isPast(newDate)) newDate = addDays(newDate, 7);
      const regularRegs = e.registrations
        .filter((r) => r.isRegular)
        .map((r) => ({ ...r, status: 'ממתין לאישור' }));
      changed = true;
      return { ...e, date: newDate, registrations: regularRegs };
    });
    if (changed) storage.setEvents(loadedEvents);
    setEvents(loadedEvents);
    setSettings(storage.getSettings());

    if (eventParam) {
      setCurrentEventId(eventParam);
      setView('player');
    } else if (playerParam) {
      setView('player');
    } else {
      setView('adminLogin');
    }
  }, []);

  const saveEvents = useCallback((newEvents) => {
    setEvents(newEvents);
    storage.setEvents(newEvents);
  }, []);

  const saveSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    storage.setSettings(newSettings);
  }, []);

  const handleLogin = useCallback(() => setView('adminDash'), []);
  const handleLogout = useCallback(() => setView('adminLogin'), []);

  if (view === 'loading' || !settings || !events) {
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
        onSaveEvents={saveEvents}
        onSaveSettings={saveSettings}
        onLogout={handleLogout}
      />
    );
  }

  if (view === 'player') {
    return (
      <PlayerView
        events={events}
        settings={settings}
        currentEventId={currentEventId}
        onSaveEvents={saveEvents}
      />
    );
  }

  return null;
}
