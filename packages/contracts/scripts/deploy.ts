import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ethers, network } from "hardhat";

const GALILEO_EXPLORER = "https://chainscan-galileo.0g.ai";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer signer available. Set DEPLOYER_PRIVATE_KEY.");
  }

  const teeSigner = process.env.TEE_SIGNER_ADDRESS ?? deployer.address;

  console.log(`Network: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`TEE signer: ${teeSigner}`);

  const Verifier = await ethers.getContractFactory("TEEVerifier");
  const verifier = await Verifier.deploy(teeSigner);
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();

  const Agent = await ethers.getContractFactory("ThoughtLineAgent");
  const agent = await Agent.deploy(verifierAddress);
  await agent.waitForDeployment();
  const agentAddress = await agent.getAddress();

  const output = [
    "# ThoughtLine 0G Galileo deployment",
    `TEE_VERIFIER_ADDRESS=${verifierAddress}`,
    `NEXT_PUBLIC_CONTRACT_ADDRESS=${agentAddress}`,
    "NEXT_PUBLIC_CHAIN_ID=16602",
    "",
  ].join("\n");

  console.log("\nDeployment complete");
  console.log(`ThoughtLineAgent: ${GALILEO_EXPLORER}/address/${agentAddress}`);
  console.log(`TEEVerifier: ${GALILEO_EXPLORER}/address/${verifierAddress}`);
  console.log("\nPaste these into apps/web/.env.local:");
  console.log(output);

  if (process.env.WRITE_DEPLOYMENT_ENV === "1") {
    const target = resolve(process.cwd(), "../../apps/web/.env.deployment.local");
    await writeFile(target, output, "utf8");
    console.log(`Wrote ${target}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
