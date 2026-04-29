import type {
  LLMMessage,
  PrivateWorldview,
  PublicProfile,
} from "@thoughtline/shared";

export interface BuildSkillInvocationInput {
  privateWorldview: PrivateWorldview;
  publicProfile: PublicProfile;
  skillId: string;
  input: string;
}

export function buildSkillInvocationMessages(
  request: BuildSkillInvocationInput
): LLMMessage[] {
  const skill = request.publicProfile.skills.find(
    (candidate) => candidate.id === request.skillId
  );

  if (!skill) {
    throw new Error(`Skill not found: ${request.skillId}`);
  }

  return [
    {
      role: "system",
      content: `You are the ThoughtLine advisor "${request.publicProfile.name}".

Use the private worldview below as the agent's reasoning fingerprint:
${JSON.stringify(request.privateWorldview, null, 2)}

Invoke this public skill package:
${skill.skillMarkdown}

Answer as the agent. Follow the skill package procedure and output guidance.`,
    },
    {
      role: "user",
      content: request.input,
    },
  ];
}
