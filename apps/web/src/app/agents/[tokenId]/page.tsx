import { AgentDetail } from "@/components/agent-detail";

export const dynamic = "force-dynamic";

interface AgentDetailPageProps {
  params: Promise<{ tokenId: string }>;
}

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { tokenId } = await params;
  return <AgentDetail tokenId={tokenId} />;
}
