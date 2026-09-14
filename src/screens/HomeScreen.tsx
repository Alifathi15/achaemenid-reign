import React from 'react';
import { Icon } from '../components/Icons';

interface HomeScreenProps {
  onStart: () => void;
  onOpenShop: () => void;
  onOpenSettings: () => void;
  onOpenDynastyHistory: () => void;
  /** True when there's a live, in-progress reign saved from last time the
   * app was open — changes the button label from "شروع" to "ادامه" so the
   * player knows they're resuming, not starting over. */
  hasSavedReign: boolean;
}

export function HomeScreen({ onStart, onOpenShop, onOpenSettings, onOpenDynastyHistory, hasSavedReign }: HomeScreenProps) {
  return (
    <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="icon-btn" onClick={onOpenSettings} aria-label="تنظیمات">
          <Icon name="gear" />
        </button>
        <div style={{ color: 'var(--ivory)', fontWeight: 700, fontSize: 18 }}>شاه شو</div>
        <button className="icon-btn" onClick={onOpenDynastyHistory} aria-label="تاریخچه دودمان">
          <Icon name="temple" />
        </button>
      </div>

      <div
        style={{
          width: 200, height: 200, margin: 'auto', borderRadius: 16,
          background: 'linear-gradient(160deg, var(--lapis), var(--brown))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--gold)', color: 'var(--ivory)', textAlign: 'center',
          fontWeight: 700, fontSize: 22, padding: 12,
        }}
      >
        شاه شو
      </div>

      <div>
        <button className="btn btn-primary" style={{ marginBottom: 12 }} onClick={onStart}>
          {hasSavedReign ? 'ادامه' : 'شروع'}
        </button>
        <button className="btn btn-secondary" onClick={onOpenShop}>
          فروشگاه
        </button>
      </div>
    </div>
  );
}
