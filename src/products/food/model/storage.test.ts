import { beforeEach, describe, expect, it } from 'vitest';
import { credentialKey, forgetCredential, readLastCredential, saveCredential } from './storage.js';

describe('private device credential storage', () => {
  beforeEach(() => localStorage.clear());

  it('keys credentials by cycle and order and restores the most recent', () => {
    const credential = { cycleId: 'cycle-1', orderId: 'order-1', token: 'secret' };
    saveCredential(credential);
    expect(localStorage.getItem(credentialKey('cycle-1', 'order-1'))).toContain('secret');
    expect(readLastCredential()).toEqual(credential);
  });

  it('forgets only local access without touching any server record', () => {
    const credential = { cycleId: 'cycle-1', orderId: 'order-1', token: 'secret' };
    saveCredential(credential);
    forgetCredential(credential);
    expect(readLastCredential()).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('clears malformed pointers safely', () => {
    localStorage.setItem('food:last-order', '{broken');
    expect(readLastCredential()).toBeNull();
  });
});
