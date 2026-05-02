import { expect } from "chai";
import { ethers } from "hardhat";

describe("ThoughtLineAgent", function () {
  async function deployFixture() {
    const [owner, user, other] = await ethers.getSigners();
    const Verifier = await ethers.getContractFactory("TEEVerifier");
    const verifier = await Verifier.deploy(owner.address);

    const Agent = await ethers.getContractFactory("ThoughtLineAgent");
    const agent = await Agent.deploy(await verifier.getAddress());

    return { agent, verifier, owner, user, other };
  }

  it("mints a genesis agent with public/private pointers and data hash", async function () {
    const { agent, user } = await deployFixture();
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("ciphertext"));

    await expect(
      agent
        .connect(user)
        .mintGenesis("0g://public-profile", "0g://private-worldview", dataHash)
    )
      .to.emit(agent, "AgentMinted")
      .withArgs(
        0,
        user.address,
        "0g://public-profile",
        "0g://private-worldview",
        dataHash,
        false,
        0,
        0
      );

    expect(await agent.ownerOf(0)).to.equal(user.address);
    expect(await agent.tokenURI(0)).to.equal("0g://public-profile");
    expect(await agent.privateWorldviewURI(0)).to.equal(
      "0g://private-worldview"
    );
    expect(await agent.dataHash(0)).to.equal(dataHash);
    const intelligentData = await agent.intelligentDataOf(0);
    expect(intelligentData[0].dataDescription).to.equal("0g://private-worldview");
    expect(intelligentData[0].dataHash).to.equal(dataHash);
  });

  it("mints a child from existing parents without requiring parent ownership", async function () {
    const { agent, user, other } = await deployFixture();
    const parentHash = ethers.keccak256(ethers.toUtf8Bytes("parent"));
    const childHash = ethers.keccak256(ethers.toUtf8Bytes("child"));

    await agent
      .connect(user)
      .mintGenesis("0g://parent-a", "0g://parent-a-private", parentHash);
    await agent
      .connect(other)
      .mintGenesis("0g://parent-b", "0g://parent-b-private", parentHash);

    await agent
      .connect(user)
      .mintChild("0g://child", "0g://child-private", childHash, 0, 1);

    expect(await agent.ownerOf(2)).to.equal(user.address);
    const [hasParents, parentA, parentB] = await agent.getLineage(2);
    expect(hasParents).to.equal(true);
    expect(parentA).to.equal(0n);
    expect(parentB).to.equal(1n);
  });

  it("rejects child minting with missing or duplicate parents", async function () {
    const { agent, user } = await deployFixture();
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("ciphertext"));

    await agent
      .connect(user)
      .mintGenesis("0g://parent", "0g://parent-private", dataHash);

    await expect(
      agent.connect(user).mintChild("0g://child", "0g://private", dataHash, 0, 0)
    ).to.be.revertedWith("Parents must be different");

    await expect(
      agent.connect(user).mintChild("0g://child", "0g://private", dataHash, 0, 9)
    ).to.be.revertedWith("Parent B does not exist");
  });

  it("supports ERC-7857 metadata and main interfaces", async function () {
    const { agent } = await deployFixture();
    const mainSelectors = [
      agent.interface.getFunction("verifier").selector,
      agent.interface.getFunction("iTransfer").selector,
      agent.interface.getFunction("iClone").selector,
      agent.interface.getFunction("authorizeUsage").selector,
      agent.interface.getFunction("revokeAuthorization").selector,
      agent.interface.getFunction("approve").selector,
      agent.interface.getFunction("setApprovalForAll").selector,
      agent.interface.getFunction("delegateAccess").selector,
      agent.interface.getFunction("ownerOf").selector,
      agent.interface.getFunction("authorizedUsersOf").selector,
      agent.interface.getFunction("getApproved").selector,
      agent.interface.getFunction("isApprovedForAll").selector,
      agent.interface.getFunction("getDelegateAccess").selector,
    ];
    const metadataSelectors = [
      agent.interface.getFunction("name").selector,
      agent.interface.getFunction("symbol").selector,
      agent.interface.getFunction("intelligentDataOf").selector,
    ];
    const mainInterfaceId = interfaceId(mainSelectors);
    const metadataInterfaceId = interfaceId(metadataSelectors);

    expect(await agent.supportsInterface(mainInterfaceId)).to.equal(true);
    expect(await agent.supportsInterface(metadataInterfaceId)).to.equal(true);
  });

  it("authorizes usage and delegates access", async function () {
    const { agent, user, other } = await deployFixture();
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("ciphertext"));

    await agent
      .connect(user)
      .mintGenesis("0g://public", "0g://private", dataHash);

    await expect(agent.connect(user).authorizeUsage(0, other.address))
      .to.emit(agent, "Authorization")
      .withArgs(user.address, other.address, 0);
    expect(await agent.authorizedUsersOf(0)).to.deep.equal([other.address]);

    await expect(agent.connect(user).revokeAuthorization(0, other.address))
      .to.emit(agent, "AuthorizationRevoked")
      .withArgs(user.address, other.address, 0);
    expect(await agent.authorizedUsersOf(0)).to.deep.equal([]);

    await expect(agent.connect(user).delegateAccess(other.address))
      .to.emit(agent, "DelegateAccess")
      .withArgs(user.address, other.address);
    expect(await agent.getDelegateAccess(user.address)).to.equal(other.address);
  });

  it("charges separate fees for usage and breeding authorization", async function () {
    const { agent, user, other } = await deployFixture();
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("ciphertext"));
    const usageFee = ethers.parseEther("0.01");
    const breedingFee = ethers.parseEther("0.05");

    await agent
      .connect(user)
      .mintGenesis("0g://public", "0g://private", dataHash);

    await expect(agent.connect(user).setUsageFee(0, usageFee))
      .to.emit(agent, "UsageFeeSet")
      .withArgs(0, usageFee);
    await expect(agent.connect(user).setBreedingFee(0, breedingFee))
      .to.emit(agent, "BreedingFeeSet")
      .withArgs(0, breedingFee);

    await expect(
      agent.connect(other).payForUsage(0, { value: usageFee - 1n })
    ).to.be.revertedWith("Incorrect usage fee");

    await expect(agent.connect(other).payForUsage(0, { value: usageFee }))
      .to.emit(agent, "UsageFeePaid")
      .withArgs(0, other.address, user.address, usageFee);

    expect(await agent.isAuthorizedUser(0, other.address)).to.equal(true);
    expect(await agent.isAuthorizedBreeder(0, other.address)).to.equal(false);

    await expect(agent.connect(other).payForBreeding(0, { value: breedingFee }))
      .to.emit(agent, "BreedingFeePaid")
      .withArgs(0, other.address, user.address, breedingFee);

    expect(await agent.isAuthorizedBreeder(0, other.address)).to.equal(true);
  });

  it("revokes breeding authorization independently from usage authorization", async function () {
    const { agent, user, other } = await deployFixture();
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("ciphertext"));

    await agent
      .connect(user)
      .mintGenesis("0g://public", "0g://private", dataHash);

    await agent.connect(user).authorizeUsage(0, other.address);
    await expect(agent.connect(user).authorizeBreeding(0, other.address))
      .to.emit(agent, "BreedingAuthorization")
      .withArgs(user.address, other.address, 0);

    expect(await agent.authorizedBreedersOf(0)).to.deep.equal([other.address]);

    await expect(agent.connect(user).revokeBreedingAuthorization(0, other.address))
      .to.emit(agent, "BreedingAuthorizationRevoked")
      .withArgs(user.address, other.address, 0);

    expect(await agent.isAuthorizedUser(0, other.address)).to.equal(true);
    expect(await agent.isAuthorizedBreeder(0, other.address)).to.equal(false);
  });

  it("transfers and clones with ERC-7857 proof outputs", async function () {
    const { agent, user, other } = await deployFixture();
    const oldHash = ethers.keccak256(ethers.toUtf8Bytes("old"));
    const newHash = ethers.keccak256(ethers.toUtf8Bytes("new"));

    await agent
      .connect(user)
      .mintGenesis("0g://public", "0g://private", oldHash);

    await expect(agent.connect(user).iTransfer(other.address, 0, [proof(oldHash, newHash)]))
      .to.emit(agent, "Transferred")
      .withArgs(0, user.address, other.address);
    expect(await agent.ownerOf(0)).to.equal(other.address);
    expect(await agent.dataHash(0)).to.equal(newHash);

    const cloneHash = ethers.keccak256(ethers.toUtf8Bytes("clone"));
    await expect(agent.connect(other).iClone(user.address, 0, [proof(newHash, cloneHash)]))
      .to.emit(agent, "Cloned")
      .withArgs(0, 1, other.address, user.address);
    expect(await agent.ownerOf(1)).to.equal(user.address);
    expect(await agent.dataHash(1)).to.equal(cloneHash);
  });

  it("rejects transfer and clone proofs that do not match the current data hash", async function () {
    const { agent, user, other } = await deployFixture();
    const currentHash = ethers.keccak256(ethers.toUtf8Bytes("current"));
    const staleHash = ethers.keccak256(ethers.toUtf8Bytes("stale"));
    const newHash = ethers.keccak256(ethers.toUtf8Bytes("new"));

    await agent
      .connect(user)
      .mintGenesis("0g://public", "0g://private", currentHash);

    await expect(
      agent.connect(user).iTransfer(other.address, 0, [proof(staleHash, newHash)])
    ).to.be.revertedWith("Stale data hash");

    await expect(
      agent.connect(user).iClone(other.address, 0, [proof(staleHash, newHash)])
    ).to.be.revertedWith("Stale data hash");

    expect(await agent.ownerOf(0)).to.equal(user.address);
    expect(await agent.dataHash(0)).to.equal(currentHash);
  });
});

function interfaceId(selectors: string[]): string {
  return `0x${selectors
    .reduce((acc, selector) => acc ^ BigInt(selector), 0n)
    .toString(16)
    .padStart(8, "0")}`;
}

function proof(oldHash: string, newHash: string) {
  return {
    accessProof: {
      oldDataHash: oldHash,
      newDataHash: newHash,
      nonce: "0x01",
      encryptedPubKey: "0x02",
      proof: "0x03",
    },
    ownershipProof: {
      oracleType: 0,
      oldDataHash: oldHash,
      newDataHash: newHash,
      sealedKey: "0x04",
      encryptedPubKey: "0x05",
      nonce: "0x06",
      proof: "0x07",
    },
  };
}
