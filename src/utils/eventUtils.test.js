import { describe, it, expect } from 'vitest';
import { prepareDuplicateEvent } from './eventUtils';
import { Timestamp } from 'firebase/firestore';

describe('prepareDuplicateEvent', () => {
  const currentUser = { uid: 'u1', displayName: 'User One' };

  it('removes id and sets createdBy/lastModifiedBy', () => {
    const ev = { id: 'e1', title: 'Test' };
    const dup = prepareDuplicateEvent(ev, 'Test 1', currentUser);
    expect(dup.id).toBeUndefined();
    expect(dup.title).toBe('Test 1');
    expect(dup.createdBy).toEqual({ userId: 'u1', userName: 'User One' });
    expect(dup.lastModifiedBy).toEqual({ userId: 'u1', userName: 'User One' });
  });

  it('converts startDateTime string to Timestamp and empty string to null', () => {
    const ev1 = { startDateTime: '2026-01-13T12:00' };
    const dup1 = prepareDuplicateEvent(ev1, 'T1', currentUser);
    expect(dup1.startDateTime).toBeInstanceOf(Timestamp);

    const ev2 = { startDateTime: '' };
    const dup2 = prepareDuplicateEvent(ev2, 'T2', currentUser);
    expect(dup2.startDateTime).toBeNull();
  });

  it('converts Date objects to Timestamps', () => {
    const d = new Date('2026-01-13T09:00');
    const ev = { startDateTime: d, endDateTime: d };
    const dup = prepareDuplicateEvent(ev, 'Dates', currentUser);
    expect(dup.startDateTime).toBeInstanceOf(Timestamp);
    expect(dup.endDateTime).toBeInstanceOf(Timestamp);
  });
});
