// Five/six-seat milestone rewards are separate system supplies, not copies from the finite shop stock.
export const ROUND_BEACON_ITEM = 'chess_item_5_04_e_a';
export const FIXED_BEACON_ROUNDS = new Set([10]);

export function fixedBeaconSupplyRound(match, round) {
  return !!match.round10Beacon && !match.isSolo && match.startingPlayerCount >= 5 && FIXED_BEACON_ROUNDS.has(round);
}

export function milestoneBeaconRound(match, itemId, source) {
  // Keep the original source and piece metadata keys for matches saved before the five-seat extension.
  return source === 'sixPlayerBeacon' && itemId === ROUND_BEACON_ITEM
    && fixedBeaconSupplyRound(match, match.round) ? match.round : null;
}

export function isMilestoneBeacon(piece) {
  return piece?.id === ROUND_BEACON_ITEM && FIXED_BEACON_ROUNDS.has(piece.meta?.sixPlayerBeaconRound);
}
