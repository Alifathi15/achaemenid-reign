/**
 * Icons.tsx — shared inline SVG icon symbol library, ported directly from
 * the approved design/ui_preview.html mockup. Render <IconSprite/> once at
 * the app root, then use <Icon name="..."/> anywhere.
 */
import React from 'react';

export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <symbol id="ic-flame" viewBox="0 0 24 24"><path d="M12 3c1 3-2 4-2 7a3 3 0 006 0c0-1-.5-2-1-2.5 1.5.5 3 2.5 3 5a6 6 0 01-12 0c0-4 3-5 3-8 0-.7.2-1.3 0-1.5.4-.2 2.6-1 3-0z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></symbol>
        <symbol id="ic-sword" viewBox="0 0 24 24"><path d="M4 20L15 9M17 3l4 4-3 3-4-4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M13.5 10.5l3 3M4 20l2-1 1-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></symbol>
        <symbol id="ic-people" viewBox="0 0 24 24"><circle cx="9" cy="8" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="16" cy="9" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M4 19c0-3 2.2-5 5-5s5 2 5 5M14.5 19c0-2.3 1.4-4 3.5-4s3.5 1.7 3.5 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></symbol>
        <symbol id="ic-vessel" viewBox="0 0 24 24"><path d="M8 4h8l-1 4h-6z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M7 8h10l1.4 8.6A3 3 0 0115.4 20H8.6a3 3 0 01-3-3.4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M9 12h6" stroke="currentColor" strokeWidth="1.3" /></symbol>
        <symbol id="ic-heart" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9.3-9C1.2 7.8 3 4.3 6.6 4c2-.2 3.8 1 5.4 2.8C13.6 5 15.4 3.8 17.4 4c3.6.3 5.4 3.8 3.9 7-2.3 4.6-9.3 9-9.3 9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></symbol>
        <symbol id="ic-undo" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 1 2.6 5.9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M4 7v5h5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></symbol>
        <symbol id="ic-coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="5.4" fill="none" stroke="currentColor" strokeWidth="1" opacity=".6" /><path d="M12 8.4v7.2M9.6 10h4.8M9.6 14h4.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></symbol>
        <symbol id="ic-star" viewBox="0 0 24 24"><path d="M12 3l2.6 5.9L21 9.6l-4.7 4.2L17.6 21 12 17.6 6.4 21l1.3-7.2L3 9.6l6.4-.7z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" /></symbol>
        <symbol id="ic-lock" viewBox="0 0 24 24"><rect x="5.5" y="10.5" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 10.5V7.5a4 4 0 018 0v3" fill="none" stroke="currentColor" strokeWidth="1.5" /></symbol>
        <symbol id="ic-scroll" viewBox="0 0 24 24"><path d="M6 4h11a2 2 0 012 2v13a2 2 0 01-2-2H8a2 2 0 00-2 2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M6 4a2 2 0 00-2 2v11a2 2 0 002 2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M9 9h7M9 12.5h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></symbol>
        <symbol id="ic-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.02 5.98l-1.7 1.7M7.68 16.32l-1.7 1.7M18.02 18.02l-1.7-1.7M7.68 7.68l-1.7-1.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></symbol>
        <symbol id="ic-temple" viewBox="0 0 24 24"><path d="M4 21V10l8-5 8 5v11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M4 10h16M8 21v-6h8v6M12 5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="12" cy="7.4" r="1.1" fill="currentColor" stroke="none" /></symbol>
        <symbol id="ic-crown" viewBox="0 0 24 24"><path d="M4 9l3.5 3L12 6l4.5 6L20 9l-1.5 9H5.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></symbol>
        <symbol id="ic-shield" viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></symbol>
        <symbol id="ic-spear" viewBox="0 0 24 24"><path d="M20 4l-13 13M20 4l-3 1 2 2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" /><path d="M4 20l3-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></symbol>
        <symbol id="ic-torch" viewBox="0 0 24 24"><path d="M12 22V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M8 10h8l-1-3H9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M12 2c1 1.5-1 2-1 3.5a1.5 1.5 0 003 0c0-.5-.2-1-.5-1.3 1 .3 1.5 1.3 1.5 2.3a2.5 2.5 0 01-5 0c0-2 2-2.5 2-4.5z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></symbol>
        <symbol id="ic-skull" viewBox="0 0 24 24"><path d="M12 3a7 7 0 00-7 7v3l1.5 2v2h3v-2h5v2h3v-2l1.5-2v-3a7 7 0 00-7-7z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="9.5" cy="11" r="1.2" fill="currentColor" stroke="none" /><circle cx="14.5" cy="11" r="1.2" fill="currentColor" stroke="none" /></symbol>
        <symbol id="ic-chest" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M4 10a8 5 0 0116 0" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M4 13h16M12 13v6" stroke="currentColor" strokeWidth="1.3" /></symbol>
        <symbol id="ic-dice" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" /><circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" /></symbol>
      </defs>
    </svg>
  );
}

export function Icon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24">
      <use href={`#ic-${name}`} />
    </svg>
  );
}
