export type ThemeColors = {
  navy:   string;
  navy2:  string;
  amber:  string;
  amber2: string;
  cyan:   string;
  green:  string;
  red:    string;
  white:  string;
  bg:     string;
  bg2:    string;
  card:   string;
  border: string;
  muted:  string;
  text:   string;
};

export const lightColors: ThemeColors = {
  navy:   '#1E3A5F',
  navy2:  '#152d4a',
  amber:  '#F59E0B',
  amber2: '#D97706',
  cyan:   '#0891b2',
  green:  '#16a34a',
  red:    '#dc2626',
  white:  '#ffffff',
  bg:     '#F1F5F9',
  bg2:    '#E8EEF5',
  card:   '#FFFFFF',
  border: 'rgba(30,58,95,0.10)',
  muted:  'rgba(30,58,95,0.45)',
  text:   '#1E3A5F',
};

export const darkColors: ThemeColors = {
  navy:   '#1E3A5F',
  navy2:  '#152d4a',
  amber:  '#F59E0B',
  amber2: '#D97706',
  cyan:   '#0891b2',
  green:  '#4ade80',
  red:    '#f87171',
  white:  '#ffffff',
  bg:     '#0d1a2b',
  bg2:    '#111f30',
  card:   '#1a2d42',
  border: 'rgba(255,255,255,0.07)',
  muted:  'rgba(255,255,255,0.40)',
  text:   'rgba(255,255,255,0.88)',
};

// Backward-compat alias (light theme)
export const Colors = lightColors;
