export type OverlayItem = { r?: boolean; from: number; to: number; kicker?: string; lines: string[]; size: 'xl' | 'lg' | 'md' | 'sm' | 'xs'; pos: string; align?: string; redFrom?: number }
// Intentionally empty: no decorative/poetic copy during the main 3D experience. Information appears only through the scan interface.
export const overlay: OverlayItem[] = []
export const rooms = [
  { n: '01', model: null as string | null, name: 'Canteen 66', text: 'Location status: closed' },
  { n: '02', model: null as string | null, name: 'Dear Mother', text: 'Site status: undocumented' },
]
