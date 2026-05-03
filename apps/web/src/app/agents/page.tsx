import { GallerySection, PageHead } from "@/components/gallery-section";

export const dynamic = "force-dynamic";

export default function AgentsPage() {
  return (
    <>
      <PageHead />
      <GallerySection grouped />
    </>
  );
}
