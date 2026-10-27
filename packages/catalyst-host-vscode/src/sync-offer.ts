/** One instance behind the kernel version this extension build was verified against. */
export interface SyncOffer {
  name: string;
  deployed: string;
  target: string;
  /** Below the version this extension requires: some entities may not parse correctly. */
  belowRequired: boolean;
}

/**
 * The one notification every sync offer shares (REQ-000069-UVqkd7cL):
 * one instance reads as it always has; several are named in one message,
 * those below the required version called out.
 */
export function syncOfferMessage(offers: SyncOffer[], required: string): string {
  if (offers.length === 1) {
    const [o] = offers;
    return o.belowRequired
      ? `"${o.name}" is on catalyst ${o.deployed}, below the ${required} this extension requires — some entities may not parse correctly. Sync to ${o.target}?`
      : `"${o.name}" is on catalyst ${o.deployed}; this extension supports syncing to ${o.target}.`;
  }
  const listed = offers.map((o) => `"${o.name}" (${o.deployed} → ${o.target})`).join(", ");
  const below = offers.filter((o) => o.belowRequired).map((o) => `"${o.name}"`);
  const warning = below.length
    ? ` ${below.join(", ")} ${below.length === 1 ? "is" : "are"} below the ${required} this extension requires — some entities may not parse correctly.`
    : "";
  return `${offers.length} catalyst instances can sync: ${listed}.${warning}`;
}
