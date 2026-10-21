// Shared by Experience.tsx (HTML text clip containers) and RoomWorlds.tsx (WebGL clip planes +
// divider position) so the visible line, the text boundary, and the real GPU clip all agree on
// the exact same screen position. Phone-only; desktop never reads this.
export const SPLIT_FRACTION = 0.46 // how far down the screen (0 = top, 1 = bottom) the room boundary sits