export function parseZeroGUri(uri: string): string {
  const match = /^0g:\/\/(0x[0-9a-fA-F]{64})$/.exec(uri);
  if (!match) {
    throw new Error(`Invalid 0G Storage URI: ${uri}`);
  }
  return match[1];
}

export function rootHashToUri(rootHash: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(rootHash)) {
    throw new Error(`Invalid 0G root hash: ${rootHash}`);
  }
  return `0g://${rootHash}`;
}
