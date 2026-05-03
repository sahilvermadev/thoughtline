"use client";

import { useState } from "react";
import type { SkillPackage } from "@thoughtline/shared";
import type { AgentConversationMessage } from "@/lib/agent-conversation";
import type { PublicAgentView } from "@/lib/gallery/public-agents";
import { useWorkbench } from "@/lib/workbench-context";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Textarea } from "./ui/textarea";
import { cn } from "@/lib/utils";

type ConversationState = {
  status: "idle" | "loading" | "error";
  messages: AgentConversationMessage[];
  error?: string;
};

interface ConversationPanelProps {
  agent: PublicAgentView;
  className?: string;
  mode?: "inline" | "modal";
}

export function ConversationPanel({
  agent,
  className,
  mode = "inline",
}: ConversationPanelProps) {
  const workbench = useWorkbench();
  const conversation: ConversationState = workbench.conversations[agent.tokenId] ?? {
    status: "idle",
    messages: [],
  };

  const [messageInput, setMessageInput] = useState("");
  const [pendingSkillId, setPendingSkillId] = useState<string | undefined>(
    undefined
  );
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);

  const pendingSkill: SkillPackage | undefined = agent.publicProfile.skills.find(
    (skill) => skill.id === pendingSkillId
  );
  const slashQuery = messageInput.startsWith("/")
    ? messageInput.slice(1).toLowerCase()
    : "";
  const slashMatches: SkillPackage[] = agent.publicProfile.skills.filter(
    (skill) =>
      `${skill.id} ${skill.name}`.toLowerCase().includes(slashQuery)
  );
  const showSlashMenu = slashMenuOpen && messageInput.startsWith("/");

  function send() {
    const slashMatch = messageInput.match(/^\/([a-z0-9-]+)\s*(.*)$/i);
    const typedSkillId =
      slashMatch &&
      agent.publicProfile.skills.some((skill) => skill.id === slashMatch[1])
        ? slashMatch[1]
        : undefined;
    const content = typedSkillId
      ? slashMatch?.[2]?.trim() ?? ""
      : messageInput;
    const skillId = pendingSkillId ?? typedSkillId;

    if (content.trim().length === 0) return;

    setMessageInput("");
    setPendingSkillId(undefined);
    setSlashMenuOpen(false);
    void workbench.sendMessage(agent, {
      content: content.trim(),
      skillId,
    });
  }

  return (
    <div className={cn("conversation-panel", `conversation-panel-${mode}`, className)}>
      <ScrollArea className="conversation-history">
        {conversation.messages.length === 0 ? (
          <div className="conversation-empty">Ask this agent a question.</div>
        ) : null}
        {conversation.messages.map((message, index) => (
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
      </ScrollArea>

      <div className="ask-box">
        {pendingSkill ? (
          <Button
            className="slash-chip"
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => setPendingSkillId(undefined)}
          >
            /{pendingSkill.id}
          </Button>
        ) : null}
        <Textarea
          aria-label={`Ask ${agent.publicProfile.name}`}
          value={messageInput}
          onChange={(event) => {
            const nextValue = event.target.value;
            setMessageInput(nextValue);
            setSlashMenuOpen(nextValue.startsWith("/"));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          placeholder="Ask or type /"
        />
        {showSlashMenu ? (
          <div className="slash-menu">
            {slashMatches.map((skill) => (
              <Button
                type="button"
                key={skill.id}
                variant="ghost"
                onClick={() => {
                  setPendingSkillId(skill.id);
                  setMessageInput("");
                  setSlashMenuOpen(false);
                }}
              >
                <strong>/{skill.id}</strong>
                <span>{skill.name}</span>
              </Button>
            ))}
            {slashMatches.length === 0 ? <div>No matching skills</div> : null}
          </div>
        ) : null}
        <Button
          type="button"
          disabled={
            conversation.status === "loading" ||
            messageInput.trim().length === 0
          }
          onClick={send}
        >
          {conversation.status === "loading" ? "Sending..." : "Send"}
        </Button>
      </div>
      {conversation.status === "error" ? (
        <Alert className="ui-alert-error">
          <AlertDescription>{conversation.error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
