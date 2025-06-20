const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
require('dotenv').config();
// const helmet = require('helmet');
// const { body, validationResult } = require('express-validator');

// Import authentication module
const auth = require('./auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Apply socket authentication
io.use(auth.authenticateSocket);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MQTT Configuration
const MQTT_BROKER = process.env.MQTT_BROKER;
const MQTT_OPTIONS = {
  username: process.env.MQTT_USERNAME || 'your_mqtt_username',
  password: process.env.MQTT_PASSWORD || 'your_mqtt_password',
  protocol: 'mqtts',
  port: 8883,
  rejectUnauthorized: true, // Set to false if using self-signed certificates
  clean: true,
  connectTimeout: 30000,
  reconnectPeriod: 1000,
  keepalive: 60
};
const mqttClient = mqtt.connect(MQTT_BROKER, MQTT_OPTIONS);

// MQTT Topics (matching your ESP32 code)
const topics = {
  control: {
    light: 'lucas/iot/room/light/control',
    device: 'lucas/iot/dorm/device/control',
    pump: 'lucas/iot/pump/control'
  },
  status: {
    light: 'lucas/iot/room/light/status',
    device: 'lucas/iot/dorm/device/status',
    pump: 'lucas/iot/pump/status'
  },
  sensors: {
    temperature: 'lucas/iot/sensors/temperature',
    humidity: 'lucas/iot/sensors/humidity',
    motionRoom: 'lucas/iot/room/motion',
    motionDorm: 'lucas/iot/dorm/motion'
  }
};

// Device state tracking
let deviceState = {
  light: false,
  device: false,
  pump: false,
  temperature: 0,
  humidity: 0,
  motionRoom: false,
  motionDorm: false,
  lastUpdate: new Date(),
  mqttConnected: false
};

// MQTT Event Handlers
mqttClient.on('connect', () => {
  console.log('✅ Connected to MQTT broker');
  deviceState.mqttConnected = true;
  
  // Subscribe to all status and sensor topics
  const allTopics = [
    ...Object.values(topics.status),
    ...Object.values(topics.sensors)
  ];
  
  allTopics.forEach(topic => {
    mqttClient.subscribe(topic);
    console.log(`📡 Subscribed to ${topic}`);
  });
  
  // Broadcast connection status to all clients
  io.emit('mqtt-status', { connected: true });
});

mqttClient.on('disconnect', () => {
  console.log('❌ Disconnected from MQTT broker');
  deviceState.mqttConnected = false;
  io.emit('mqtt-status', { connected: false });
});

mqttClient.on('error', (error) => {
  console.error('MQTT Error:', error);
  deviceState.mqttConnected = false;
  io.emit('mqtt-status', { connected: false });
});

mqttClient.on('message', (topic, message) => {
  const messageStr = message.toString();
  const timestamp = new Date();
  
  console.log(`📨 Received: ${topic} = ${messageStr}`);
  
  // Update device state based on received messages
  switch(topic) {
    case topics.status.light:
      deviceState.light = messageStr === '1';
      break;
    case topics.status.device:
      deviceState.device = messageStr === '1';
      break;
    case topics.status.pump:
      deviceState.pump = messageStr === '1';
      break;
    case topics.sensors.temperature:
      deviceState.temperature = parseFloat(messageStr) || 0;
      break;
    case topics.sensors.humidity:
      deviceState.humidity = parseFloat(messageStr) || 0;
      break;
    case topics.sensors.motionRoom:
      if (messageStr === '1') {
        deviceState.motionRoom = true;
        // Reset motion after 3 seconds
        setTimeout(() => {
          deviceState.motionRoom = false;
          io.emit('device-update', deviceState);
        }, 3000);
      }
      break;
    case topics.sensors.motionDorm:
      if (messageStr === '1') {
        deviceState.motionDorm = true;
        // Reset motion after 3 seconds
        setTimeout(() => {
          deviceState.motionDorm = false;
          io.emit('device-update', deviceState);
        }, 3000);
      }
      break;
  }
  
  deviceState.lastUpdate = timestamp;
  
  // Broadcast updated state to all connected clients
  io.emit('device-update', deviceState);
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  // Send current state to newly connected client
  socket.emit('device-update', deviceState);
  socket.emit('mqtt-status', { connected: deviceState.mqttConnected });
  
  // Handle device control commands from client
  socket.on('control-device', (data) => {
    const { device, command } = data;
    
    if (topics.control[device]) {
      const topic = topics.control[device];
      const message = command ? '1' : '0';
      
      mqttClient.publish(topic, message);
      console.log(`📤 Sent: ${topic} = ${message}`);
      
      // Acknowledge command to client
      socket.emit('command-sent', { device, command, success: true });
    } else {
      console.log(`❌ Unknown device: ${device}`);
      socket.emit('command-sent', { device, command, success: false, error: 'Unknown device' });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// REST API Endpoints

// Authentication routes
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required'
    });
  }
  
  auth.login(username, password, (result) => {
    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  });
});

app.post('/api/auth/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  
  const decoded = auth.verifyToken(token);
  if (decoded) {
    res.json({ success: true, user: decoded });
  } else {
    res.status(403).json({ success: false, message: 'Invalid token' });
  }
});

// Protected routes
app.get('/api/status', auth.authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: deviceState,
    timestamp: new Date()
  });
});

app.post('/api/control/:device', auth.authenticateToken, (req, res) => {
  const device = req.params.device;
  const { command } = req.body;
  
  if (topics.control[device]) {
    const topic = topics.control[device];
    const message = command ? '1' : '0';
    
    mqttClient.publish(topic, message);
    console.log(`📤 API: ${topic} = ${message}`);
    
    res.json({
      success: true,
      message: `Command sent to ${device}`,
      device,
      command
    });
  } else {
    res.status(400).json({
      success: false,
      error: `Unknown device: ${device}`
    });
  }
});

// User management routes (admin only)
app.post('/api/users', auth.authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  
  const { username, password, role = 'user' } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required'
    });
  }
  
  auth.database.createUser(username, password, role, (err, user) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message.includes('UNIQUE') ? 'Username already exists' : 'Error creating user'
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user
    });
  });
});

app.get('/api/users', auth.authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  
  auth.database.getAllUsers((err, users) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching users'
      });
    }
    
    res.json({
      success: true,
      users
    });
  });
});

app.put('/api/users/:username/password', auth.authenticateToken, (req, res) => {
  const targetUsername = req.params.username;
  const { newPassword } = req.body;
  
  // Users can change their own password, admins can change anyone's
  if (req.user.role !== 'admin' && req.user.username !== targetUsername) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }
  
  if (!newPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password is required'
    });
  }
  
  auth.database.updateUserPassword(targetUsername, newPassword, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error updating password'
      });
    }
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  });
});

app.delete('/api/users/:username', auth.authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  
  const username = req.params.username;
  
  // Prevent admin from deleting themselves
  if (username === req.user.username) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete your own account'
    });
  }
  
  auth.database.deleteUser(username, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error deleting user'
      });
    }
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  });
});

// Serve the main page (protected)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    mqtt: deviceState.mqttConnected,
    uptime: process.uptime(),
    timestamp: new Date()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('🚀 IoT Lab2 Web Controller Started');
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`📡 MQTT Broker: ${MQTT_BROKER}`);
  console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  auth.database.closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  auth.database.closeDatabase();
  process.exit(0);
});
