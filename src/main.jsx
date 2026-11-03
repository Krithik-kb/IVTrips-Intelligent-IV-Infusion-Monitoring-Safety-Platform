import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { io } from 'socket.io-client';
import { 
  Activity, AlertTriangle, Battery, Wifi, WifiOff, CheckCircle2, 
  Droplet, RefreshCw, User, ShieldAlert, Heart, Clock, Bed, UserCheck
} from 'lucide-react';

const socket = io('http://localhost:3001');

function App() {
  const [data, setData] = useState({ rooms: [] });
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('dashboard_update', (update) => {
      setData(update);
      if (!selectedRoom && update.rooms.length > 0) {
        setSelectedRoom(update.rooms[0]);
      } else if (selectedRoom) {
        const refreshed = update.rooms.find(r => r.roomNumber === selectedRoom.roomNumber);
        if (refreshed) setSelectedRoom(refreshed);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('dashboard_update');
    };
  }, [selectedRoom]);

  const handleSelectBottle = (roomId, type) => {
    socket.emit('select_bottle', { roomId, type });
  };

  const handleIncrementDrip = (roomId) => {
    socket.emit('increment_drip', { roomId });
  };

  const handleResetBottle = (roomId, type) => {
    socket.emit('reset_bottle', { roomId, type });
  };

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.logoIcon}><Droplet size={28} color="#00E5FF" /></div>
          <div>
            <h1 style={styles.title}>AI CareFlow IV Monitor</h1>
            <p style={styles.subtitle}>Hospital Intelligent Infusion & Monitoring System</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={{ ...styles.badge, backgroundColor: connected ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 23, 68, 0.15)', color: connected ? '#00E676' : '#FF2344' }}>
            {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>{connected ? 'Backend Live' : 'Reconnecting...'}</span>
          </div>
          <div style={styles.badgeTime}>
            <Clock size={16} />
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </header>

      {/* CONTENT GRID */}
      <div style={styles.content}>
        {/* ROOM CARDS LIST */}
        <div style={styles.roomSidebar}>
          <h2 style={styles.sectionTitle}>Ward 03 - Patient Rooms</h2>
          <div style={styles.roomList}>
            {data.rooms.map((room) => {
              const isSelected = selectedRoom?.roomNumber === room.roomNumber;
              const isCritical = room.aiHealthStatus === 'Critical';
              const isObs = room.aiHealthStatus === 'Observation Required';
              
              let borderCol = 'rgba(255,255,255,0.1)';
              let bgGlow = 'transparent';
              if (isCritical) {
                borderCol = '#FF1744';
                bgGlow = 'rgba(255, 23, 68, 0.08)';
              } else if (isObs) {
                borderCol = '#FFC400';
                bgGlow = 'rgba(255, 196, 0, 0.05)';
              }

              return (
                <div 
                  key={room.roomNumber} 
                  onClick={() => setSelectedRoom(room)}
                  style={{
                    ...styles.roomCard,
                    borderColor: isSelected ? '#00E5FF' : borderCol,
                    backgroundColor: isSelected ? 'rgba(0, 229, 255, 0.08)' : bgGlow
                  }}
                >
                  <div style={styles.cardHeader}>
                    <span style={styles.roomNum}>Room {room.roomNumber}</span>
                    {room.isHardware && <span style={styles.hwTag}>Hardware ESP32</span>}
                  </div>
                  <div style={styles.patientName}>{room.patientName}</div>
                  
                  {/* Progress Bar */}
                  <div style={styles.progressBg}>
                    <div style={{
                      ...styles.progressFill,
                      width: `${Math.min(100, Math.max(0, room.liveData.remainingPercentage))}%`,
                      backgroundColor: isCritical ? '#FF1744' : isObs ? '#FFC400' : '#00E5FF'
                    }} />
                  </div>

                  <div style={styles.cardFooter}>
                    <span style={styles.fluidPct}>{room.liveData.remainingPercentage}% Fluid</span>
                    <span style={{
                      ...styles.statusPill,
                      color: isCritical ? '#FF1744' : isObs ? '#FFC400' : '#00E676'
                    }}>
                      {room.aiHealthStatus}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DETAILED VIEW */}
        {selectedRoom && (
          <div style={styles.detailArea}>
            {/* ROOM HEADER CARD */}
            <div style={styles.detailCard}>
              <div style={styles.detailTop}>
                <div>
                  <div style={styles.detailTitle}>Room {selectedRoom.roomNumber} Overview</div>
                  <div style={styles.patientSub}>Patient: <strong>{selectedRoom.patientName}</strong> | ID: {selectedRoom.details.patientId}</div>
                </div>
                <div style={styles.vitalsRow}>
                  <div style={styles.vitalBox}>
                    <Bed size={16} color="#00E5FF" />
                    <span>Bed {selectedRoom.details.bedNumber}</span>
                  </div>
                  <div style={styles.vitalBox}>
                    <User size={16} color="#00E5FF" />
                    <span>{selectedRoom.details.age} yrs / {selectedRoom.details.gender}</span>
                  </div>
                  <div style={styles.vitalBox}>
                    <Heart size={16} color="#FF1744" />
                    <span>{selectedRoom.details.bloodGroup}</span>
                  </div>
                </div>
              </div>

              {/* AI HEALTH RECOMMENDATION SUMMARY */}
              <div style={{
                ...styles.aiBanner,
                borderColor: selectedRoom.aiHealthStatus === 'Critical' ? '#FF1744' : selectedRoom.aiHealthStatus === 'Observation Required' ? '#FFC400' : '#00E676',
                backgroundColor: selectedRoom.aiHealthStatus === 'Critical' ? 'rgba(255, 23, 68, 0.1)' : selectedRoom.aiHealthStatus === 'Observation Required' ? 'rgba(255, 196, 0, 0.1)' : 'rgba(0, 230, 118, 0.1)'
              }}>
                <ShieldAlert size={24} color={selectedRoom.aiHealthStatus === 'Critical' ? '#FF1744' : selectedRoom.aiHealthStatus === 'Observation Required' ? '#FFC400' : '#00E676'} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>AI Recommendation: {selectedRoom.aiHealthStatus}</div>
                  <div style={{ fontSize: 14, opacity: 0.9 }}>{selectedRoom.aiSummary.recommendation}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Estimated Empty Time</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: '#00E5FF' }}>{selectedRoom.aiSummary.prediction}</div>
                </div>
              </div>
            </div>

            {/* LIVE METRICS & CONTROLS */}
            <div style={styles.gridTwo}>
              {/* LIVE METRICS */}
              <div style={styles.detailCard}>
                <h3 style={styles.cardTitle}><Activity size={18} /> Live Sensor Telemetry</h3>
                <div style={styles.metricGrid}>
                  <div style={styles.metricTile}>
                    <div style={styles.metricLabel}>Current Fluid Weight</div>
                    <div style={styles.metricVal}>{Number(selectedRoom.liveData.current_weight).toFixed(1)} <span style={{fontSize: 14}}>g/ml</span></div>
                  </div>
                  <div style={styles.metricTile}>
                    <div style={styles.metricLabel}>Drip Counter</div>
                    <div style={styles.metricVal}>{selectedRoom.liveData.counter} <span style={{fontSize: 14}}>drops</span></div>
                  </div>
                  <div style={styles.metricTile}>
                    <div style={styles.metricLabel}>Flow Servo Valve</div>
                    <div style={{ ...styles.metricVal, color: selectedRoom.liveData.servoStatus === 'Open' ? '#00E676' : '#FF1744' }}>
                      {selectedRoom.liveData.servoStatus}
                    </div>
                  </div>
                  <div style={styles.metricTile}>
                    <div style={styles.metricLabel}>Vibration Status</div>
                    <div style={{ ...styles.metricVal, color: selectedRoom.liveData.vibrationStatus === 'Normal' ? '#00E676' : '#FFC400' }}>
                      {selectedRoom.liveData.vibrationStatus}
                    </div>
                  </div>
                </div>
              </div>

              {/* CONTROLS */}
              <div style={styles.detailCard}>
                <h3 style={styles.cardTitle}><RefreshCw size={18} /> Interactive Controls</h3>
                <div style={styles.controlGroup}>
                  <label style={styles.label}>Select IV Bottle Capacity:</label>
                  <div style={styles.btnRow}>
                    <button 
                      onClick={() => handleSelectBottle(selectedRoom.roomNumber, 1)}
                      style={{ ...styles.btn, backgroundColor: selectedRoom.liveData.selected_mode === 1 ? '#00E5FF' : 'rgba(255,255,255,0.08)', color: selectedRoom.liveData.selected_mode === 1 ? '#000' : '#fff' }}
                    >
                      500 ml Bottle
                    </button>
                    <button 
                      onClick={() => handleSelectBottle(selectedRoom.roomNumber, 2)}
                      style={{ ...styles.btn, backgroundColor: selectedRoom.liveData.selected_mode === 2 ? '#00E5FF' : 'rgba(255,255,255,0.08)', color: selectedRoom.liveData.selected_mode === 2 ? '#000' : '#fff' }}
                    >
                      100 ml Bottle
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <label style={styles.label}>Simulate Operations:</label>
                  <div style={styles.btnRow}>
                    <button onClick={() => handleIncrementDrip(selectedRoom.roomNumber)} style={{ ...styles.btn, backgroundColor: 'rgba(0, 229, 255, 0.2)', border: '1px solid #00E5FF' }}>
                      +1 Manual Drip Count
                    </button>
                    <button onClick={() => handleResetBottle(selectedRoom.roomNumber, selectedRoom.liveData.selected_mode || 1)} style={{ ...styles.btn, backgroundColor: 'rgba(0, 230, 118, 0.2)', border: '1px solid #00E676' }}>
                      Refill / Reset Bottle
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* TIMELINE LOG */}
            <div style={styles.detailCard}>
              <h3 style={styles.cardTitle}><Clock size={18} /> Room Audit Event Log</h3>
              <div style={styles.timelineList}>
                {selectedRoom.timeline.length === 0 && <div style={{opacity: 0.5}}>No events recorded yet.</div>}
                {selectedRoom.timeline.map((item, idx) => (
                  <div key={idx} style={styles.timelineItem}>
                    <span style={styles.timelineTime}>{item.time}</span>
                    <span style={styles.timelineEvent}>{item.event}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0A0E1A',
    color: '#E2E8F0',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    padding: '24px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)'
  },
  brand: { display: 'flex', alignItems: 'center', gap: '16px' },
  logoIcon: {
    width: '48px', height: '48px', borderRadius: '12px',
    backgroundColor: 'rgba(0, 229, 255, 0.1)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,229,255,0.3)'
  },
  title: { margin: 0, fontSize: '24px', fontWeight: 700, color: '#F8FAFC' },
  subtitle: { margin: 0, fontSize: '13px', color: '#94A3B8' },
  headerRight: { display: 'flex', gap: '12px' },
  badge: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px',
    borderRadius: '20px', fontSize: '13px', fontWeight: 600
  },
  badgeTime: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px',
    borderRadius: '20px', backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '13px', color: '#94A3B8'
  },
  content: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' },
  roomSidebar: { backgroundColor: '#131B2E', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' },
  sectionTitle: { fontSize: '16px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#94A3B8' },
  roomList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  roomCard: {
    padding: '14px', borderRadius: '12px', border: '1px solid', cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' },
  roomNum: { fontWeight: 700, fontSize: '15px' },
  hwTag: { fontSize: '10px', backgroundColor: 'rgba(0,229,255,0.2)', color: '#00E5FF', padding: '2px 6px', borderRadius: '4px' },
  patientName: { fontSize: '14px', color: '#CBD5E1', marginBottom: '10px' },
  progressBg: { height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' },
  progressFill: { height: '100%', borderRadius: '3px', transition: 'width 0.3s ease' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', fontSize: '12px' },
  fluidPct: { color: '#94A3B8' },
  statusPill: { fontWeight: 600 },
  detailArea: { display: 'flex', flexDirection: 'column', gap: '20px' },
  detailCard: { backgroundColor: '#131B2E', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' },
  detailTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  detailTitle: { fontSize: '20px', fontWeight: 700 },
  patientSub: { fontSize: '14px', color: '#94A3B8', marginTop: '4px' },
  vitalsRow: { display: 'flex', gap: '12px' },
  vitalBox: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.04)', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' },
  aiBanner: { display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '12px', border: '1px solid' },
  gridTwo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  cardTitle: { fontSize: '16px', fontWeight: 600, marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' },
  metricGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  metricTile: { backgroundColor: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px' },
  metricLabel: { fontSize: '12px', color: '#94A3B8', marginBottom: '6px' },
  metricVal: { fontSize: '20px', fontWeight: 700 },
  controlGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '13px', color: '#94A3B8' },
  btnRow: { display: 'flex', gap: '10px' },
  btn: { flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: '0.2s' },
  timelineList: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' },
  timelineItem: { display: 'flex', gap: '16px', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '13px' },
  timelineTime: { color: '#00E5FF', fontWeight: 600, width: '70px' },
  timelineEvent: { color: '#CBD5E1' }
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
