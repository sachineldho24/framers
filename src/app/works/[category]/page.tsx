import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorksPage } from "@/components/works/WorksPage";
import { WORK_CATEGORIES, getWorkCategory, getWorksPage } from "@/lib/works";

type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export function generateStaticParams() {
  return WORK_CATEGORIES.map(category => ({ category: category.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = getWorkCategory((await params).category);
  if (!category) notFound();
  return { title: `${category.label} | Our Works | Framers Lab`, description: category.description };
}

export default async function CategoryWorks({ params, searchParams }: Props) {
  const { category } = await params;
  const collection = getWorksPage(category, (await searchParams).page);
  if (!collection) notFound();
  return <WorksPage category={category} collection={collection} />;
}
