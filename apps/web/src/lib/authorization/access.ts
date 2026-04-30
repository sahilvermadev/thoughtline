export type AuthorizationCapability = "usage" | "breeding";

export interface CapabilityAccess {
  ownerAddress: string;
  authorizedAddresses: string[];
}

export interface CapabilityAccessRequest {
  capability: AuthorizationCapability;
  callerAddress: string;
  tokenId: string;
  access: CapabilityAccess;
}

export function canAccessCapability(
  callerAddress: string,
  access: CapabilityAccess
): boolean {
  const caller = normalizeAddress(callerAddress);
  return (
    caller === normalizeAddress(access.ownerAddress) ||
    access.authorizedAddresses.some(
      (address) => normalizeAddress(address) === caller
    )
  );
}

export function canUseCapability(request: CapabilityAccessRequest): boolean {
  return canAccessCapability(request.callerAddress, request.access);
}

export function assertCanUseCapability(request: CapabilityAccessRequest): void {
  assertCapabilityAccess(
    request.capability,
    request.callerAddress,
    request.tokenId,
    request.access
  );
}

export function assertCapabilityAccess(
  capability: AuthorizationCapability,
  callerAddress: string,
  tokenId: string,
  access: CapabilityAccess
): void {
  if (!canAccessCapability(callerAddress, access)) {
    if (capability === "breeding") {
      throw new Error(`Caller is not authorized to breed with agent ${tokenId}`);
    }
    throw new Error(
      `Caller is not authorized for ${capability} on agent ${tokenId}`
    );
  }
}

export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}
