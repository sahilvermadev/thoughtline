"use client";

import { useState } from "react";
import { useAgentWorkbench } from "@/lib/agent-workbench";
import { getPublicAgentLineage } from "@/lib/gallery/public-feed";

export const dynamic = "force-dynamic";

export default function Home() {
  const [name, setName] = useState("My ThoughtLine Agent");
  const [sourceText, setSourceText] = useState("");
  const [messageInputs, setMessageInputs] = useState<Record<string, string>>({});
  const [pendingSkillIds, setPendingSkillIds] = useState<Record<string, string>>(
    {}
  );
  const [slashMenus, setSlashMenus] = useState<Record<string, boolean>>({});
  const workbench = useAgentWorkbench();
  const { genesis } = workbench;

  const canForge =
    !!genesis.address && sourceText.trim().length > 0 && !genesis.isForging;

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
        <div className="brand">ThoughtLine</div>
        <button onClick={genesis.connectWallet} type="button">
          {genesis.address
            ? `${genesis.address.slice(0, 6)}...${genesis.address.slice(-4)}`
          : "Connect wallet"}
        </button>
      </nav>

      <section className="page-head">
        <div>
          <h1>Agents</h1>
          <p className="muted">
            Public by default. Token, owner, skills, generation, and data hash
            are visible at a glance.
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
            <span>{workbench.filteredAgents.length} visible</span>
            <span>{workbench.isLoadingGallery ? "loading" : "ready"}</span>
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

            return (
              <article className="gallery-row" key={agent.tokenId}>
                <div className="gallery-row-agent">
                  <div className="row-kicker">Token #{agent.tokenId}</div>
                  <div className="row-title">{agent.publicProfile.name}</div>
                  <div className="row-desc">{agent.publicProfile.description}</div>
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
                  <code>{agent.owner}</code>
                </div>

                <div className="gallery-row-hash">
                  <code>{agent.dataHash}</code>
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
                        <div className={proof.proof.matches ? "proof ok" : "proof"}>
                          {proof.proof.matches ? "Match" : "Mismatch"} ·{" "}
                          {proof.proof.byteLength} bytes
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
                            <div className="conversation-panel">
                              <div className="conversation-history">
                                {conversation.messages.length === 0 ? (
                                  <div className="conversation-empty">
                                    Ask this agent a question.
                                  </div>
                                ) : null}
                                {conversation.messages.map((message, index) => (
                                  <div
                                    className={`conversation-message ${message.role}`}
                                    key={`${message.role}-${index}`}
                                  >
                                    <div>{message.content}</div>
                                    {message.role === "assistant" &&
                                    message.usedSkillId ? (
                                      <span>Used /{message.usedSkillId}</span>
                                    ) : null}
                                  </div>
                                ))}
                              </div>

                              <div className="ask-box">
                                {pendingSkill ? (
                                  <button
                                    className="slash-chip"
                                    type="button"
                                    onClick={() =>
                                      setPendingSkillIds((current) => {
                                        const next = { ...current };
                                        delete next[agent.tokenId];
                                        return next;
                                      })
                                    }
                                  >
                                    /{pendingSkill.id}
                                  </button>
                                ) : null}
                                <textarea
                                  aria-label={`Ask ${agent.publicProfile.name}`}
                                  value={messageInput}
                                  onChange={(event) => {
                                    const nextValue = event.target.value;
                                    setMessageInputs((current) => ({
                                      ...current,
                                      [agent.tokenId]: nextValue,
                                    }));
                                    setSlashMenus((current) => ({
                                      ...current,
                                      [agent.tokenId]: nextValue.startsWith("/"),
                                    }));
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                      event.preventDefault();
                                      sendConversationMessage(agent);
                                    }
                                  }}
                                  placeholder="Ask or type /"
                                />
                                {showSlashMenu ? (
                                  <div className="slash-menu">
                                    {slashMatches.map((skill) => (
                                      <button
                                        type="button"
                                        key={skill.id}
                                        onClick={() => {
                                          setPendingSkillIds((current) => ({
                                            ...current,
                                            [agent.tokenId]: skill.id,
                                          }));
                                          setMessageInputs((current) => ({
                                            ...current,
                                            [agent.tokenId]: "",
                                          }));
                                          setSlashMenus((current) => ({
                                            ...current,
                                            [agent.tokenId]: false,
                                          }));
                                        }}
                                      >
                                        <strong>/{skill.id}</strong>
                                        <span>{skill.name}</span>
                                      </button>
                                    ))}
                                    {slashMatches.length === 0 ? (
                                      <div>No matching skills</div>
                                    ) : null}
                                  </div>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={
                                    conversation.status === "loading" ||
                                    messageInput.trim().length === 0
                                  }
                                  onClick={() => sendConversationMessage(agent)}
                                >
                                  {conversation.status === "loading"
                                    ? "Sending..."
                                    : "Send"}
                                </button>
                              </div>
                              {conversation.status === "error" ? (
                                <div className="proof error">
                                  {conversation.error}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="proof">
                          Owner unlock is unavailable for this wallet.
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
              Paste source text, synthesize a public profile and encrypted
              private worldview, then mint the iNFT.
            </p>
          </div>

          <div className="panel">
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
                <label htmlFor="source-text">Source text</label>
                <textarea
                  id="source-text"
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  placeholder="Paste notes, principles, writing, or a decision-making profile."
                />
              </div>

              <div className="actions">
                <button
                  disabled={!canForge || genesis.isSigning}
                  onClick={() => genesis.forgeGenesis({ name, sourceText })}
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
              <div>
                Public URI: <code>{genesis.ready.publicUri}</code>
              </div>
              <div>
                Private URI: <code>{genesis.ready.privateUri}</code>
              </div>
              <div>
                Data hash: <code>{genesis.ready.dataHash}</code>
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
    </main>
  );
}
