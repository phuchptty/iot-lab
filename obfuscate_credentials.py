#!/usr/bin/env python3
"""
Advanced Firebase Credentials Obfuscation Tool for ESP32 IoT Project
This tool helps generate XOR-obfuscated credentials for your secrets.h file
"""

import random
import re
import os

def xor_obfuscate(text, key):
    """XOR obfuscate a string with the given key"""
    return [ord(char) ^ key for char in text]

def generate_c_array(name, obfuscated_data):
    """Generate C array declaration"""
    # Format arrays with line breaks for readability
    hex_values = []
    for i, val in enumerate(obfuscated_data):
        if i % 8 == 0 and i > 0:
            hex_values.append(f'\n    0x{val:02X}')
        else:
            hex_values.append(f'0x{val:02X}')
    
    hex_string = ', '.join(hex_values)
    return f"const char {name}[] = {{\n    {hex_string}, 0x00\n}};"

def validate_credentials(firebase_host, firebase_auth):
    """Validate Firebase credential format"""
    issues = []
    
    # Validate Firebase host format
    if not firebase_host:
        issues.append("Firebase host cannot be empty")
    elif not re.search(r'^[a-zA-Z0-9\-]+.*\.firebaseio\.com$', firebase_host):
        issues.append("Firebase host format appears invalid")
    
    # Validate Firebase auth token
    if not firebase_auth:
        issues.append("Firebase auth token cannot be empty")
    elif len(firebase_auth) < 20:
        issues.append("Firebase auth token seems too short (should be at least 20 characters)")
    
    return issues

def create_secrets_file(host_obf, auth_obf, xor_key):
    """Create the complete secrets.h file for Firebase"""
    
    template = f'''#ifndef SECRETS_H
#define SECRETS_H

// XOR obfuscation key - KEEP THIS SECRET!
#define XOR_KEY 0x{xor_key:02X}

// Obfuscated Firebase credentials
{generate_c_array("obfuscated_firebase_host", host_obf)}

{generate_c_array("obfuscated_firebase_auth", auth_obf)}

// Function to deobfuscate strings at runtime
inline void deobfuscate(char* dest, const char* src, size_t len) {{
    for (size_t i = 0; i < len && src[i] != 0; i++) {{
        dest[i] = src[i] ^ XOR_KEY;
    }}
    dest[len-1] = '\\0';
}}

// Secure credential getter functions
inline const char* getFirebaseHost() {{
    static char host[100];
    static bool initialized = false;
    if (!initialized) {{
        deobfuscate(host, obfuscated_firebase_host, sizeof(host));
        initialized = true;
    }}
    return host;
}}

inline const char* getFirebaseAuth() {{
    static char auth[100];
    static bool initialized = false;
    if (!initialized) {{
        deobfuscate(auth, obfuscated_firebase_auth, sizeof(auth));
        initialized = true;
    }}
    return auth;
}}

#endif // SECRETS_H'''
    
    # Ensure include directory exists
    os.makedirs("include", exist_ok=True)
    
    # Write to secrets.h
    with open("include/secrets.h", "w") as f:
        f.write(template)

def main():
    print("=== Advanced Firebase Credentials Obfuscation Tool ===")
    print("This tool creates secure, obfuscated Firebase credentials for your ESP32 project\n")
    
    # Get credentials from user
    print("📋 Enter your Firebase credentials:")
    print("💡 Firebase Host example: your-project-default-rtdb.firebaseio.com")
    firebase_host = input("Firebase Host: ").strip()
    
    print("💡 Firebase Auth Token: Your database secret or service account key")
    firebase_auth = input("Firebase Auth Token: ").strip()
    
    # Validate credentials
    issues = validate_credentials(firebase_host, firebase_auth)
    if issues:
        print("\n⚠️  Validation Issues:")
        for issue in issues:
            print(f"   • ⚠️  {issue}")
        
        continue_anyway = input("\nContinue anyway? (y/N): ").strip().lower()
        if continue_anyway != 'y':
            print("Setup cancelled. Please update your credentials and try again.")
            return
    
    # XOR key selection
    print("\n🔐 XOR Key Configuration:")
    print("1. Generate random key (recommended)")
    print("2. Use custom key")
    print("3. Use default key (0x3F)")
    
    choice = input("Choose option (1-3): ").strip()
    
    if choice == "1":
        xor_key = random.randint(0x10, 0xFF)
        print(f"Generated random key: 0x{xor_key:02X}")
    elif choice == "2":
        xor_key_input = input("Enter XOR Key (hex): ").strip()
        try:
            xor_key = int(xor_key_input, 16)
        except ValueError:
            print("Invalid hex value, using random key")
            xor_key = random.randint(0x10, 0xFF)
    else:
        xor_key = 0x3F
    
    print(f"\n🔒 Using XOR Key: 0x{xor_key:02X}")
    
    # Obfuscate credentials
    host_obf = xor_obfuscate(firebase_host, xor_key)
    auth_obf = xor_obfuscate(firebase_auth, xor_key)
    
    # Create secrets.h file
    print("\n📁 Generating secrets.h file...")
    try:
        create_secrets_file(host_obf, auth_obf, xor_key)
        print("✅ Successfully created: include/secrets.h")
    except Exception as e:
        print(f"❌ Error creating secrets.h: {e}")
        return
    
    # Verify deobfuscation
    print("\n🔍 Verification (deobfuscated values):")
    def deobfuscate(data, key):
        return ''.join(chr(val ^ key) for val in data)
    
    print(f"Firebase Host: {deobfuscate(host_obf, xor_key)}")
    print(f"Firebase Auth: {'*' * min(len(firebase_auth), 10)}...")
    
    print("\n🎉 Setup Complete!")
    print("Your Firebase credentials are now obfuscated and stored in include/secrets.h")
    print("\n📝 Next steps:")
    print("1. Verify your project compiles successfully")
    print("2. Test Firebase connection with obfuscated credentials")
    print("3. Make sure include/secrets.h is in your .gitignore")
    print("4. Set up proper Firebase database rules for security")

if __name__ == "__main__":
    main()
    print("\\n🎉 Setup Complete!")
    print("Your credentials are now obfuscated and stored in include/secrets.h")
    print("\\n📝 Next steps:")
    print("1. Verify your project compiles successfully")
    print("2. Test MQTT connection with obfuscated credentials")
    print("3. Make sure include/secrets.h is in your .gitignore")

if __name__ == "__main__":
    main()
