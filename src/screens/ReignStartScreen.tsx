import React from 'react';
import { Icon } from '../components/Icons';

interface ReignStartScreenProps {
  dynastyIndex: number;
  kingName: string;
  onContinue: () => void;
}

export function ReignStartScreen({ dynastyIndex, kingName, onContinue }: ReignStartScreenProps) {
  return (
    <div style={{ height: '100%', background: 'var(--brown)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 36, padding: '20px 0 8px' }}>
        <Icon name="crown" style={{ width: 17, height: 17, color: 'var(--gold)' }} />
        <Icon name="scroll" style={{ width: 17, height: 17, color: 'var(--gold)' }} />
        <Icon name="gear" style={{ width: 17, height: 17, color: 'var(--gold)' }} />
      </div>
      <div style={{ padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' }}>
        <div style={{ color: 'var(--ivory)', textAlign: 'center', marginTop: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{kingName}</div>
          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>{dynastyIndex}اُمین شاهِ دودمان</div>
        </div>
      </div>
      <div style={{ padding: '0 20px 32px' }}>
        <button className="btn btn-primary" onClick={onContinue}>
          آغازِ سلطنت
        </button>
      </div>
    </div>
  );
}
