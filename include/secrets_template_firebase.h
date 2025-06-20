#ifndef SECRETS_H
#define SECRETS_H

// XOR obfuscation key - KEEP THIS SECRET!
#define XOR_KEY 0x3F

// Firebase credentials - Replace with your actual Firebase project credentials
// Format for Firebase Host: "your-project-id-default-rtdb.firebaseio.com"
// Format for Firebase Auth Token: Your database secret or service account key

// Example obfuscated Firebase credentials (you need to generate these)
const char obfuscated_firebase_host[] = {
    // Replace with obfuscated version of your Firebase host
    // Example: "myproject-default-rtdb.firebaseio.com"
    0x73, 0x52, 0x50, 0x49, 0x74, 0x53, 0x49, 0x52, 
    0x4A, 0x45, 0x43, 0x74, 0x46, 0x4C, 0x49, 0x45, 
    0x42, 0x41, 0x53, 0x45, 0x2D, 0x49, 0x4F, 0x00
};

const char obfuscated_firebase_auth[] = {
    // Replace with obfuscated version of your Firebase auth token
    // This should be your database secret or service account key
    0x61, 0x49, 0x7A, 0x61, 0x53, 0x79, 0x44, 0x5F, 
    0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 
    0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F, 0x70, 
    0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 
    0x79, 0x7A, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 
    0x00
};

// Function to deobfuscate strings at runtime
inline void deobfuscate(char* dest, const char* src, size_t len) {
    for (size_t i = 0; i < len && src[i] != 0; i++) {
        dest[i] = src[i] ^ XOR_KEY;
    }
    dest[len-1] = '\0';
}

// Secure credential getter functions
inline const char* getFirebaseHost() {
    static char host[100];
    static bool initialized = false;
    if (!initialized) {
        deobfuscate(host, obfuscated_firebase_host, sizeof(host));
        initialized = true;
    }
    return host;
}

inline const char* getFirebaseAuth() {
    static char auth[100];
    static bool initialized = false;
    if (!initialized) {
        deobfuscate(auth, obfuscated_firebase_auth, sizeof(auth));
        initialized = true;
    }
    return auth;
}

#endif // SECRETS_H

/*
HOW TO GENERATE OBFUSCATED CREDENTIALS:

1. Get your Firebase project credentials:
   - Firebase Host: Go to Firebase Console -> Realtime Database -> Copy the URL without https://
   - Firebase Auth: Go to Project Settings -> Service Accounts -> Database Secrets -> Copy the secret

2. Use the obfuscation tool to generate the obfuscated arrays:
   Run: python obfuscate_credentials.py
   
3. Replace the arrays above with your generated obfuscated credentials

FIREBASE SETUP:
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Realtime Database
3. Set database rules for testing (make more restrictive for production):
   {
     "rules": {
       "iot_devices": {
         ".read": true,
         ".write": true
       }
     }
   }
4. Copy your project credentials and obfuscate them
*/
