// Six-seat milestone rewards are separate system supplies, not copies from the finite shop stock.
export const ROUND_BEACON_ITEM = 'chess_item_5_04_e_a';
export const SIX_PLAYER_BEACON_ROUNDS = new Set([10, 12, 14]);

export function milestoneBeaconRound(match, itemId, source) {
  return source === 'sixPlayerBeacon' && itemId === ROUND_BEACON_ITEM && !match.isSolo
    && match.startingPlayerCount === 6 && SIX_PLAYER_BEACON_ROUNDS.has(match.round) ? match.round : null;
}

export function isMilestoneBeacon(piece) {
  return piece?.id === ROUND_BEACON_ITEM && SIX_PLAYER_BEACON_ROUNDS.has(piece.meta?.sixPlayerBeaconRound);
}
