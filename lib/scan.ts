// The void is a breath, not a chapter. Timeline on room-phase progress r (scrubs both ways):
//  r<.04 brain exits · .04–.09 tiny system activity · .09–.23 THREAT RESPONSE DETECTED (brief) · .23–.3 darkness · .3→ two distant presences, then the rooms.
export type Phase = 'BRAIN' | 'VOID' | 'WARNING' | 'DARK' | 'ROOM_DISCOVERY'
export const phase = (r: number): Phase => r < 0.04 ? 'BRAIN' : r < 0.09 ? 'VOID' : r < 0.23 ? 'WARNING' : r < 0.3 ? 'DARK' : 'ROOM_DISCOVERY'
