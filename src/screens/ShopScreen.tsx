import React from 'react';
import { Icon } from '../components/Icons';
import { ABILITY_PRICES, COIN_PACKS } from '../economy/economy';

interface ShopScreenProps {
  coins: number;
  onBack: () => void;
  onBuyUndo: () => void;
  onBuyLife: () => void;
  onBuyPack: (packId: string) => void;
}

export function ShopScreen({ coins, onBack, onBuyUndo, onBuyLife, onBuyPack }: ShopScreenProps) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--ivory)' }}>
      <div style={{ background: 'var(--brown)', padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--ivory)', fontSize: 20, cursor: 'pointer' }}>
          ←
        </button>
        <div style={{ color: 'var(--ivory)', fontSize: 17, fontWeight: 700 }}>فروشگاه</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(196,154,58,.15)', padding: '6px 12px', borderRadius: 20 }}>
          <Icon name="coin" style={{ width: 16, height: 16, color: 'var(--gold)' }} />
          <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 14 }}>{coins}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <div style={{ color: 'var(--brown)', fontSize: 14, fontWeight: 700, opacity: 0.7, marginBottom: 2 }}>قابلیت‌ها</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onBuyLife}
              style={{ flex: 1, background: '#fff', border: 'none', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--oxide)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="heart" style={{ width: 22, height: 22, color: 'var(--ivory)' }} />
              </div>
              <div style={{ color: 'var(--brown)', fontSize: 13, fontWeight: 700 }}>جانِ اضافه</div>
              <div style={{ width: '100%', background: 'var(--lapis)', color: 'var(--ivory)', borderRadius: 8, padding: '8px 0', textAlign: 'center', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Icon name="coin" style={{ width: 14, height: 14 }} /> {ABILITY_PRICES.life}
              </div>
            </button>
            <button
              onClick={onBuyUndo}
              style={{ flex: 1, background: '#fff', border: 'none', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--lapis)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="undo" style={{ width: 22, height: 22, color: 'var(--ivory)' }} />
              </div>
              <div style={{ color: 'var(--brown)', fontSize: 13, fontWeight: 700 }}>برگردوندنِ کارت</div>
              <div style={{ width: '100%', background: 'var(--lapis)', color: 'var(--ivory)', borderRadius: 8, padding: '8px 0', textAlign: 'center', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Icon name="coin" style={{ width: 14, height: 14 }} /> {ABILITY_PRICES.undoCard}
              </div>
            </button>
          </div>
        </div>

        <div>
          <div style={{ color: 'var(--brown)', fontSize: 14, fontWeight: 700, opacity: 0.7, marginBottom: 2 }}>خریدِ سکه</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {COIN_PACKS.map((pack) => (
              <button
                key={pack.id}
                onClick={() => onBuyPack(pack.id)}
                style={{
                  background: '#fff', border: 'none', borderRadius: 14, padding: '14px 16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,.06)', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="coin" style={{ width: 20, height: 20, color: 'var(--brown)' }} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--brown)', fontWeight: 700, fontSize: 15 }}>{pack.coins.toLocaleString('fa-IR')} سکه</div>
                    <div style={{ color: 'var(--brown)', fontSize: 11, opacity: 0.6 }}>{pack.label}</div>
                  </div>
                </div>
                <div style={{ background: 'var(--brown)', color: 'var(--ivory)', fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                  {pack.priceToman.toLocaleString('fa-IR')} ت
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
