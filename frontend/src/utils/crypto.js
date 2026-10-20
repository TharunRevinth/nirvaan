/**
 * Client-side cryptographic encryption utility for NIRVAAN
 * Uses Web Crypto API for hardware-accelerated AES-256-GCM encryption.
 */

export async function encryptFileClientSide(file) {
  if (!file) throw new Error('No file provided for client encryption.');

  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();

  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    fileBuffer
  );

  const rawKey = await window.crypto.subtle.exportKey('raw', key);
  const keyHex = Array.from(new Uint8Array(rawKey)).map(b => b.toString(16).padStart(2, '0')).join('');
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');

  const combined = new Uint8Array(iv.length + encryptedContent.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedContent), iv.length);

  const encryptedFile = new File([combined], `${file.name}.enc`, {
    type: 'application/octet-stream'
  });

  return {
    encryptedFile,
    keyHex,
    ivHex
  };
}
