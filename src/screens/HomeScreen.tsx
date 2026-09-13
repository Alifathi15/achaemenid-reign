import React from 'react';
import { Icon } from '../components/Icons';

interface HomeScreenProps {
  onStart: () => void;
  onOpenShop: () => void;
  onOpenSettings: () => void;
  onOpenDynastyHistory: () => void;
}

export function HomeScreen({ onStart, onOpenShop, onOpenSettings, onOpenDynastyHistory }: HomeScreenProps) {
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
          شروع / ادامه
        </button>
        <button className="btn btn-secondary" onClick={onOpenShop}>
          فروشگاه
        </button>
      </div>
    </div>
  );
}
