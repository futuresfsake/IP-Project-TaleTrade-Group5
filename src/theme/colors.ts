// Design tokens for the Feed UI (mirrors the "TaleTrade UI v2" Figma page).
// Purple is the primary action colour; blue stays for titles, links and selection.
export const colors = {
  primary: '#6C63A8',
  blue: '#4A68BE',
  purple: '#7E6FB0',
  cream: '#F5E9CF',
  white: '#FFFFFF',
  field: '#F9F7F2',
  chip: '#F3F1FB',
  selected: '#EEF1FB',
  cover: '#E4E0EE',
  ink: '#33354D',
  body: '#555B6E',
  muted: '#8A8FA3',
  border: '#E6E0F2',
  danger: '#E5484D',
  dangerTint: '#FFE8E8',
  scrim: 'rgba(33, 36, 51, 0.5)',
};

export const statusColors = {
  available: { bg: '#E4F4E6', text: '#2E7D32', dot: '#4CAF50' },
  reserved: { bg: '#FCF1D6', text: '#8F6200', dot: '#E8A317' },
  unavailable: { bg: '#ECEAF2', text: '#666B7E', dot: '#9AA0B4' },
} as const;

export const shadow = {
  shadowColor: '#33354D',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};
