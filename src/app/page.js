'use client';

import { useState, useEffect, useRef } from 'react';

export default function Dashboard() {
  const [status, setStatus] = useState({
    isRunning: false,
    logs: [],
    tripCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const logEndRef = useRef(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/bot');
      const data = await res.json();
      setStatus(prev => ({
        ...data,
        logs: data.logs || []
      }));
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [status.logs]);

  const handleAction = async (action) => {
    setLoading(true);
    try {
      await fetch('/api/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Error performing action:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = () => {
    setStatus(prev => ({ ...prev, logs: [] }));
  };

  return (
    <div className="glass-container">
      <div className="glow-sphere"></div>
      <div className="glow-sphere-2"></div>

      <header>
        <div className="logo-area">
          <div className={`status-indicator ${status.isRunning ? 'status-online' : ''}`}>
            <span id="status-dot"></span>
            <span id="status-text">{status.isRunning ? 'CONECTADO' : 'DESCONECTADO'}</span>
          </div>
          <h1>FLETY<span>BOT</span></h1>
        </div>
      </header>

      <main>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Estado</span>
            <span className="stat-value" id="status-display">{status.isRunning ? 'Activo' : 'Inactivo'}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Viajes</span>
            <span className="stat-value" id="trip-count">{status.tripCount}</span>
          </div>
        </div>

        <div className="controls">
          <button
            id="start-btn"
            className="btn btn-primary"
            onClick={() => handleAction('start')}
            disabled={status.isRunning || loading}
          >
            <span className="icon">▶</span> INICIAR BOT
          </button>
          <button
            id="stop-btn"
            className="btn btn-secondary"
            onClick={() => handleAction('stop')}
            disabled={!status.isRunning || loading}
          >
            <span className="icon">■</span> DETENER BOT
          </button>
        </div>

        <div className="console-box">
          <div className="console-header">
            <span>REGISTROS DEL SISTEMA</span>
            <button id="clear-log" onClick={clearLogs}>Limpiar</button>
          </div>
          <div id="log-output" className="console-content" ref={logEndRef}>
            {status.logs.length > 0 ? (
              status.logs.map((log, i) => {
                let logClass = 'log-line';
                if (log.includes('>') || log.includes('⚡')) logClass += ' system';
                if (log.includes('🎉') || log.includes('SUCCESS')) logClass += ' success';
                if (log.includes('Error') || log.includes('Falló')) logClass += ' error';
                if (log.includes('⏳') || log.includes('😴')) logClass += ' warning';

                return (
                  <div key={i} className={logClass}>
                    {log}
                  </div>
                );
              })
            ) : (
              <div className="log-line system">&gt; Bienvenido al panel de control de Flety Bot...</div>
            )}
          </div>
        </div>
      </main>

      <footer>
        <div className="footer-content">
          <span>Versión Pro 2.0</span>
          <span className="divider">|</span>
          <span>Protección de Código Activa</span>
        </div>
      </footer>
    </div>
  );
}
