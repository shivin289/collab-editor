// A fixed palette so cursors/user badges are visually distinct and consistent.
const PALETTE = [
  '#E53935', '#8E24AA', '#3949AB', '#00897B',
  '#43A047', '#FB8C00', '#6D4C41', '#00ACC1',
  '#D81B60', '#5E35B1', '#1E88E5', '#7CB342',
];

/**
 * Picks the first color in the palette not currently in use in the room.
 * Falls back to a random palette color if the room is bigger than the palette
 * (rare for a text editor demo, but avoids crashing).
 */
export function assignColor(usersInRoom) {
  const usedColors = new Set(Array.from(usersInRoom.values()).map((u) => u.color));
  const available = PALETTE.find((c) => !usedColors.has(c));
  return available || PALETTE[Math.floor(Math.random() * PALETTE.length)];
}
