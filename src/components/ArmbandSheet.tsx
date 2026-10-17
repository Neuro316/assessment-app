'use client';

// ===== ARMBAND PILL AND SHEET =====
// The header pill that shows the shared armband connection, and the sheet it opens
// to connect, check or disconnect it. Both read the StrapProvider above the shell,
// so the Assessment and Practice tabs see one connection. Behind the Assessment tab
// flag, like the tabs.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { useSharedStrap } from '@neuroprogeny/practice';

import { U } from '@/components/FreshAirShell';
import { armbandPill } from '@/lib/fresh-air';

const GREEN = '#2A9D8F';

// Under 640px, the width at which the pill drops to the rate alone and the sheet
// comes up from the bottom.
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return narrow;
}

export function ArmbandPill({ onOpen }: { onOpen: () => void }) {
  const strap = useSharedStrap();
  const narrow = useNarrow();
  if (!strap) return null;
  const pill = armbandPill(strap.state, strap.heartRate, narrow);
  return (
    <button
      type="button"
      data-armband-pill={strap.state}
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={pill.ariaLabel ?? undefined}
      style={{
        minHeight: 44,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 14px',
        borderRadius: 999,
        border: `1px solid ${pill.dot ? U.tint : U.headerBorder}`,
        background: pill.dot ? U.tint : U.card,
        color: U.dark,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {pill.dot ? (
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
      ) : null}
      {pill.text}
    </button>
  );
}

export function ArmbandSheet({ onClose, onPracticeWithPacer }: { onClose: () => void; onPracticeWithPacer: () => void }) {
  const strap = useSharedStrap();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    // The sheet's main action when it has one, else the first button.
    const panel = panelRef.current;
    (
      panel?.querySelector<HTMLButtonElement>('button:not([disabled])[data-primary]') ??
      panel?.querySelector<HTMLButtonElement>('button:not([disabled])')
    )?.focus();
    return () => before?.focus();
  }, []);

  // Escape closes; Tab stays inside the sheet.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
    if (focusable.length === 0) return;
    e.preventDefault();
    const i = focusable.indexOf(document.activeElement as HTMLButtonElement);
    const next = i === -1 ? 0 : (i + (e.shiftKey ? focusable.length - 1 : 1)) % focusable.length;
    focusable[next].focus();
  };

  if (!strap) return null;
  const { state } = strap;
  const working = state === 'connecting' || state === 'reconnecting';

  const button = {
    minHeight: 44,
    padding: '0 20px',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
  };
  const primary = { ...button, background: U.blue, color: '#ffffff', border: 'none' };
  const secondary = { ...button, background: U.card, color: U.dark, border: `1px solid ${U.headerBorder}` };
  const body = { margin: '8px 0 20px', fontSize: 15, lineHeight: 1.5, color: U.muted };

  let content;
  if (state === 'unsupported') {
    content = (
      <>
        <p style={body}>
          This browser cannot reach an armband. You can still practice with the pacer and check in on how you feel. To
          measure, open Fresh Air in Chrome on a computer or an Android phone.
        </p>
        <button type="button" data-primary onClick={onPracticeWithPacer} style={primary}>
          Practice with the pacer
        </button>
      </>
    );
  } else if (state === 'connected') {
    content = (
      <>
        <p data-armband-device style={{ margin: '12px 0 0', fontSize: 15, color: U.text }}>
          {strap.deviceName ?? 'Armband'}
        </p>
        <p
          data-armband-bpm
          style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 600, color: U.dark, fontVariantNumeric: 'tabular-nums' }}
        >
          {strap.heartRate === null ? 'Waiting for a beat' : `${strap.heartRate} bpm`}
        </p>
        <p style={body}>Signal clean. Used by Practice and Assessment.</p>
        <button type="button" onClick={strap.disconnect} style={secondary}>
          Disconnect
        </button>
      </>
    );
  } else {
    content = (
      <>
        <p style={body}>
          Wet the strap pads, fasten it snug just below your chest, then tap Connect and choose your armband from the
          list your browser shows.
        </p>
        <button
          type="button"
          data-primary
          disabled={working}
          onClick={() => void strap.connect()}
          style={{ ...primary, opacity: working ? 0.6 : 1, cursor: working ? 'wait' : 'pointer' }}
        >
          {working ? 'Connecting armband' : 'Connect armband'}
        </button>
        {strap.error ? (
          <p role="status" style={{ margin: '10px 0 0', fontSize: 13, color: U.muted }}>
            {strap.error}
          </p>
        ) : null}
      </>
    );
  }

  const title =
    state === 'connected' ? 'Armband connected' : state === 'lost' ? 'Armband disconnected' : 'Your armband';

  return (
    <div
      className="items-end sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17, 24, 39, 0.4)',
        display: 'flex',
        justifyContent: 'center',
        zIndex: 50,
        fontFamily: U.font,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fresh-air-armband-title"
        onKeyDown={onKeyDown}
        data-armband-sheet={state}
        className="w-full rounded-t-2xl sm:max-w-[440px] sm:rounded-xl"
        style={{
          background: U.card,
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
          padding: '20px 24px calc(24px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 id="fresh-air-armband-title" style={{ margin: 0, fontSize: 18, fontWeight: 600, color: U.dark }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              minWidth: 44,
              minHeight: 44,
              border: 'none',
              background: 'none',
              color: U.muted,
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
        {content}
      </div>
    </div>
  );
}
