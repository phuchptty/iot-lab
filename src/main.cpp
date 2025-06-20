#include <WiFi.h>
#include <ESP32Servo.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"
#include "secrets.h"

// Khai báo thông tin Wifi
char ssid[] = "Wokwi-GUEST";
char pass[] = "";

// Firebase configuration
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Firebase paths
const char *devicePath = "/iot_devices/esp32_lab4";
const char *lightControlPath = "/iot_devices/esp32_lab4/light/control";
const char *lightStatusPath = "/iot_devices/esp32_lab4/light/status";
const char *deviceControlPath = "/iot_devices/esp32_lab4/device/control";
const char *deviceStatusPath = "/iot_devices/esp32_lab4/device/status";
const char *servoControlPath = "/iot_devices/esp32_lab4/pump/control";
const char *servoStatusPath = "/iot_devices/esp32_lab4/pump/status";
const char *temperaturePath = "/iot_devices/esp32_lab4/sensors/temperature";
const char *humidityPath = "/iot_devices/esp32_lab4/sensors/humidity";
const char *motionRoomPath = "/iot_devices/esp32_lab4/motion/room";
const char *motionDormPath = "/iot_devices/esp32_lab4/motion/dorm";

// Khai báo chân kết nối phần cứng
#define PIR_ROOM_PIN 27
#define PIR_DORM_PIN 26
#define RELAY_LIGHT_PIN 14
#define RELAY_DEVICE_PIN 12
#define SERVO_PIN 13
#define DHT_PIN 21
#define DHT_TYPE DHT22

// Tạo đối tượng điều khiển
Servo servoPump;
DHT dht(DHT_PIN, DHT_TYPE);

// Timing for sensor updates
unsigned long lastSensorUpdate = 0;
const unsigned long sensorUpdateInterval = 3500;

// Timing for Firebase updates
unsigned long lastFirebaseCheck = 0;
const unsigned long firebaseCheckInterval = 1000;

// Trạng thái của công cụ
bool relayLightState = false;
bool relayDeviceState = false;
bool servoOn = false;

// Trạng thái điều khiển
bool manualLight = false;
bool manualDevice = false;
bool manualServo = false;

unsigned long lastRoomMotion = 0;
unsigned long lastDormMotion = 0;
unsigned long lastManualLight = 0;
unsigned long lastManualDevice = 0;
unsigned long lastManualServo = 0;

const unsigned long motionTimeout = 5000;  // Sau 5 giây không có người -> tắt thiết bị
const unsigned long manualTimeout = 10000; // sau 10 giây không chạm -> về auto

// Hàm kết nối Wi-Fi
void setup_wifi()
{
  delay(10);
  Serial.print("Connecting to WiFi ");
  WiFi.begin(ssid, pass);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" connected");
}

// Initialize Firebase
void initFirebase()
{
  config.host = getFirebaseHost();
  config.signer.tokens.legacy_token = getFirebaseAuth();

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println("Firebase initialized");
}

// Check Firebase for control commands
void checkFirebaseCommands()
{ // Check light control
  if (Firebase.RTDB.getInt(&fbdo, lightControlPath))
  {
    int lightControl = fbdo.to<int>();
    if (lightControl == 1 && !relayLightState)
    {
      manualLight = true;
      lastManualLight = millis();
      relayLightState = true;
      digitalWrite(RELAY_LIGHT_PIN, HIGH);
      Serial.println("Firebase: Bật đèn");
      Firebase.RTDB.setInt(&fbdo, lightStatusPath, 1);
      // Clear the control command to prevent repeated execution
      Firebase.RTDB.setInt(&fbdo, lightControlPath, -1);
    }
    else if (lightControl == 0 && relayLightState)
    {
      manualLight = true;
      lastManualLight = millis();
      relayLightState = false;
      digitalWrite(RELAY_LIGHT_PIN, LOW);
      Serial.println("Firebase: Tắt đèn");
      Firebase.RTDB.setInt(&fbdo, lightStatusPath, 0);
      // Clear the control command to prevent repeated execution
      Firebase.RTDB.setInt(&fbdo, lightControlPath, -1);
    }
  }
  // Check device control
  if (Firebase.RTDB.getInt(&fbdo, deviceControlPath))
  {
    int deviceControl = fbdo.to<int>();
    if (deviceControl == 1 && !relayDeviceState)
    {
      manualDevice = true;
      lastManualDevice = millis();
      relayDeviceState = true;
      digitalWrite(RELAY_DEVICE_PIN, HIGH);
      Serial.println("Firebase: Bật thiết bị");
      Firebase.RTDB.setInt(&fbdo, deviceStatusPath, 1);
      // Clear the control command to prevent repeated execution
      Firebase.RTDB.setInt(&fbdo, deviceControlPath, -1);
    }
    else if (deviceControl == 0 && relayDeviceState)
    {
      manualDevice = true;
      lastManualDevice = millis();
      relayDeviceState = false;
      digitalWrite(RELAY_DEVICE_PIN, LOW);
      Serial.println("Firebase: Tắt thiết bị");
      Firebase.RTDB.setInt(&fbdo, deviceStatusPath, 0);
      // Clear the control command to prevent repeated execution
      Firebase.RTDB.setInt(&fbdo, deviceControlPath, -1);
    }
  }
  // Check servo control
  if (Firebase.RTDB.getInt(&fbdo, servoControlPath))
  {
    int servoControl = fbdo.to<int>();
    if (servoControl == 1 && !servoOn)
    {
      manualServo = true;
      lastManualServo = millis();
      servoPump.write(90);
      servoOn = true;
      Serial.println("Firebase: Bật máy bơm");
      Firebase.RTDB.setInt(&fbdo, servoStatusPath, 1);
      // Clear the control command to prevent repeated execution
      Firebase.RTDB.setInt(&fbdo, servoControlPath, -1);
    }
    else if (servoControl == 0 && servoOn)
    {
      manualServo = true;
      lastManualServo = millis();
      servoPump.write(0);
      servoOn = false;
      Serial.println("Firebase: Tắt máy bơm");
      Firebase.RTDB.setInt(&fbdo, servoStatusPath, 0);
      // Clear the control command to prevent repeated execution
      Firebase.RTDB.setInt(&fbdo, servoControlPath, -1);
    }
  }
}

void update_sensor()
{
  // Cập nhật sensor readings qua Firebase
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  if (isnan(temperature))
  {
    Serial.println("Cảm biến nhiệt độ lỗi");
  }
  else
  {
    Firebase.RTDB.setFloat(&fbdo, temperaturePath, temperature);
    // Serial.print("Nhiệt độ: ");
    // Serial.println(temperature);
  }

  if (!isnan(humidity))
  {
    Firebase.RTDB.setFloat(&fbdo, humidityPath, humidity);
    // Serial.print("Độ ẩm: ");
    // Serial.println(humidity);
  }
  else
  {
    Serial.println("Cảm biến độ ẩm lỗi");
  }
}

void setup()
{
  Serial.begin(115200);
  setup_wifi();

  // Initialize Firebase
  initFirebase();

  pinMode(PIR_ROOM_PIN, INPUT);
  pinMode(PIR_DORM_PIN, INPUT);

  pinMode(RELAY_LIGHT_PIN, OUTPUT);
  pinMode(RELAY_DEVICE_PIN, OUTPUT);

  servoPump.attach(SERVO_PIN);
  servoPump.write(0); // Tắt máy bơm

  digitalWrite(RELAY_LIGHT_PIN, LOW);
  digitalWrite(RELAY_DEVICE_PIN, LOW);

  dht.begin();

  // Set initial status in Firebase
  Firebase.RTDB.setInt(&fbdo, lightStatusPath, 0);
  Firebase.RTDB.setInt(&fbdo, deviceStatusPath, 0);
  Firebase.RTDB.setInt(&fbdo, servoStatusPath, 0);

  Serial.println("Hệ thống sẵn sàng");
}
// ----------------------------------------------

void loop()
{
  // Check Firebase for commands periodically
  unsigned long currentMillis = millis();
  if (currentMillis - lastFirebaseCheck >= firebaseCheckInterval)
  {
    checkFirebaseCommands();
    lastFirebaseCheck = currentMillis;
  }

  // Nếu ở chế độ tay quá 10s -> quay lại auto

  // Kiểm tra timeout để hủy điều khiển tay
  if (manualLight && lastManualLight < currentMillis && (currentMillis - lastManualLight > manualTimeout))
  {
    manualLight = false;
    Serial.println("Quay trở lại chế độ auto");
  }
  if (manualDevice && lastManualDevice < currentMillis && (currentMillis - lastManualDevice > manualTimeout))
  {
    manualDevice = false;
    Serial.println("Quay trở lại chế độ auto");
    Firebase.RTDB.setInt(&fbdo, deviceControlPath, -1);
  }
  if (manualServo && lastManualServo < currentMillis && (currentMillis - lastManualServo > manualTimeout))
  {
    manualServo = false;
    Serial.println("Quay trở lại chế độ auto");
  }
  // Phòng họp: nếu phát hiện người, bật đèn
  if (!manualLight)
  {
    int pirRoom = digitalRead(PIR_ROOM_PIN);
    if (pirRoom == HIGH)
    {
      lastRoomMotion = currentMillis;
      if (!relayLightState)
      {
        relayLightState = true;
        digitalWrite(RELAY_LIGHT_PIN, HIGH);
        Serial.println("Bật đèn");
        Firebase.RTDB.setInt(&fbdo, lightStatusPath, 1);
        Firebase.RTDB.setInt(&fbdo, motionRoomPath, 1);
      }
    }
    else if (relayLightState && (currentMillis - lastRoomMotion > motionTimeout))
    {
      relayLightState = false;
      digitalWrite(RELAY_LIGHT_PIN, LOW);
      Serial.println("Tắt đèn");
      Firebase.RTDB.setInt(&fbdo, lightStatusPath, 0);
    }
  }
  // Ký túc xá: nếu phát hiện người, bật thiết bị
  if (!manualDevice)
  {
    int pirDorm = digitalRead(PIR_DORM_PIN);
    if (pirDorm == HIGH)
    {
      lastDormMotion = currentMillis;
      if (!relayDeviceState)
      {
        relayDeviceState = true;
        digitalWrite(RELAY_DEVICE_PIN, HIGH);
        Serial.println("Bật thiết bị");
        Firebase.RTDB.setInt(&fbdo, deviceStatusPath, 1);
        Firebase.RTDB.setInt(&fbdo, motionDormPath, 1);
      }
    }
    else if (relayDeviceState && (currentMillis - lastDormMotion > motionTimeout))
    {
      relayDeviceState = false;
      digitalWrite(RELAY_DEVICE_PIN, LOW);
      Serial.println("Tắt thiết bị");
      Firebase.RTDB.setInt(&fbdo, deviceStatusPath, 0);
    }
  }
  // Điều khiển servo bơm nước dựa trên độ ẩm
  if (!manualServo)
  {
    float humidity = dht.readHumidity();
    if (!isnan(humidity))
    {
      if (humidity < 40.0 && !servoOn)
      {
        servoPump.write(90);
        servoOn = true;
        Serial.print("Độ ẩm hiện tại: ");
        Serial.println(humidity);
        Serial.println("Bật máy bơm");
        Firebase.RTDB.setInt(&fbdo, servoStatusPath, 1);
      }
      else if (humidity >= 40.0 && servoOn)
      {
        servoPump.write(0);
        servoOn = false;
        Serial.print("Độ ẩm hiện tại: ");
        Serial.println(humidity);
        Serial.println("Tắt máy bơm");
        Firebase.RTDB.setInt(&fbdo, servoStatusPath, 0);
      }
    }
    else
    {
      Serial.println("Cảm biến lỗi");
    }
  }

  // Update sensors via MQTT periodically
  if (currentMillis - lastSensorUpdate >= sensorUpdateInterval)
  {
    update_sensor();
    lastSensorUpdate = currentMillis;
  }
  delay(500);
}