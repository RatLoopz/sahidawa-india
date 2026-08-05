# Security Fix: Encrypt Offline Storage for PHI Data

## Summary
This PR adds encryption to the offline storage to protect Personal Health Information (PHI) stored in browser IndexedDB.

## Problem
The offline-first PWA stores medicine verification data in browser storage without encryption. This exposes sensitive health information to:
- Other browser extensions
- Physical device access
- GDPR/India DPDP compliance risks

## Solution
Implement encryption using the Web Crypto API before storing data.

## Changes Required

### 1. Add Encryption Utility
Create `apps/web/lib/secureStorage.ts`:

```typescript
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

// Generate or retrieve encryption key
async function getEncryptionKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem('sahidawa_enc_key');
  if (stored) {
    const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', raw, ALGORITHM, true, ['encrypt', 'decrypt']);
  }
  
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
  
  const raw = await crypto.subtle.exportKey('raw', key);
  localStorage.setItem('sahidawa_enc_key', btoa(String.fromCharCode(...new Uint8Array(raw))));
  
  return key;
}

// Encrypt data
async function encryptData(data: string): Promise<{ iv: string; encrypted: string }> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );
  
  return {
    iv: btoa(String.fromCharCode(...iv)),
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  };
}

// Decrypt data
async function decryptData(iv: string, encrypted: string): Promise<string> {
  const key = await getEncryptionKey();
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBytes },
    key,
    encryptedBytes
  );
  
  return new TextDecoder().decode(decrypted);
}

export { encryptData, decryptData };
```

### 2. Update Offline Storage
Update `apps/web/lib/offlineStorage.ts`:

```typescript
import { encryptData, decryptData } from './secureStorage';

interface EncryptedRecord {
  iv: string;
  encrypted: string;
  timestamp: number;
}

export async function storeMedicineVerification(data: MedicineVerification) {
  const { iv, encrypted } = await encryptData(JSON.stringify(data));
  const record: EncryptedRecord = { iv, encrypted, timestamp: Date.now() };
  
  await db.medicines.put(record);
}

export async function getMedicineVerification(id: string): Promise<MedicineVerification | null> {
  const record: EncryptedRecord | undefined = await db.medicines.get(id);
  if (!record) return null;
  
  const decrypted = await decryptData(record.iv, record.encrypted);
  return JSON.parse(decrypted);
}
```

### 3. Add User Consent
```typescript
export async function enableOfflineStorage(): Promise<boolean> {
  const consent = confirm(
    'Enable offline storage to access your verification history without internet? ' +
    'Your data will be encrypted and stored locally on this device.'
  );
  
  if (consent) {
    localStorage.setItem('offline_consent', new Date().toISOString());
  }
  
  return consent;
}

export function hasStorageConsent(): boolean {
  return localStorage.getItem('offline_consent') !== null;
}
```

## Compliance
- GDPR Article 32 (Security of processing)
- India DPDP Act (Data Fiduciary obligations)

## References
- Fixes #4129
- Reported by automated bug hunter
