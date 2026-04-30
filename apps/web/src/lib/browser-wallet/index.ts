export interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export function getBrowserEthereum(): EthereumProvider {
  const ethereum = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  if (!ethereum) throw new Error("No browser wallet found.");
  return ethereum;
}
