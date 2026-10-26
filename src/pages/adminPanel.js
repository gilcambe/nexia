import { useState, useEffect } from 'react';

export default function AdminPanel() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/abuse')
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p>Carregando abusos...</p>;

  return (
    <section style={{ padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h2>Painel Admin - Logs de Abuso</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th style={{ padding: '0.5rem' }}>IP</th>
            <th style={{ padding: '0.5rem' }}>Usuário</th>
            <th style={{ padding: '0.5rem' }}>Tipo</th>
            <th style={{ padding: '0.5rem' }}>Detalhes</th>
            <th style={{ padding: '0.5rem' }}>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log._id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>{log.ip}</td>
              <td style={{ padding: '0.5rem' }}>{log.userId || '-'}</td>
              <td style={{ padding: '0.5rem' }}>{log.tipo}</td>
              <td style={{ padding: '0.5rem' }}>{log.detalhes}</td>
              <td style={{ padding: '0.5rem' }}>{new Date(log.timestamp).toLocaleString()}</td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan={5} style={{ padding: '0.5rem', textAlign: 'center' }}>Nenhum registro de abuso.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
