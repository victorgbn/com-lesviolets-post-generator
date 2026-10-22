export const THEME_COLORS = [
  { name: 'Blanc', value: '#FFFFFF' },
  { name: 'Noir', value: '#111111' },
  { name: 'Violet', value: '#6A2C91' },
  { name: 'Rouge', value: '#D62828' },
  { name: 'Jaune', value: '#FFD447' },
  { name: 'Bleu', value: '#2878B5' },
] as const

export const FONTS = [
  { name: 'Impact', family: 'Impact, Haettenschweiler, sans-serif', weights: [400] },
  { name: 'Arial', family: 'Arial, Helvetica, sans-serif', weights: [400, 700, 900] },
  { name: 'Georgia', family: 'Georgia, serif', weights: [400, 700] },
  { name: 'System UI', family: 'system-ui, sans-serif', weights: [400, 500, 700, 900] },
] as const

export const OUTPUT_FORMATS = [
  { id: 'square', name: 'Instagram carré', width: 1080, height: 1080 },
  { id: 'portrait', name: 'Instagram portrait', width: 1080, height: 1350 },
  { id: 'landscape', name: 'Paysage', width: 1200, height: 630 },
] as const

export const EXPORT_JPEG_QUALITY = 0.94
export const DEFAULT_TEXT_COLOR = '#FFFFFF'
