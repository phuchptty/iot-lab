/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onRequest, onCall} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getDatabase} from "firebase-admin/database";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin
initializeApp();

// Interface for device authentication request
interface DeviceAuthRequest {
  deviceId: string;
  deviceType?: string;
  firmwareVersion?: string;
}

// Interface for device registration
interface DeviceRegistration {
  deviceId: string;
  deviceType: string;
  firmwareVersion: string;
  registeredAt: string;
  lastSeen: string;
  status: "active" | "inactive" | "banned";
}

/**
 * Creates a custom token for IoT device authentication
 * This function validates the device ID and creates a custom Firebase token
 */
export const createDeviceToken = onCall<DeviceAuthRequest>(
  {region: "asia-southeast1"},
  async (request) => {
    try {
      const {deviceId, deviceType = "ESP32", firmwareVersion = "1.0.0"} = request.data;

      // Validate input
      if (!deviceId) {
        throw new Error("Device ID is required");
      }

      // Validate device ID format (alphanumeric, hyphens, underscores allowed)
      const deviceIdRegex = /^[a-zA-Z0-9_-]+$/;
      if (!deviceIdRegex.test(deviceId)) {
        throw new Error("Invalid device ID format");
      }

      logger.info(`Creating token for device: ${deviceId}`, {
        deviceType,
        firmwareVersion,
        timestamp: new Date().toISOString(),
      });

      // Check if device is registered and active
      const db = getDatabase();
      const deviceRef = db.ref(`devices/${deviceId}`);
      const deviceSnapshot = await deviceRef.once("value");

      let deviceData: DeviceRegistration;

      if (!deviceSnapshot.exists()) {
        // Register new device
        deviceData = {
          deviceId,
          deviceType,
          firmwareVersion,
          registeredAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          status: "active",
        };

        await deviceRef.set(deviceData);
        logger.info(`New device registered: ${deviceId}`);
      } else {
        deviceData = deviceSnapshot.val();

        // Check if device is banned
        if (deviceData.status === "banned") {
          throw new Error("Device is banned");
        }

        // Update last seen
        await deviceRef.child("lastSeen").set(new Date().toISOString());
        await deviceRef.child("status").set("active");
      }

      // Create custom claims for the device
      const customClaims = {
        deviceId: deviceId,
        deviceType: deviceType,
        role: "iot-device",
        permissions: ["read-sensors", "write-sensors", "device-control"],
        registeredAt: deviceData.registeredAt,
      };

      // Create custom token
      const auth = getAuth();
      const customToken = await auth.createCustomToken(deviceId, customClaims);

      // Log successful token creation
      logger.info(`Custom token created successfully for device: ${deviceId}`);

      // Update device activity log
      const activityRef = db.ref(`device_activity/${deviceId}`);
      await activityRef.push({
        action: "token_created",
        timestamp: new Date().toISOString(),
        ip: request.rawRequest.ip || "unknown",
      });

      return {
        success: true,
        customToken: customToken,
        deviceInfo: {
          deviceId: deviceData.deviceId,
          deviceType: deviceData.deviceType,
          status: deviceData.status,
          registeredAt: deviceData.registeredAt,
        },
        expiresIn: 3600, // Token expires in 1 hour
      };
    } catch (error) {
      logger.error(`Error creating device token: ${error}`, {
        deviceId: request.data?.deviceId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
);

/**
 * HTTP endpoint for device token creation (alternative to callable function)
 * Usage: POST /createDeviceToken with JSON body { "deviceId": "your-device-id" }
 */
export const createDeviceTokenHTTP = onRequest(
  {region: "asia-southeast1", cors: true},
  async (request, response) => {
    try {
      // Only allow POST requests
      if (request.method !== "POST") {
        response.status(405).json({error: "Method not allowed"});
        return;
      }

      const {deviceId, deviceType = "ESP32", firmwareVersion = "1.0.0"} = request.body;

      // Validate input
      if (!deviceId) {
        response.status(400).json({error: "Device ID is required"});
        return;
      }

      // Enhanced validation for ESP32 MAC-based device IDs
      const deviceIdRegex = /^esp32_[A-F0-9]+$|^[a-zA-Z0-9_-]+$/;
      if (!deviceIdRegex.test(deviceId)) {
        response.status(400).json({error: "Invalid device ID format"});
        return;
      }

      logger.info(`HTTP: Creating token for device: ${deviceId}`, {
        deviceType,
        firmwareVersion,
        ip: request.ip,
      });

      // Check device registration (same logic as callable function)
      const db = getDatabase();
      const deviceRef = db.ref(`devices/${deviceId}`);
      const deviceSnapshot = await deviceRef.once("value");

      let deviceData: DeviceRegistration;

      if (!deviceSnapshot.exists()) {
        deviceData = {
          deviceId,
          deviceType,
          firmwareVersion,
          registeredAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          status: "active",
        };

        await deviceRef.set(deviceData);
        logger.info(`HTTP: New device registered: ${deviceId}`);
      } else {
        deviceData = deviceSnapshot.val();

        if (deviceData.status === "banned") {
          response.status(403).json({error: "Device is banned"});
          return;
        }

        await deviceRef.child("lastSeen").set(new Date().toISOString());
        await deviceRef.child("status").set("active");
      }

      // Create custom token with enhanced claims for ESP32
      const customClaims = {
        deviceId: deviceId,
        deviceType: deviceType,
        role: "iot-device",
        permissions: ["read-sensors", "write-sensors", "device-control", "realtime-database"],
        registeredAt: deviceData.registeredAt,
        macAddress: deviceId.startsWith("esp32_") ? deviceId.substring(6) : null,
      };

      const auth = getAuth();
      const customToken = await auth.createCustomToken(deviceId, customClaims);

      // Log activity
      const activityRef = db.ref(`device_activity/${deviceId}`);
      await activityRef.push({
        action: "token_created_http",
        timestamp: new Date().toISOString(),
        ip: request.ip || "unknown",
        userAgent: request.get("User-Agent") || "unknown",
      });

      response.status(200).json({
        success: true,
        customToken: customToken,
        deviceInfo: {
          deviceId: deviceData.deviceId,
          deviceType: deviceData.deviceType,
          status: deviceData.status,
          registeredAt: deviceData.registeredAt,
        },
        expiresIn: 3600,
        message: "Custom token created successfully for ESP32 device",
      });
    } catch (error) {
      logger.error(`HTTP: Error creating device token: ${error}`);
      response.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
);

/**
 * Function to revoke device access (ban a device)
 */
export const banDevice = onCall<{ deviceId: string }>(
  {region: "asia-southeast1"},
  async (request) => {
    try {
      const {deviceId} = request.data;

      if (!deviceId) {
        throw new Error("Device ID is required");
      }

      const db = getDatabase();
      const deviceRef = db.ref(`devices/${deviceId}`);

      // Check if device exists
      const deviceSnapshot = await deviceRef.once("value");
      if (!deviceSnapshot.exists()) {
        throw new Error("Device not found");
      }

      // Ban the device
      await deviceRef.child("status").set("banned");
      await deviceRef.child("bannedAt").set(new Date().toISOString());

      // Log activity
      const activityRef = db.ref(`device_activity/${deviceId}`);
      await activityRef.push({
        action: "device_banned",
        timestamp: new Date().toISOString(),
        ip: request.rawRequest.ip || "unknown",
      });

      logger.info(`Device banned: ${deviceId}`);

      return {
        success: true,
        message: `Device ${deviceId} has been banned`,
      };
    } catch (error) {
      logger.error(`Error banning device: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
);

/**
 * Function to list all registered devices
 */
export const listDevices = onCall(
  {region: "asia-southeast1"},
  async () => {
    try {
      const db = getDatabase();
      const devicesRef = db.ref("devices");
      const devicesSnapshot = await devicesRef.once("value");

      const devices: DeviceRegistration[] = [];
      devicesSnapshot.forEach((child) => {
        devices.push(child.val());
      });

      return {
        success: true,
        devices: devices,
        count: devices.length,
      };
    } catch (error) {
      logger.error(`Error listing devices: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
);

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
