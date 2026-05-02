const GALILEO_EXPLORER_BASE_URL = "https://chainscan-galileo.0g.ai";

export function galileoAddressUrl(address: string): string {
  return `${GALILEO_EXPLORER_BASE_URL}/address/${address}`;
}

export function galileoTxUrl(txHash: string): string {
  return `${GALILEO_EXPLORER_BASE_URL}/tx/${txHash}`;
}

export function shortHex(value: string, prefixLength = 6, suffixLength = 4) {
  if (value.length <= prefixLength + suffixLength) return value;
  return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`;
}
