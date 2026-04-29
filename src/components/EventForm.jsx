import { useState } from 'react';
import { getNextWeekday, toLocalDateString } from '../utils/dates.js';

const FIELD = {
  background: '#0f0f0f',
  border: '1px solid #2a2a2a',
  borderRadius: 10,
  padding: '12px 14px',
  color: '#f0f0f0',
  fontFamily: 'Heebo, sans-serif',
  fontSize: 15,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};

const LABEL = {
  display: 'block',
  color: '#777',
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 6,
};

export default function EventForm({ type, event, settings, onSave, onClose }) {
  const defaultDate = event?.date || (
    type === 'recurring'
      ? getNextWeekday(settings.recurringDay ?? 3)
      : toLocalDateString()
  );

  const [form, setForm] = useState({
    type,
    date: defaultDate,
    time: event?.time || settings.defaultTime || '21:00',
    location: event?.location || settings.defaultLocation || '',
    maxSeats: event?.maxSeats ?? settings.defaultMaxSeats ?? 9,
  });
  const [errors, setErrors] = useState({});

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const errs = {};
    if (!form.date) errs.date = 'נא לבחור תאריך';
    if (!form.time) errs.time = 'נא לבחור שעה';
    if (!form.maxSeats || form.maxSeats < 2) errs.maxSeats = 'מינימום 2 מקומות';
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave({ ...form, maxSeats: Number(form.maxSeats) });
  };

  const inputStyle = (key) => ({
    ...FIELD,
    borderColor: errors[key] ? '#8b2020' : '#2a2a2a',
  });

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="slide-down"
        style={{
          background: '#141414',
          border: '1px solid #252525',
          borderRadius: 18,
          padding: '32px',
          width: '100%',
          maxWidth: 440,
          direction: 'rtl',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: '#f0f0f0', fontSize: 20, fontWeight: 700, margin: 0 }}>
            {event ? 'עריכת משחק' : type === 'recurring' ? '🔄 משחק שבועי חדש' : '⭐ משחק חד-פעמי'}
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#555',
            fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '4px 8px',
          }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={LABEL}>תאריך</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              style={inputStyle('date')}
            />
            {errors.date && <p style={{ color: '#c0392b', fontSize: 12, marginTop: 4 }}>{errors.date}</p>}
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1 }}>
              <label style={LABEL}>שעת התחלה</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => set('time', e.target.value)}
                style={inputStyle('time')}
              />
              {errors.time && <p style={{ color: '#c0392b', fontSize: 12, marginTop: 4 }}>{errors.time}</p>}
            </div>
            <div style={{ flex: 1 }}>
              <label style={LABEL}>מספר מקומות</label>
              <input
                type="number"
                min="2"
                max="20"
                value={form.maxSeats}
                onChange={(e) => set('maxSeats', e.target.value)}
                style={inputStyle('maxSeats')}
              />
              {errors.maxSeats && <p style={{ color: '#c0392b', fontSize: 12, marginTop: 4 }}>{errors.maxSeats}</p>}
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={LABEL}>מיקום</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="לדוגמה: בית של יוסי, רחוב הכרמל 5"
              style={inputStyle('location')}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-start' }}>
            <button
              type="submit"
              style={{
                padding: '13px 28px',
                background: '#c9a84c',
                color: '#0a0a0a',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {event ? 'שמור שינויים' : 'צור משחק'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '13px 20px',
                background: 'transparent',
                color: '#777',
                border: '1px solid #2a2a2a',
                borderRadius: 10,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
