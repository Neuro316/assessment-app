// ===== FRESH AIR SHELL =====
// The frame around /fresh-air: a header with the mark, the name, the tab bar
// (Assessment, then Practice) and the pace pill. Without tabs (the flag off) it is
// the header alone above whatever the page renders. University platform tokens,
// not the assessment's.

import type { KeyboardEvent, ReactNode } from 'react';

import { FRESH_AIR_TABS, type FreshAirTab } from '@/lib/fresh-air';

export const U = {
  page: '#F7F8FA',
  card: '#ffffff',
  cardBorder: '#f3f4f6',
  headerBorder: '#e5e2de',
  text: '#2c2c2c',
  muted: '#6b7280',
  blue: '#386797',
  dark: '#1e3a5f',
  tint: '#e8eef4',
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const TAB_LABEL: Record<FreshAirTab, string> = {
  assessment: 'Assessment',
  practice: 'Practice',
};

export const tabId = (tab: FreshAirTab) => `fresh-air-tab-${tab}`;
export const panelId = (tab: FreshAirTab) => `fresh-air-panel-${tab}`;

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="14" cy="14" r="12" fill="none" stroke={U.blue} strokeWidth="2" />
      <circle cx="14" cy="14" r="6" fill={U.tint} stroke={U.blue} strokeWidth="2" />
    </svg>
  );
}

interface Tabs {
  active: FreshAirTab;
  onSelect: (tab: FreshAirTab) => void;
}

export default function FreshAirShell({
  pill,
  tabs,
  background = U.page,
  children,
}: {
  pill: string | null;
  tabs?: Tabs;
  background?: string;
  children: ReactNode;
}) {
  // Left and right move between tabs, as a tablist should.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!tabs || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const i = FRESH_AIR_TABS.indexOf(tabs.active);
    const next = FRESH_AIR_TABS[(i + (e.key === 'ArrowRight' ? 1 : FRESH_AIR_TABS.length - 1)) % FRESH_AIR_TABS.length];
    tabs.onSelect(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <div className="min-h-screen" style={{ background, color: U.text, overflowX: 'hidden' }}>
      {/* The font is set here and on the page's own content, so the flag-off page
          keeps the font it has always had. */}
      <header style={{ background: U.card, borderBottom: `1px solid ${U.headerBorder}`, fontFamily: U.font }}>
        <div
          className="px-4 sm:px-6"
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            minHeight: 60,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: 16,
            rowGap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 56 }}>
            <Mark />
            <span style={{ fontSize: 18, fontWeight: 600, color: U.dark, whiteSpace: 'nowrap' }}>Fresh Air</span>
          </div>

          {tabs ? (
            <div
              role="tablist"
              aria-label="Fresh Air"
              onKeyDown={onKeyDown}
              // Last on a phone, on its own row; between the name and the pill above that.
              className="order-last w-full sm:order-none sm:w-auto"
              style={{ display: 'flex', gap: 4 }}
            >
              {FRESH_AIR_TABS.map((tab) => {
                const selected = tab === tabs.active;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    id={tabId(tab)}
                    aria-selected={selected}
                    aria-controls={panelId(tab)}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => tabs.onSelect(tab)}
                    style={{
                      minHeight: 44,
                      padding: '0 14px',
                      background: 'none',
                      border: 'none',
                      borderBottom: `2px solid ${selected ? U.blue : 'transparent'}`,
                      color: selected ? U.blue : U.muted,
                      fontSize: 15,
                      fontWeight: selected ? 600 : 500,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    {TAB_LABEL[tab]}
                  </button>
                );
              })}
            </div>
          ) : null}

          {pill ? (
            <span
              data-pace-pill
              style={{
                marginLeft: 'auto',
                background: U.tint,
                color: U.dark,
                fontSize: 13,
                fontWeight: 500,
                padding: '6px 12px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
              }}
            >
              {pill}
            </span>
          ) : null}
        </div>
      </header>

      {children}
    </div>
  );
}

// A white card in the platform's style.
export function ShellCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: U.card,
        border: `1px solid ${U.cardBorder}`,
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
        padding: 24,
      }}
    >
      {children}
    </div>
  );
}
