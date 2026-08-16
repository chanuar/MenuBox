import type { Credential } from './types';

const POINTER_KEY = 'food:last-order';

export function credentialKey(cycleId: string, orderId: string) {
  return `food:order:${cycleId}:${orderId}`;
}

export function saveCredential(credential: Credential, storage: Storage = window.localStorage) {
  const value = JSON.stringify(credential);
  storage.setItem(credentialKey(credential.cycleId, credential.orderId), value);
  storage.setItem(POINTER_KEY, value);
}

export function readLastCredential(storage: Storage = window.localStorage): Credential | null {
  try {
    const value = JSON.parse(storage.getItem(POINTER_KEY) ?? 'null') as Partial<Credential> | null;
    if (!value?.cycleId || !value.orderId || !value.token) return null;
    return value as Credential;
  } catch {
    storage.removeItem(POINTER_KEY);
    return null;
  }
}

export function forgetCredential(
  credential: Credential | null,
  storage: Storage = window.localStorage,
) {
  if (!credential) return;
  storage.removeItem(credentialKey(credential.cycleId, credential.orderId));
  const current = readLastCredential(storage);
  if (current?.orderId === credential.orderId) storage.removeItem(POINTER_KEY);
}
