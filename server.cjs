const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ==========================================
// STATE MANAGEMENT (ALL 6 ROOMS)
// ==========================================
const initRoomState = (roomNum, name, startWeight, dropRate, isHardware = false) => ({
  roomNumber: roomNum,
  patientName: name,
  isHardware,
  
  // Patient Details
  details: {
    patientId: `PT-${Math.floor(Math.random() * 90000) + 10000}`,
    age: Math.floor(Math.random() * 50) + 20,
    gender: Math.random() > 0.5 ? 'Male' : 'Female',
    bloodGroup: ['O+', 'A+', 'B+', 'AB+'][Math.floor(Math.random()*4)],
    admissionDate: '2023-10-24',
    doctorName: 'Dr. Sarah Jenkins',
    wardNumber: 'W-03',
    bedNumber: `B-${roomNum}`
  },
  
  // Live Data
  liveData: {
    current_weight: startWeight,
    full_weight: 500.0,
    low_weight: 100.0,
    counter: Math.floor(Math.random() * 500),
    selected_mode: 1, // 500ml
    vibrationStatus: 'Normal', 
    batteryPercentage: Math.floor(Math.random() * 20) + 80,
    wifiStatus: 'Connected',
    esp32Connection: 'Online',
    servoStatus: 'Open',
    flowStatus: 'Flowing'
  },
  
  // Simulation params
  simParams: { dropRate },
  
  // Timeline
  timeline: [
    { time: new Date(Date.now() - 3600000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), event: 'Monitoring Started' },
    { time: new Date(Date.now() - 3500000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), event: 'Bottle Selected (500ml)' }
  ]
});

let roomsState = {
  '301': initRoomState('301', 'John Doe', 0, 0, true), // Hardware - starts at zero until ESP32 connects
  '302': initRoomState('302', 'Jane Smith', 450.0, 1.2),
  '303': initRoomState('303', 'Robert Brown', 180.0, 2.5), // Faster drop
  '304': initRoomState('304', 'Emily Davis', 390.0, 0.8),
  '305': initRoomState('305', 'Michael Wilson', 220.0, 1.5),
  '306': initRoomState('306', 'Sarah Miller', 80.0, 0.5) // Already low
};

// Room 301 starts with zeros (no data until ESP32 connects)
roomsState['301'].liveData.counter = 0;
roomsState['301'].liveData.selected_mode = 0;
roomsState['301'].liveData.batteryPercentage = 0;
roomsState['301'].liveData.esp32Connection = 'Offline';
roomsState['301'].liveData.wifiStatus = 'Disconnected';
roomsState['301'].liveData.flowStatus = 'Stopped';
roomsState['301'].liveData.servoStatus = 'Closed';
roomsState['301'].timeline = [];
let lastESP32DataTime = 0; // Track when we last received data

// ==========================================
// AI ENGINE
// ==========================================
function processRoom(room) {
  let priority = 'Stable';
  let recommendation = 'Patient is stable. IV infusion progressing normally.';
  let fault = null;
  let remainingPercentage = (room.liveData.current_weight / room.liveData.full_weight) * 100;
  
  if (remainingPercentage < 0) remainingPercentage = 0;

  if (room.liveData.esp32Connection === 'Offline') {
    priority = 'Critical';
    recommendation = 'Device disconnected. Please check power and Wi-Fi.';
    fault = 'Connection Lost';
  } else if (room.liveData.vibrationStatus === 'High') {
    priority = 'Observation Required';
    recommendation = 'High vibration detected. Inspect patient movement or IV stand stability.';
    fault = 'Flow Disturbed';
  } else if (remainingPercentage <= 20 && remainingPercentage > 5) {
    priority = 'Observation Required';
    recommendation = 'IV bottle below 20%. Prepare for replacement soon.';
  } else if (remainingPercentage <= 5) {
    priority = 'Critical';
    recommendation = 'Immediate nurse attention recommended. IV bottle almost empty.';
    if (room.liveData.servoStatus === 'Open' && !room.isHardware) {
      room.liveData.servoStatus = 'Closed';
      room.liveData.flowStatus = 'Stopped';
      room.timeline.unshift({ time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), event: 'Servo Activated (Cutoff)' });
      room.timeline.unshift({ time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), event: 'Automatic Flow Cutoff Activated' });
    }
  }

  return {
    roomNumber: room.roomNumber,
    patientName: room.patientName,
    isHardware: room.isHardware,
    ivStatus: priority === 'Critical' ? 'Critical' : 'Normal',
    aiHealthStatus: priority,
    deviceOnline: room.liveData.esp32Connection === 'Online',
    criticalIndicator: fault || (priority === 'Critical' ? 'Low Fluid Level' : 'None'),
    details: room.details,
    liveData: {
      ...room.liveData,
      remainingPercentage: remainingPercentage.toFixed(1)
    },
    aiSummary: {
      recommendation,
      prediction: priority === 'Critical' ? '0 mins' : `${Math.floor(remainingPercentage * 1.5)} mins until empty`,
      fault
    },
    timeline: room.timeline
  };
}

function getDashboardData() {
  const processedRooms = Object.values(roomsState).map(processRoom);
  
  // Sort rooms: Critical -> Observation -> Stable
  const sortedRooms = [...processedRooms].sort((a, b) => {
    const p = { 'Critical': 3, 'Observation Required': 2, 'Stable': 1 };
    return p[b.aiHealthStatus] - p[a.aiHealthStatus];
  });

  return { rooms: sortedRooms };
}

// ==========================================
// REAL ESP32 SENSOR UPDATES (REST API - ROOM 301)
// ==========================================
app.post('/api/sensor', (req, res) => {
  console.log('Received data from ESP32:', req.body);
  const { current_weight, counter, selected_mode, status } = req.body;
  let room = roomsState['301'];
  
  // Mark ESP32 as online
  lastESP32DataTime = Date.now();
  room.liveData.esp32Connection = 'Online';
  room.liveData.wifiStatus = 'Connected';
  
  if (current_weight !== undefined) room.liveData.current_weight = current_weight;
  if (counter !== undefined) room.liveData.counter = counter;
  
  if (selected_mode !== undefined && selected_mode !== room.liveData.selected_mode && selected_mode !== 0) {
    room.liveData.selected_mode = selected_mode;
    room.liveData.full_weight = selected_mode === 1 ? 500.0 : 100.0;
    room.liveData.low_weight = room.liveData.full_weight * 0.2;
    room.timeline.unshift({ time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), event: `Bottle Selected (${selected_mode === 1 ? '500ml' : '100ml'}) [Hardware]` });
  }

  if (status === 'CUTOFF') {
    room.liveData.servoStatus = 'Closed';
    room.liveData.flowStatus = 'Stopped';
  } else {
    room.liveData.servoStatus = 'Open';
    room.liveData.flowStatus = 'Flowing';
  }

  room.liveData.esp32Connection = 'Online';
  io.emit('dashboard_update', getDashboardData());
  res.status(200).send('OK');
});

// ==========================================
// SIMULATOR (ROOMS 302-306)
// ==========================================
setInterval(() => {
  // Check if ESP32 stopped sending data (timeout after 10 seconds)
  if (lastESP32DataTime > 0 && (Date.now() - lastESP32DataTime > 10000)) {
    let hw = roomsState['301'];
    hw.liveData.esp32Connection = 'Offline';
    hw.liveData.wifiStatus = 'Disconnected';
  }

  Object.values(roomsState).forEach(room => {
    if (room.isHardware) {
      // Hardware room only simulates vibration occasionally
      if (Math.random() > 0.98 && room.liveData.flowStatus === 'Flowing') {
        room.liveData.vibrationStatus = 'High';
        setTimeout(() => room.liveData.vibrationStatus = 'Normal', 5000);
      }
    } else {
      // Fully simulate software rooms
      if (room.liveData.esp32Connection === 'Online' && room.liveData.flowStatus === 'Flowing' && room.liveData.current_weight > 0) {
        room.liveData.current_weight -= (Math.random() * room.simParams.dropRate + 0.5);
        room.liveData.counter += Math.floor(Math.random() * 2);
        
        if (Math.random() > 0.97) {
          room.liveData.vibrationStatus = 'High';
          setTimeout(() => room.liveData.vibrationStatus = 'Normal', 5000);
        }
      }
      if (room.liveData.current_weight < 0) room.liveData.current_weight = 0;
    }
  });

  io.emit('dashboard_update', getDashboardData());
}, 2000);

// ==========================================
// SOCKET.IO
// ==========================================
io.on('connection', (socket) => {
  socket.emit('dashboard_update', getDashboardData());
  
  socket.on('reset_bottle', ({ roomId, type }) => {
    let room = roomsState[roomId];
    if (room && !room.isHardware) {
      room.liveData.selected_mode = type;
      room.liveData.full_weight = type === 1 ? 500.0 : 100.0;
      room.liveData.current_weight = room.liveData.full_weight;
      room.liveData.low_weight = room.liveData.full_weight * 0.2;
      room.liveData.counter = 0;
      room.liveData.servoStatus = 'Open';
      room.liveData.flowStatus = 'Flowing';
      room.timeline.unshift({ time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), event: `Bottle Selected (${type === 1 ? '500ml' : '100ml'}) [Simulated]` });
      io.emit('dashboard_update', getDashboardData());
    }
  });

  // Dashboard Controls for ANY room (including hardware Room 301)
  socket.on('increment_drip', ({ roomId }) => {
    let room = roomsState[roomId];
    if (room) {
      room.liveData.counter += 1;
      room.timeline.unshift({ time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), event: `Drip counted (+1) [Dashboard]` });
      io.emit('dashboard_update', getDashboardData());
    }
  });

  socket.on('select_bottle', ({ roomId, type }) => {
    let room = roomsState[roomId];
    if (room) {
      room.liveData.selected_mode = type;
      room.liveData.full_weight = type === 1 ? 500.0 : 100.0;
      room.liveData.low_weight = room.liveData.full_weight * 0.2;
      if (room.liveData.current_weight === 0) {
        room.liveData.current_weight = room.liveData.full_weight;
      }
      room.liveData.servoStatus = 'Open';
      room.liveData.flowStatus = 'Flowing';
      room.timeline.unshift({ time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), event: `Bottle Selected (${type === 1 ? '500ml' : '100ml'}) [Dashboard]` });
      io.emit('dashboard_update', getDashboardData());
    }
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
