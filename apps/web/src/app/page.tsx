"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { formatEther } from "viem";
import type { SkillPackage } from "@thoughtline/shared";
import { useAgentWorkbench } from "@/lib/agent-workbench";
import type { AgentConversationMessage } from "@/lib/agent-conversation";
import {
  galileoAddressUrl,
  galileoTxUrl,
  shortHex,
} from "@/lib/explorer/galileo";
import type { PublicAgentView } from "@/lib/gallery/public-agents";
import { getPublicAgentLineage } from "@/lib/gallery/public-feed";

export const dynamic = "force-dynamic";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

export default function Home() {
  const [name, setName] = useState("My ThoughtLine Agent");
  const [expertiseType, setExpertiseType] = useState("");
  const [sourceLabels, setSourceLabels] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [messageInputs, setMessageInputs] = useState<Record<string, string>>({});
  const [pendingSkillIds, setPendingSkillIds] = useState<Record<string, string>>(
    {}
  );
  const [slashMenus, setSlashMenus] = useState<Record<string, boolean>>({});
  const workbench = useAgentWorkbench();
  const { genesis } = workbench;
  const { breeding } = workbench;

  const canForge =
    !!genesis.address && sourceText.trim().length > 0 && !genesis.isForging;
  const canBreed =
    !!genesis.address &&
    !!breeding.parentTokenIdA &&
    !!breeding.parentTokenIdB &&
    breeding.parentTokenIdA !== breeding.parentTokenIdB &&
    breeding.childName.trim().length > 0 &&
    breeding.childBrief.trim().length > 0 &&
    !breeding.isBreeding;

  function sendConversationMessage(
    agent: (typeof workbench.filteredAgents)[number]
  ) {
    const tokenId = agent.tokenId;
    const rawContent = messageInputs[tokenId] ?? "";
    const pendingSkillId = pendingSkillIds[tokenId];
    const slashMatch = rawContent.match(/^\/([a-z0-9-]+)\s*(.*)$/i);
    const typedSkillId =
      slashMatch &&
      agent.publicProfile.skills.some((skill) => skill.id === slashMatch[1])
        ? slashMatch[1]
        : undefined;
    const content = typedSkillId ? slashMatch?.[2]?.trim() ?? "" : rawContent;
    const skillId = pendingSkillId ?? typedSkillId;

    if (content.trim().length === 0) return;

    setMessageInputs((current) => ({ ...current, [tokenId]: "" }));
    setPendingSkillIds((current) => {
      const next = { ...current };
      delete next[tokenId];
      return next;
    });
    setSlashMenus((current) => ({ ...current, [tokenId]: false }));
    void workbench.sendMessage(agent, {
      content: content.trim(),
      skillId,
    });
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <div className="brand">
          <span>ØG</span>
          ThoughtLine
        </div>
        <button onClick={genesis.connectWallet} type="button">
          {genesis.address
            ? `${genesis.address.slice(0, 6)}...${genesis.address.slice(-4)}`
          : "Connect wallet"}
        </button>
      </nav>

      <section className="page-head">
        <div>
          <div className="page-badge">0G Compute · Storage · iNFT lineage</div>
          <h1>Verifiable AI agents with private memory.</h1>
          <p className="muted">
            Create, inspect, unlock, talk to, and breed ERC-7857-style agents
            whose public skills and encrypted worldview live on 0G.
          </p>
        </div>
        <div className="page-head-tools">
          <input
            aria-label="Search agents"
            placeholder="Search agents"
            value={workbench.search}
            onChange={(event) => workbench.setSearch(event.target.value)}
          />
          <div className="head-stats">
            <span>
              <strong>{workbench.filteredAgents.length}</strong>
              visible
            </span>
            <span>
              <strong>{workbench.isLoadingGallery ? "Sync" : "Live"}</strong>
              {workbench.isLoadingGallery ? "loading" : "ready"}
            </span>
          </div>
        </div>
      </section>

      <section className="gallery-section">
        {workbench.galleryError ? (
          <p className="error">{workbench.galleryError}</p>
        ) : null}
        {workbench.galleryWarning ? (
          <p className="proof">{workbench.galleryWarning}</p>
        ) : null}
        <div className="gallery-table">
          <div className="gallery-table-head">
            <span>Agent</span>
            <span>Skills</span>
            <span>Owner</span>
            <span>Hash</span>
            <span>Inspect</span>
          </div>
          {workbench.isLoadingGallery ? (
            <div className="gallery-empty">Loading public agents...</div>
          ) : null}
          {!workbench.isLoadingGallery && workbench.agents.length === 0 ? (
            <div className="gallery-empty">No minted agents yet.</div>
          ) : null}
          {!workbench.isLoadingGallery &&
          workbench.filteredAgents.length === 0 &&
          workbench.agents.length > 0 ? (
            <div className="gallery-empty">No agents match that search.</div>
          ) : null}
          {workbench.filteredAgents.map((agent) => {
            const proof = workbench.proofs[agent.tokenId] ?? { status: "idle" };
            const unlock = workbench.unlockedAgents[agent.tokenId] ?? {
              status: "idle",
            };
            const access = workbench.accessTerms[agent.tokenId] ?? {
              status: "idle",
            };
            const terms =
              access.status === "ready" ||
              access.status === "updating" ||
              access.status === "error"
                ? access.terms
                : undefined;
            const feeInput = workbench.feeInputs[agent.tokenId] ?? {
              usage: "",
              breeding: "",
            };
            const conversation = workbench.conversations[agent.tokenId] ?? {
              status: "idle",
              messages: [],
            };
            const isOwner =
              !!genesis.address &&
              genesis.address.toLowerCase() === agent.owner.toLowerCase();
            const pendingSkillId = pendingSkillIds[agent.tokenId];
            const pendingSkill = agent.publicProfile.skills.find(
              (skill) => skill.id === pendingSkillId
            );
            const messageInput = messageInputs[agent.tokenId] ?? "";
            const slashQuery = messageInput.startsWith("/")
              ? messageInput.slice(1).toLowerCase()
              : "";
            const slashMatches = agent.publicProfile.skills.filter((skill) =>
              `${skill.id} ${skill.name}`.toLowerCase().includes(slashQuery)
            );
            const showSlashMenu =
              slashMenus[agent.tokenId] && messageInput.startsWith("/");
            const lineage = getPublicAgentLineage(agent);
            const usageFeeEth = terms
              ? formatEther(BigInt(terms.usage.feeWei))
              : "0";
            const breedingFeeEth = terms
              ? formatEther(BigInt(terms.breeding.feeWei))
              : "0";
            const isAccessUpdating = access.status === "updating";
            const canAskAsNonOwner = !isOwner && terms?.usage.isAuthorized;

            return (
              <article className="gallery-row" key={agent.tokenId}>
                <div className="gallery-row-agent">
                  <div className="row-kicker">Token #{agent.tokenId}</div>
                  <div className="row-title">{agent.publicProfile.name}</div>
                  <div className="row-desc">{agent.publicProfile.description}</div>
                  {agent.publicProfile.expertiseType ? (
                    <div className="row-positioning">
                      {agent.publicProfile.expertiseType}
                    </div>
                  ) : null}
                  <div className="row-meta">
                    <span>{lineage}</span>
                    <span>Generation {agent.publicProfile.generation}</span>
                  </div>
                </div>

                <div className="gallery-row-skills">
                  {agent.publicProfile.skills.map((skill) => (
                    <div key={skill.id} className="skill-pill">
                      <strong>{skill.name}</strong>
                      <span className="muted">{skill.source}</span>
                    </div>
                  ))}
                </div>

                <div className="gallery-row-owner">
                  <code title={agent.owner}>{shortHex(agent.owner, 10, 6)}</code>
                </div>

                <div className="gallery-row-hash">
                  <code title={agent.dataHash}>
                    {shortHex(agent.dataHash, 10, 8)}
                  </code>
                </div>

                <div className="gallery-row-inspect">
                  <details className="inspect">
                    <summary>Inspect</summary>
                    <div className="inspect-body">
                      <div>
                        <span className="muted">Public URI</span>
                        <code>{agent.publicUri}</code>
                      </div>
                      <div>
                        <span className="muted">Private URI</span>
                        <code>{agent.privateUri}</code>
                      </div>
                      {agent.publicProfile.expertiseType ? (
                        <div>
                          <span className="muted">Expertise type</span>
                          <p>{agent.publicProfile.expertiseType}</p>
                        </div>
                      ) : null}
                      {agent.publicProfile.positioning ? (
                        <div>
                          <span className="muted">Positioning</span>
                          <p>{agent.publicProfile.positioning}</p>
                        </div>
                      ) : null}
                      {agent.publicProfile.sourceCount !== undefined ||
                      agent.publicProfile.sourceLabels?.length ? (
                        <div>
                          <span className="muted">Source provenance</span>
                          <p>
                            {agent.publicProfile.sourceCount ?? 0} source
                            {(agent.publicProfile.sourceCount ?? 0) === 1
                              ? ""
                              : "s"}
                            {agent.publicProfile.sourceLabels?.length
                              ? ` · ${agent.publicProfile.sourceLabels.join(", ")}`
                              : ""}
                          </p>
                        </div>
                      ) : null}
                      <div className="link-grid">
                        {CONTRACT_ADDRESS ? (
                          <a
                            className="external-link"
                            href={galileoAddressUrl(CONTRACT_ADDRESS)}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Contract
                            <span>{shortHex(CONTRACT_ADDRESS)}</span>
                          </a>
                        ) : null}
                        <a
                          className="external-link"
                          href={galileoAddressUrl(agent.owner)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Owner
                          <span>{shortHex(agent.owner)}</span>
                        </a>
                      </div>
                      <div className="actions">
                        <button
                          type="button"
                          onClick={() => workbench.verifyAgent(agent)}
                          disabled={proof.status === "loading"}
                        >
                          {proof.status === "loading"
                            ? "Verifying..."
                            : "Verify"}
                        </button>
                      </div>
                      {proof.status === "ready" ? (
                        <div
                          className={
                            proof.proof.matches ? "proof ok proof-detail" : "proof proof-detail"
                          }
                        >
                          <strong>
                            {proof.proof.matches ? "Hash match" : "Hash mismatch"} ·{" "}
                            {proof.proof.byteLength} bytes
                          </strong>
                          <div>
                            <span>Expected</span>
                            <code>{proof.proof.expectedDataHash}</code>
                          </div>
                          <div>
                            <span>Fetched</span>
                            <code>{proof.proof.actualDataHash}</code>
                          </div>
                        </div>
                      ) : null}
                      {proof.status === "error" ? (
                        <div className="proof error">{proof.error}</div>
                      ) : null}

                      <div className="inspect-divider" />

                      <div>
                        <span className="muted">Public skills</span>
                        <div className="inspect-skills">
                          {agent.publicProfile.skills.map((skill) => (
                            <div key={skill.id}>
                              <strong>{skill.name}</strong>
                              <p className="muted">{skill.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {isOwner ? (
                        <>
                          <div className="access-terms">
                            <div>
                              <span className="muted">Usage fee</span>
                              <strong>{usageFeeEth} ETH</strong>
                            </div>
                            <div>
                              <span className="muted">Breeding fee</span>
                              <strong>{breedingFeeEth} ETH</strong>
                            </div>
                            <div className="fee-controls">
                              <label htmlFor={`usage-fee-${agent.tokenId}`}>
                                Usage fee (ETH)
                              </label>
                              <input
                                id={`usage-fee-${agent.tokenId}`}
                                inputMode="decimal"
                                placeholder={usageFeeEth}
                                value={feeInput.usage}
                                onChange={(event) =>
                                  workbench.setFeeInput(
                                    agent.tokenId,
                                    "usage",
                                    event.target.value
                                  )
                                }
                              />
                              <button
                                type="button"
                                disabled={isAccessUpdating}
                                onClick={() =>
                                  workbench.setAccessFee(agent, "usage")
                                }
                              >
                                {isAccessUpdating ? "Updating..." : "Set usage"}
                              </button>
                            </div>
                            <div className="fee-controls">
                              <label htmlFor={`breeding-fee-${agent.tokenId}`}>
                                Breeding fee (ETH)
                              </label>
                              <input
                                id={`breeding-fee-${agent.tokenId}`}
                                inputMode="decimal"
                                placeholder={breedingFeeEth}
                                value={feeInput.breeding}
                                onChange={(event) =>
                                  workbench.setFeeInput(
                                    agent.tokenId,
                                    "breeding",
                                    event.target.value
                                  )
                                }
                              />
                              <button
                                type="button"
                                disabled={isAccessUpdating}
                                onClick={() =>
                                  workbench.setAccessFee(agent, "breeding")
                                }
                              >
                                {isAccessUpdating
                                  ? "Updating..."
                                  : "Set breeding"}
                              </button>
                            </div>
                            {access.status === "error" ? (
                              <div className="proof error">{access.error}</div>
                            ) : null}
                          </div>

                          <div className="actions">
                            <button
                              type="button"
                              onClick={() => workbench.unlockAgent(agent)}
                              disabled={unlock.status === "loading"}
                            >
                              {unlock.status === "loading"
                                ? "Unlocking..."
                                : unlock.status === "ready"
                                  ? "Unlocked"
                                  : "Unlock"}
                            </button>
                          </div>

                          {unlock.status === "error" ? (
                            <div className="proof error">{unlock.error}</div>
                          ) : null}

                          {unlock.status === "ready" ? (
                            <div className="private-worldview">
                              <div>
                                <span className="muted">Values</span>
                                <p>{unlock.worldview.values.join(", ")}</p>
                              </div>
                              <div>
                                <span className="muted">Heuristics</span>
                                <p>{unlock.worldview.heuristics.join(", ")}</p>
                              </div>
                              <div>
                                <span className="muted">Blindspots</span>
                                <p>
                                  {unlock.worldview.blindspots.length > 0
                                    ? unlock.worldview.blindspots.join(", ")
                                    : "None listed"}
                                </p>
                              </div>
                              <div>
                                <span className="muted">Decision style</span>
                                <p>{unlock.worldview.decisionStyle}</p>
                              </div>
                              <div>
                                <span className="muted">Freeform</span>
                                <p>{unlock.worldview.freeform}</p>
                              </div>
                            </div>
                          ) : null}

                          {unlock.status === "ready" ? (
                            <ConversationPanel
                              agent={agent}
                              conversation={conversation}
                              messageInput={messageInput}
                              pendingSkill={pendingSkill}
                              slashMatches={slashMatches}
                              showSlashMenu={showSlashMenu}
                              setMessageInputs={setMessageInputs}
                              setPendingSkillIds={setPendingSkillIds}
                              setSlashMenus={setSlashMenus}
                              sendConversationMessage={sendConversationMessage}
                            />
                          ) : null}
                        </>
                      ) : (
                        <div className="access-state">
                          {access.status === "idle" || access.status === "loading" ? (
                            <div className="proof">Loading access terms.</div>
                          ) : null}
                          {terms ? (
                            <>
                              <div className="access-terms">
                                <div>
                                  <span className="muted">Usage access</span>
                                  <strong>
                                    {terms.usage.isAuthorized
                                      ? "Authorized"
                                      : "Not authorized"}
                                  </strong>
                                </div>
                                <div>
                                  <span className="muted">Usage fee</span>
                                  <strong>{usageFeeEth} ETH</strong>
                                </div>
                                <div>
                                  <span className="muted">Breeding access</span>
                                  <strong>
                                    {terms.breeding.isAuthorized
                                      ? "Authorized"
                                      : "Not authorized"}
                                  </strong>
                                </div>
                              </div>
                              {canAskAsNonOwner ? (
                                <ConversationPanel
                                  agent={agent}
                                  conversation={conversation}
                                  messageInput={messageInput}
                                  pendingSkill={pendingSkill}
                                  slashMatches={slashMatches}
                                  showSlashMenu={showSlashMenu}
                                  setMessageInputs={setMessageInputs}
                                  setPendingSkillIds={setPendingSkillIds}
                                  setSlashMenus={setSlashMenus}
                                  sendConversationMessage={
                                    sendConversationMessage
                                  }
                                />
                              ) : terms.usage.feeWei !== "0" ? (
                                <div className="actions">
                                  <button
                                    type="button"
                                    disabled={isAccessUpdating}
                                    onClick={() => workbench.payForUsage(agent)}
                                  >
                                    {isAccessUpdating
                                      ? "Waiting..."
                                      : "Pay for access"}
                                  </button>
                                </div>
                              ) : (
                                <div className="proof">
                                  Owner has not set a usage fee.
                                </div>
                              )}
                            </>
                          ) : null}
                          {access.status === "error" ? (
                            <div className="proof error">{access.error}</div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="workspace">
        <div>
          <div className="hero-copy">
            <h2>Create a new agent</h2>
            <p>
              Package expertise, notes, examples, and work samples into a
              public capability profile with an encrypted private worldview.
            </p>
          </div>

          <div className="panel module-panel">
            <div className="form-grid">
              <div className="form-row">
                <label htmlFor="agent-name">Agent name</label>
                <input
                  id="agent-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="form-row">
                <label htmlFor="expertise-type">Expertise type / positioning</label>
                <input
                  id="expertise-type"
                  value={expertiseType}
                  onChange={(event) => setExpertiseType(event.target.value)}
                  placeholder="Example: B2B SaaS onboarding teardown specialist"
                />
              </div>

              <div className="form-row">
                <label htmlFor="source-labels">Source labels</label>
                <input
                  id="source-labels"
                  value={sourceLabels}
                  onChange={(event) => setSourceLabels(event.target.value)}
                  placeholder="Calls, docs, playbooks"
                />
              </div>

              <div className="form-row">
                <label htmlFor="source-text">Expertise, notes, examples, work samples</label>
                <textarea
                  id="source-text"
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  placeholder="Paste the raw material this agent should learn from."
                />
              </div>

              <div className="actions">
                <button
                  disabled={!canForge || genesis.isSigning}
                  onClick={() =>
                    genesis.forgeGenesis({
                      name,
                      sourceText,
                      expertiseType: expertiseType.trim() || undefined,
                      sourceLabels: parseSourceLabels(sourceLabels),
                    })
                  }
                >
                  {genesis.isForging || genesis.isSigning
                    ? "Forging..."
                    : "Forge genesis"}
                </button>
                <button
                  disabled={!genesis.ready || genesis.isMinting}
                  onClick={genesis.mintGenesis}
                  type="button"
                >
                  {genesis.isMinting ? "Minting..." : "Mint iNFT"}
                </button>
              </div>

              {genesis.error ? <p className="error">{genesis.error}</p> : null}
            </div>
          </div>

          {genesis.ready ? (
            <div className="panel artifact">
              <h2>{genesis.ready.publicProfile.name}</h2>
              <p className="muted">{genesis.ready.publicProfile.description}</p>
              {genesis.ready.publicProfile.expertiseType ? (
                <div>
                  Expertise:{" "}
                  <code>{genesis.ready.publicProfile.expertiseType}</code>
                </div>
              ) : null}
              {genesis.ready.publicProfile.sourceLabels?.length ? (
                <div>
                  Sources:{" "}
                  <code>{genesis.ready.publicProfile.sourceLabels.join(", ")}</code>
                </div>
              ) : null}
              <div>
                Public URI: <code>{genesis.ready.publicUri}</code>
              </div>
              <div>
                Private URI: <code>{genesis.ready.privateUri}</code>
              </div>
              <div>
                Data hash: <code>{genesis.ready.dataHash}</code>
              </div>
              <div className="link-grid">
                {genesis.ready.mintTransaction.to ? (
                  <a
                    className="external-link"
                    href={galileoAddressUrl(genesis.ready.mintTransaction.to)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Contract
                    <span>{shortHex(genesis.ready.mintTransaction.to)}</span>
                  </a>
                ) : null}
                {genesis.mintTxHash ? (
                  <a
                    className="external-link"
                    href={galileoTxUrl(genesis.mintTxHash)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Mint transaction
                    <span>{shortHex(genesis.mintTxHash)}</span>
                  </a>
                ) : null}
              </div>
              <h3>Public skills</h3>
              <ul className="skills">
                {genesis.ready.publicProfile.skills.map((skill) => (
                  <li key={skill.id}>
                    <strong>{skill.name}</strong>
                    <p className="muted">{skill.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="panel">
          <h2>Pipeline</h2>
          <ul className="status-list">
            {genesis.events.length === 0 ? <li>Waiting</li> : null}
            {genesis.events.map((event, index) => (
              <li key={`${event}-${index}`}>{event}</li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="workspace breed-workspace">
        <div>
          <div className="hero-copy">
            <h2>Breed a child agent</h2>
            <p>
              Select two authorized parents, synthesize a child, then mint the
              lineage transaction.
            </p>
          </div>

          <div className="panel module-panel">
            <div className="form-grid">
              <div className="form-row">
                <label htmlFor="parent-a">Parent A</label>
                <select
                  id="parent-a"
                  value={breeding.parentTokenIdA}
                  onChange={(event) =>
                    workbench.setBreedingParentA(event.target.value)
                  }
                >
                  <option value="">Select parent</option>
                  {workbench.agents.map((agent) => (
                    <option
                      key={`a-${agent.tokenId}`}
                      value={agent.tokenId}
                      disabled={agent.tokenId === breeding.parentTokenIdB}
                    >
                      #{agent.tokenId} {agent.publicProfile.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label htmlFor="parent-b">Parent B</label>
                <select
                  id="parent-b"
                  value={breeding.parentTokenIdB}
                  onChange={(event) =>
                    workbench.setBreedingParentB(event.target.value)
                  }
                >
                  <option value="">Select parent</option>
                  {workbench.agents.map((agent) => (
                    <option
                      key={`b-${agent.tokenId}`}
                      value={agent.tokenId}
                      disabled={agent.tokenId === breeding.parentTokenIdA}
                    >
                      #{agent.tokenId} {agent.publicProfile.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label htmlFor="child-name">Child name</label>
                <input
                  id="child-name"
                  value={breeding.childName}
                  onChange={(event) =>
                    workbench.setBreedingChildName(event.target.value)
                  }
                />
              </div>

              <div className="form-row">
                <label htmlFor="child-brief">Child brief</label>
                <textarea
                  id="child-brief"
                  value={breeding.childBrief}
                  onChange={(event) =>
                    workbench.setBreedingChildBrief(event.target.value)
                  }
                  placeholder="Describe the marketable purpose this child should serve."
                />
              </div>

              <div className="actions">
                <button
                  type="button"
                  disabled={!canBreed}
                  onClick={workbench.breedSelectedParents}
                >
                  {breeding.isBreeding ? "Breeding..." : "Breed child"}
                </button>
                <button
                  type="button"
                  disabled={!breeding.ready || breeding.isMinting}
                  onClick={workbench.mintBreedChild}
                >
                  {breeding.isMinting ? "Minting..." : "Mint child"}
                </button>
              </div>

              {breeding.error ? (
                <p className="error">{breeding.error}</p>
              ) : null}
            </div>
          </div>

          {breeding.ready ? (
            <div className="panel artifact">
              <h2>{breeding.ready.publicProfile.name}</h2>
              <p className="muted">{breeding.ready.publicProfile.description}</p>
              {breeding.ready.publicProfile.positioning ? (
                <div>
                  Positioning:{" "}
                  <code>{breeding.ready.publicProfile.positioning}</code>
                </div>
              ) : null}
              <div>
                Parents:{" "}
                <code>
                  {breeding.ready.publicProfile.parentIds?.join(" + ") ??
                    "unknown"}
                </code>
              </div>
              <div>
                Public URI: <code>{breeding.ready.publicUri}</code>
              </div>
              <div>
                Private URI: <code>{breeding.ready.privateUri}</code>
              </div>
              <div>
                Data hash: <code>{breeding.ready.dataHash}</code>
              </div>
              <div className="link-grid">
                {breeding.ready.mintTransaction.to ? (
                  <a
                    className="external-link"
                    href={galileoAddressUrl(breeding.ready.mintTransaction.to)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Contract
                    <span>{shortHex(breeding.ready.mintTransaction.to)}</span>
                  </a>
                ) : null}
                {breeding.mintTxHash ? (
                  <a
                    className="external-link"
                    href={galileoTxUrl(breeding.mintTxHash)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Child mint transaction
                    <span>{shortHex(breeding.mintTxHash)}</span>
                  </a>
                ) : null}
              </div>
              <h3>Child skills</h3>
              <ul className="skills">
                {breeding.ready.publicProfile.skills.map((skill) => (
                  <li key={skill.id}>
                    <strong>{skill.name}</strong>
                    <p className="muted">{skill.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="panel">
          <h2>Breeding pipeline</h2>
          <ul className="status-list">
            {breeding.events.length === 0 ? <li>Waiting</li> : null}
            {breeding.events.map((event, index) => (
              <li key={`${event}-${index}`}>{event}</li>
            ))}
          </ul>
        </aside>
      </section>
    </main>
  );
}

interface ConversationPanelProps {
  agent: PublicAgentView;
  conversation: {
    status: "idle" | "loading" | "error";
    messages: AgentConversationMessage[];
    error?: string;
  };
  messageInput: string;
  pendingSkill: SkillPackage | undefined;
  slashMatches: SkillPackage[];
  showSlashMenu: boolean;
  setMessageInputs: Dispatch<SetStateAction<Record<string, string>>>;
  setPendingSkillIds: Dispatch<SetStateAction<Record<string, string>>>;
  setSlashMenus: Dispatch<SetStateAction<Record<string, boolean>>>;
  sendConversationMessage: (agent: PublicAgentView) => void;
}

function ConversationPanel(props: ConversationPanelProps) {
  return (
    <div className="conversation-panel">
      <div className="conversation-history">
        {props.conversation.messages.length === 0 ? (
          <div className="conversation-empty">Ask this agent a question.</div>
        ) : null}
        {props.conversation.messages.map((message, index) => (
          <div
            className={`conversation-message ${message.role}`}
            key={`${message.role}-${index}`}
          >
            <div>{message.content}</div>
            {message.role === "assistant" && message.usedSkillId ? (
              <span>Used /{message.usedSkillId}</span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="ask-box">
        {props.pendingSkill ? (
          <button
            className="slash-chip"
            type="button"
            onClick={() =>
              props.setPendingSkillIds((current) => {
                const next = { ...current };
                delete next[props.agent.tokenId];
                return next;
              })
            }
          >
            /{props.pendingSkill.id}
          </button>
        ) : null}
        <textarea
          aria-label={`Ask ${props.agent.publicProfile.name}`}
          value={props.messageInput}
          onChange={(event) => {
            const nextValue = event.target.value;
            props.setMessageInputs((current) => ({
              ...current,
              [props.agent.tokenId]: nextValue,
            }));
            props.setSlashMenus((current) => ({
              ...current,
              [props.agent.tokenId]: nextValue.startsWith("/"),
            }));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              props.sendConversationMessage(props.agent);
            }
          }}
          placeholder="Ask or type /"
        />
        {props.showSlashMenu ? (
          <div className="slash-menu">
            {props.slashMatches.map((skill) => (
              <button
                type="button"
                key={skill.id}
                onClick={() => {
                  props.setPendingSkillIds((current) => ({
                    ...current,
                    [props.agent.tokenId]: skill.id,
                  }));
                  props.setMessageInputs((current) => ({
                    ...current,
                    [props.agent.tokenId]: "",
                  }));
                  props.setSlashMenus((current) => ({
                    ...current,
                    [props.agent.tokenId]: false,
                  }));
                }}
              >
                <strong>/{skill.id}</strong>
                <span>{skill.name}</span>
              </button>
            ))}
            {props.slashMatches.length === 0 ? <div>No matching skills</div> : null}
          </div>
        ) : null}
        <button
          type="button"
          disabled={
            props.conversation.status === "loading" ||
            props.messageInput.trim().length === 0
          }
          onClick={() => props.sendConversationMessage(props.agent)}
        >
          {props.conversation.status === "loading" ? "Sending..." : "Send"}
        </button>
      </div>
      {props.conversation.status === "error" ? (
        <div className="proof error">{props.conversation.error}</div>
      ) : null}
    </div>
  );
}

function parseSourceLabels(value: string): string[] | undefined {
  const labels = value
    .split(",")
    .map((label) => label.trim())
    .filter((label, index, all) => label.length > 0 && all.indexOf(label) === index)
    .slice(0, 20);
  return labels.length > 0 ? labels : undefined;
}
