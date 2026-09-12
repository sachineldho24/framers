import type { Metadata } from "next";
import { WorksPage } from "@/components/works/WorksPage";
import { getWorksPage } from "@/lib/works";

export const metadata: Metadata = {
  title: "Our Works | Framers Lab",
  description: "Explore real custom artwork by Framers Lab: cars, bikes, buses, birthday collages, anniversary gifts, and personal portraits.",
};

export default async function OurWorks({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const { page } = await searchParams;
  return <WorksPage collection={getWorksPage(undefined, page)!} />;
}
