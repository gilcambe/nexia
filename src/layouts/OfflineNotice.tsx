import React, { useEffect, useState } from 'react';

export default function OfflineNotice(): JSX.Element {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      id="offline-notice"
      role="alert"
      aria-label="Sem internet"
      style={
        {
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.95)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
          padding: '1.5rem',
          boxSizing: 'border-box',
        } as React.CSSProperties
      }
    >
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ marginBottom: '1rem' }}
      >
        <path d="M18 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3a2 2 0 0 1 2 2z" />
        <polyline points="15 12 12 15 9 12" />
      </svg>
      <h1
        style={
          {
            margin: '0 0 0.5rem 0',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#f8fafc',
          } as React.CSSProperties
        }
      >
        Sem internet
      </h1>
      <p
        style={
          {
            margin: '0',
            fontSize: '1rem',
            color: '#cbd5e1',
            maxWidth: '28rem',
            lineHeight: 1.5,
          } as React.CSSProperties
        }
      >
        Você está off-line. Verifique sua conexão e tente novamente.
      </p>
    </div>
  );
}
