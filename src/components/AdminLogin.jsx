import { useState } from 'react';

export default function AdminLogin({ onLogin, correctPassword }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === correctPassword) {
      setLoading(true);
      setTimeout(onLogin, 300);
    } else {
      setError('סיסמה שגויה');
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      setInput('');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at center, #0f1a12 0%, #0a0a0a 70%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Heebo, sans-serif',
      direction: 'rtl',
      padding: 16,
    }}>
      <div style={{
        background: '#141414',
        border: '1px solid #252525',
        borderRadius: 20,
        padding: '48px 40px',
        width: '100%',
        maxWidth: 380,
        textAlign: 'center',
        animation: 'fadeIn 0.4s ease',
      }}>
        <div style={{ fontSize: 44, marginBottom: 12, letterSpacing: 8 }}>♠♥</div>
        <h1 style={{ color: '#c9a84c', fontSize: 26, fontWeight: 800, margin: '0 0 6px' }}>
          ניהול פוקר
        </h1>
        <p style={{ color: '#555', fontSize: 14, margin: '0 0 36px' }}>
          כניסה לאזור הניהול
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            inputMode="numeric"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(''); }}
            placeholder="••••"
            autoFocus
            style={{
              width: '100%',
              padding: '16px',
              background: '#0f0f0f',
              border: `2px solid ${error ? '#8b2020' : '#2a2a2a'}`,
              borderRadius: 12,
              color: '#f0f0f0',
              fontSize: 22,
              textAlign: 'center',
              letterSpacing: 8,
              outline: 'none',
              transition: 'border-color 0.2s',
              animation: shaking ? 'shake 0.5s' : 'none',
            }}
          />

          {error && (
            <p style={{ color: '#c0392b', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !input}
            style={{
              width: '100%',
              marginTop: 16,
              padding: '15px',
              background: loading ? '#8a6f28' : '#c9a84c',
              color: '#0a0a0a',
              border: 'none',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 700,
              fontFamily: 'Heebo, sans-serif',
              cursor: loading || !input ? 'not-allowed' : 'pointer',
              opacity: !input ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'נכנס...' : 'כניסה'}
          </button>
        </form>

        <p style={{ color: '#333', fontSize: 12, marginTop: 28 }}>
          שחקנים — השתמשו בקישור ההרשמה שקיבלתם
        </p>
      </div>
    </div>
  );
}
