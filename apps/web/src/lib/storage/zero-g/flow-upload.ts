import {
  calculatePrice,
  getMarketContract,
  Indexer,
  txWithGasAdjustment,
  Uploader,
  ZgFile,
} from "@0glabs/0g-ts-sdk";
import { ethers } from "ethers";

interface UploadOption {
  tags: ethers.BytesLike;
  finalityRequired: boolean;
  taskSize: number;
  expectedReplica: number;
  skipTx: boolean;
  fee: bigint;
  nonce?: bigint;
}

const DEFAULT_UPLOAD_OPTIONS: UploadOption = {
  tags: "0x00",
  finalityRequired: true,
  taskSize: 10,
  expectedReplica: 1,
  skipTx: false,
  fee: 0n,
};

const FLOW_ABI = [
  "function market() view returns (address)",
  "function submit(((uint256 length, bytes tags, (bytes32 root, uint256 height)[] nodes) data, address submitter) submission) payable returns (uint256 index, bytes32 digest, uint256 startIndex, uint256 length)",
  "event Submit(address indexed sender, bytes32 indexed identity, uint256 submissionIndex, uint256 startPos, uint256 length, (uint256 length, bytes tags, (bytes32 root, uint256 height)[] nodes) submission)",
];

export async function uploadWithCurrentFlowAbi(
  indexer: Indexer,
  file: Awaited<ReturnType<typeof ZgFile.fromFilePath>>,
  rpcUrl: string,
  wallet: ethers.Wallet
): Promise<[{ txHash: string; rootHash: string }, Error | null]> {
  const [nodes, nodesErr] = await indexer.selectNodes(
    DEFAULT_UPLOAD_OPTIONS.expectedReplica
  );
  if (nodesErr) return [{ txHash: "", rootHash: "" }, nodesErr];

  const status = await nodes[0]?.getStatus();
  if (!status) {
    return [
      { txHash: "", rootHash: "" },
      new Error("failed to get status from the selected 0G storage node"),
    ];
  }

  const flow = new ethers.Contract(
    status.networkIdentity.flowAddress,
    FLOW_ABI,
    wallet
  );
  const uploader = new Uploader(nodes, rpcUrl, flow as never);
  patchCurrentFlowAbiSubmit(uploader, wallet.address);

  return uploader.uploadFile(file, DEFAULT_UPLOAD_OPTIONS as never);
}

function patchCurrentFlowAbiSubmit(uploader: Uploader, submitter: string) {
  const patched = uploader as unknown as {
    flow: ethers.Contract;
    provider: ethers.JsonRpcProvider;
    submitTransaction: (
      submission: unknown,
      opts: UploadOption,
      retryOpts?: unknown
    ) => Promise<readonly [unknown, Error | null]>;
  };

  patched.submitTransaction = async (
    submission: unknown,
    opts: UploadOption,
    retryOpts?: unknown
  ) => {
    const flow = patched.flow;
    const provider = patched.provider;
    const marketAddr = (await flow.market()) as string;
    const marketContract = getMarketContract(marketAddr, provider as never);
    const pricePerSector = await marketContract.pricePerSector();
    const fee =
      opts.fee > 0n ? opts.fee : calculatePrice(submission as never, pricePerSector);
    const suggestedGasPrice = await provider.getFeeData();
    const gasPrice = suggestedGasPrice.gasPrice;
    if (gasPrice === null) {
      return [
        null,
        new Error("Failed to get suggested gas price, set your own gas price"),
      ] as const;
    }

    const [receipt, error] = await txWithGasAdjustment(
      flow as never,
      provider as never,
      "submit",
      [{ data: submission, submitter }],
      {
        value: fee,
        gasPrice,
      },
      retryOpts as never
    );

    return [receipt, error] as const;
  };
}
