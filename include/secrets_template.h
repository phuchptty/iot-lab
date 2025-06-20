#ifndef SECRETS_TEMPLATE_H
#define SECRETS_TEMPLATE_H

/*
 * SECURITY TEMPLATE FOR MQTT CREDENTIALS
 * 
 * This is a template file. Copy this to secrets.h and replace the placeholders
 * with your actual obfuscated credentials.
 * 
 * IMPORTANT: Never commit secrets.h to version control!
 * 
 * To generate obfuscated credentials:
 * 1. Run: python obfuscate_credentials.py
 * 2. Copy the generated arrays into secrets.h
 * 3. Update the XOR_KEY if you used a different one
 */

// XOR obfuscation key - change this to match your chosen key
#define XOR_KEY 0xAB

// Replace these with your actual obfuscated credentials
const char obfuscated_mqtt_server[] = {
    // Replace with output from obfuscate_credentials.py
    0x00 // Placeholder - replace with actual obfuscated server
};

const char obfuscated_mqtt_username[] = {
    // Replace with output from obfuscate_credentials.py
    0x00 // Placeholder - replace with actual obfuscated username
};

const char obfuscated_mqtt_password[] = {
    // Replace with output from obfuscate_credentials.py
    0x00 // Placeholder - replace with actual obfuscated password
};

// Function to deobfuscate strings at runtime
inline void deobfuscate(char* dest, const char* src, size_t len) {
    for (size_t i = 0; i < len && src[i] != 0; i++) {
        dest[i] = src[i] ^ XOR_KEY;
    }
    dest[len-1] = '\0';
}

// Secure credential getter functions
inline const char* getMqttServer() {
    static char server[100];
    static bool initialized = false;
    if (!initialized) {
        deobfuscate(server, obfuscated_mqtt_server, sizeof(server));
        initialized = true;
    }
    return server;
}

inline const char* getMqttUsername() {
    static char username[20];
    static bool initialized = false;
    if (!initialized) {
        deobfuscate(username, obfuscated_mqtt_username, sizeof(username));
        initialized = true;
    }
    return username;
}

inline const char* getMqttPassword() {
    static char password[20];
    static bool initialized = false;
    if (!initialized) {
        deobfuscate(password, obfuscated_mqtt_password, sizeof(password));
        initialized = true;
    }
    return password;
}

#endif // SECRETS_TEMPLATE_H
