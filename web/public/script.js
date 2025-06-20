// IoT Lab2 Web Controller JavaScript
let socket;
let authToken = null;
let deviceState = {
    light: false,
    device: false,
    pump: false,
    temperature: 0,
    humidity: 0,
    motionRoom: false,
    motionDorm: false,
    lastUpdate: null,
    mqttConnected: false
};

// Check authentication on page load
document.addEventListener('DOMContentLoaded', function () {
    checkAuthentication();
});

// Check if user is authenticated
async function checkAuthentication() {
    authToken = localStorage.getItem('iot_token');

    if (!authToken) {
        redirectToLogin();
        return;
    }

    try {
        const response = await fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            // User is authenticated, initialize the app
            document.getElementById('username').textContent = data.user.username;
            initializeSocket();
            setupEventListeners();
            console.log('🚀 IoT Lab2 Web Controller initialized');
        } else {
            redirectToLogin();
        }
    } catch (error) {
        console.error('Authentication check failed:', error);
        redirectToLogin();
    }
}

// Redirect to login page
function redirectToLogin() {
    localStorage.removeItem('iot_token');
    window.location.href = '/login';
}

// Logout function
function logout() {
    localStorage.removeItem('iot_token');
    if (socket) {
        socket.disconnect();
    }
    showNotification('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = '/login';
    }, 1000);
}

// Initialize Socket.IO connection with authentication
function initializeSocket() {
    socket = io({
        auth: {
            token: authToken
        }
    });

    socket.on('connect', function () {
        console.log('✅ Connected to server');
        showNotification('Connected to server', 'success');
    });

    socket.on('disconnect', function () {
        console.log('❌ Disconnected from server');
        showNotification('Disconnected from server', 'warning');
    });

    socket.on('device-update', function (data) {
        deviceState = { ...deviceState, ...data };
        updateUI();
    });

    socket.on('mqtt-status', function (data) {
        deviceState.mqttConnected = data.connected;
        updateMQTTStatus();
    });

    socket.on('command-sent', function (data) {
        if (data.success) {
            console.log(`✅ Command sent: ${data.device} ${data.command ? 'ON' : 'OFF'}`);
        } else {
            console.error(`❌ Command failed: ${data.error}`);
            showNotification(`Command failed: ${data.error}`, 'danger');
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Auto-refresh every 30 seconds
    setInterval(refreshStatus, 30000);

    // Update last update time every second
    setInterval(updateLastUpdateTime, 1000);
}

// Control device function
function controlDevice(device, command) {
    if (!deviceState.mqttConnected) {
        showNotification('MQTT not connected', 'warning');
        return;
    }

    socket.emit('control-device', { device, command });

    // Visual feedback
    const button = document.getElementById(`${device}-${command ? 'on' : 'off'}`);
    if (button) {
        button.disabled = true;
        setTimeout(() => button.disabled = false, 1000);
    }

    console.log(`📤 Controlling ${device}: ${command ? 'ON' : 'OFF'}`);
}

// Quick action functions
function allDevicesOn() {
    controlDevice('light', true);
    setTimeout(() => controlDevice('device', true), 200);
    setTimeout(() => controlDevice('pump', true), 400);
    showNotification('All devices turned ON', 'success');
}

function allDevicesOff() {
    controlDevice('light', false);
    setTimeout(() => controlDevice('device', false), 200);
    setTimeout(() => controlDevice('pump', false), 400);
    showNotification('All devices turned OFF', 'info');
}

function refreshStatus() {
    // Request fresh data from server
    fetch('/api/status',
        {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                deviceState = { ...deviceState, ...data.data };
                updateUI();
                showNotification('Status refreshed', 'success');
            }
        })
        .catch(error => {
            console.error('Error refreshing status:', error);
            showNotification('Failed to refresh status', 'danger');
        });
}

// Update UI based on current device state
function updateUI() {
    updateDeviceStatus('light', deviceState.light);
    updateDeviceStatus('device', deviceState.device);
    updateDeviceStatus('pump', deviceState.pump);
    updateSensorReadings();
    updateMotionStatus();
    updateLastUpdate();
}

// Update individual device status
function updateDeviceStatus(device, isOn) {
    const icon = document.getElementById(`${device}-icon`);
    const status = document.getElementById(`${device}-status`);
    const onBtn = document.getElementById(`${device}-on`);
    const offBtn = document.getElementById(`${device}-off`);

    if (icon && status && onBtn && offBtn) {
        // Update icon
        icon.className = isOn ?
            icon.className.replace('-off', '').replace('text-muted', 'active') :
            icon.className.replace('active', 'text-muted');

        // Update status text
        status.textContent = isOn ? 'ON' : 'OFF';
        status.className = `card-text status-text ${isOn ? 'on' : 'off'}`;

        // Update buttons
        if (isOn) {
            onBtn.className = 'btn btn-success';
            offBtn.className = 'btn btn-outline-secondary';
        } else {
            onBtn.className = 'btn btn-outline-success';
            offBtn.className = 'btn btn-secondary';
        }
    }
}

// Update sensor readings
function updateSensorReadings() {
    // Temperature
    const tempValue = document.getElementById('temperature-value');
    const tempBar = document.getElementById('temperature-bar');
    if (tempValue && tempBar) {
        tempValue.textContent = `${deviceState.temperature.toFixed(1)}°C`;
        const tempPercent = Math.min(Math.max((deviceState.temperature / 50) * 100, 0), 100);
        tempBar.style.width = `${tempPercent}%`;

        // Color coding for temperature
        if (deviceState.temperature < 20) {
            tempBar.className = 'progress-bar bg-info';
        } else if (deviceState.temperature < 30) {
            tempBar.className = 'progress-bar bg-success';
        } else if (deviceState.temperature < 40) {
            tempBar.className = 'progress-bar bg-warning';
        } else {
            tempBar.className = 'progress-bar bg-danger';
        }
    }

    // Humidity
    const humValue = document.getElementById('humidity-value');
    const humBar = document.getElementById('humidity-bar');
    if (humValue && humBar) {
        humValue.textContent = `${deviceState.humidity.toFixed(1)}%`;
        humBar.style.width = `${Math.min(deviceState.humidity, 100)}%`;

        // Color coding for humidity (pump threshold is 40%)
        if (deviceState.humidity < 40) {
            humBar.className = 'progress-bar bg-danger';
        } else if (deviceState.humidity < 60) {
            humBar.className = 'progress-bar bg-warning';
        } else {
            humBar.className = 'progress-bar bg-success';
        }
    }
}

// Update motion detection status
function updateMotionStatus() {
    updateMotionIndicator('room', deviceState.motionRoom);
    updateMotionIndicator('dorm', deviceState.motionDorm);
}

function updateMotionIndicator(location, isActive) {
    const indicator = document.getElementById(`${location}-motion`);
    const status = document.getElementById(`${location}-motion-status`);

    if (indicator && status) {
        if (isActive) {
            indicator.classList.add('active');
            status.textContent = 'Motion!';
            status.className = 'badge bg-warning';
        } else {
            indicator.classList.remove('active');
            status.textContent = 'No Motion';
            status.className = 'badge bg-secondary';
        }
    }
}

// Update MQTT connection status
function updateMQTTStatus() {
    const status = document.getElementById('mqtt-status');
    if (status) {
        if (deviceState.mqttConnected) {
            status.innerHTML = '<i class="bi bi-wifi"></i> Connected';
            status.className = 'badge bg-success me-2';
        } else {
            status.innerHTML = '<i class="bi bi-wifi-off"></i> Disconnected';
            status.className = 'badge bg-danger me-2';
        }
    }
}

// Update last update time
function updateLastUpdate() {
    const lastUpdate = document.getElementById('last-update');
    const lastUpdateDetail = document.getElementById('last-update-detail');

    if (deviceState.lastUpdate) {
        const updateTime = new Date(deviceState.lastUpdate);
        const timeStr = updateTime.toLocaleTimeString();

        if (lastUpdate) lastUpdate.textContent = timeStr;
        if (lastUpdateDetail) lastUpdateDetail.textContent = updateTime.toLocaleString();
    }
}

// Update last update time display (relative time)
function updateLastUpdateTime() {
    if (deviceState.lastUpdate) {
        const now = new Date();
        const lastUpdate = new Date(deviceState.lastUpdate);
        const diffSeconds = Math.floor((now - lastUpdate) / 1000);

        const lastUpdateEl = document.getElementById('last-update');
        if (lastUpdateEl) {
            if (diffSeconds < 60) {
                lastUpdateEl.textContent = `${diffSeconds}s ago`;
            } else if (diffSeconds < 3600) {
                lastUpdateEl.textContent = `${Math.floor(diffSeconds / 60)}m ago`;
            } else {
                lastUpdateEl.textContent = lastUpdate.toLocaleTimeString();
            }
        }
    }
}

// Show notification (Bootstrap toast-like)
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 1050; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);

    console.log(`📢 ${type.toUpperCase()}: ${message}`);
}

// Error handling
window.addEventListener('error', function (e) {
    console.error('JavaScript Error:', e.error);
    showNotification('An error occurred. Check console for details.', 'danger');
});

// Online/Offline detection
window.addEventListener('online', function () {
    showNotification('Internet connection restored', 'success');
});

window.addEventListener('offline', function () {
    showNotification('Internet connection lost', 'warning');
});
