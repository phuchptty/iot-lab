# IoT Lab2 Web Controller

A modern web interface to control your IoT Lab2 device via MQTT using Node.js and Bootstrap 5.

## Features

### 🎛️ Device Control
- **Room Light**: Manual ON/OFF control with real-time status
- **Dorm Device**: Manual ON/OFF control with real-time status  
- **Water Pump**: Manual ON/OFF control with real-time status

### 📊 Real-time Monitoring
- **Temperature**: Live readings with color-coded progress bar
- **Humidity**: Live readings with pump threshold indicator (40%)
- **Motion Detection**: Visual indicators for room and dorm motion sensors
- **MQTT Status**: Connection status indicator

### 🚀 Features
- **Real-time Updates**: Uses WebSocket (Socket.IO) for instant updates
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Bootstrap 5**: Modern, clean UI with animations and transitions
- **Auto-refresh**: Automatically updates every 30 seconds
- **Quick Actions**: Control all devices at once
- **Error Handling**: User-friendly error messages and notifications

## Screenshots

The web interface includes:
- Device control cards with ON/OFF buttons
- Real-time sensor readings with progress bars
- Motion detection indicators with animations
- System information panel
- MQTT connection status

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)
- Your ESP32 running the MQTT version of the IoT Lab2 code

### Setup Instructions

1. **Navigate to the web directory**:
   ```powershell
   cd "c:\Users\Lucas\Desktop\hetcuu\IOT Lab2\IoT Lab2\web"
   ```

2. **Install dependencies**:
   ```powershell
   npm install
   ```

3. **Start the server**:
   ```powershell
   npm start
   ```

4. **Open your browser**:
   - Go to: `http://localhost:3000`
   - The web interface should load automatically

### Development Mode
For development with auto-restart on file changes:
```powershell
npm run dev
```

## Configuration

### MQTT Broker Settings
The server is configured to use `broker.emqx.io:1883` by default, matching your ESP32 code.

To change the MQTT broker, edit `server.js`:
```javascript
const MQTT_BROKER = 'mqtt://your-broker.com:1883';
```

### Port Configuration
Default port is 3000. To change it, set the PORT environment variable:
```powershell
$env:PORT=8080; npm start
```

## API Endpoints

### REST API
- `GET /api/status` - Get current device status
- `POST /api/control/:device` - Control a device
  - Body: `{"command": true}` for ON, `{"command": false}` for OFF
  - Devices: `light`, `device`, `pump`

### WebSocket Events
- `device-update` - Real-time device status updates
- `mqtt-status` - MQTT connection status
- `control-device` - Send control commands
- `command-sent` - Command confirmation

## Usage

### Device Control
1. **Manual Control**: Click ON/OFF buttons for any device
2. **Quick Actions**: Use "All Devices ON/OFF" for bulk control
3. **Auto Mode**: Devices return to automatic mode after 10 seconds of no manual control

### Monitoring
1. **Sensor Readings**: Temperature and humidity update automatically
2. **Motion Detection**: Visual indicators show when motion is detected
3. **Connection Status**: Green badge indicates MQTT connection is active

### Automatic Features (ESP32 Side)
- **Room Light**: Turns ON with motion, OFF after 5 seconds
- **Dorm Device**: Turns ON with motion, OFF after 5 seconds
- **Water Pump**: Turns ON when humidity < 40%, OFF when >= 40%

## MQTT Topics

The web server uses the same topics as your ESP32:

### Control Topics (Web → ESP32)
- `lucas/iot/room/light/control`
- `lucas/iot/dorm/device/control`
- `lucas/iot/pump/control`

### Status Topics (ESP32 → Web)
- `lucas/iot/room/light/status`
- `lucas/iot/dorm/device/status`
- `lucas/iot/pump/status`

### Sensor Topics (ESP32 → Web)
- `lucas/iot/sensors/temperature`
- `lucas/iot/sensors/humidity`
- `lucas/iot/room/motion`
- `lucas/iot/dorm/motion`

## Troubleshooting

### Web Server Won't Start
```powershell
# Check if Node.js is installed
node --version

# Check if npm is installed  
npm --version

# Install dependencies
npm install

# Try starting again
npm start
```

### Can't Control Devices
1. Check MQTT connection status (green badge in header)
2. Verify ESP32 is connected to WiFi and MQTT broker
3. Check ESP32 serial monitor for debug messages
4. Ensure MQTT topics match between web server and ESP32

### Web Page Won't Load
1. Check if server is running: `http://localhost:3000/health`
2. Try a different port: `$env:PORT=8080; npm start`
3. Check firewall settings
4. Clear browser cache

### Real-time Updates Not Working
1. Check browser console for WebSocket errors
2. Verify Socket.IO connection in browser dev tools
3. Restart the web server
4. Check if ESP32 is publishing to MQTT topics

## Browser Compatibility

Tested and working on:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile browsers (iOS/Android)

## Development

### File Structure
```
web/
├── package.json          # Dependencies and scripts
├── server.js            # Node.js server with MQTT and WebSocket
├── public/
│   ├── index.html       # Main HTML page
│   ├── style.css        # Custom CSS styles
│   └── script.js        # Frontend JavaScript
└── README.md           # This file
```

### Adding Features
1. **New Device**: Add MQTT topics in `server.js` and UI elements in `index.html`
2. **New Sensor**: Add topic subscription and UI display elements
3. **Styling**: Modify `style.css` for custom appearance

## Security Notes

- This is a development/demo setup without authentication
- For production use, consider adding:
  - MQTT authentication
  - HTTPS/WSS encryption
  - User authentication
  - Rate limiting

## Support

If you encounter issues:
1. Check the console output for error messages
2. Verify MQTT broker connectivity
3. Ensure ESP32 code is running correctly
4. Check network connectivity

---

**Enjoy controlling your IoT Lab2 device with this modern web interface! 🚀**
