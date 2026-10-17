// ===== HAND-OVER =====
// A finished session's record waits in a slot until the host has it: on Done, on
// unmount, or when the host asks for the session to end now. Whichever comes first
// empties the slot, so the record reaches the host once.

export function handOverPending<R>(slot: { current: R | null }, send: (record: R) => void): boolean {
  const record = slot.current;
  if (record === null) return false;
  slot.current = null;
  send(record);
  return true;
}
