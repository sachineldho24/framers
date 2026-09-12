import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { MobileTopBar } from "@/components/MobileTopBar";
import { Footer } from "@/components/Footer";
import { WorksGrid } from "./WorksGrid";
import { WORKS, WORK_CATEGORIES, getWorkCategory, getWorksPage } from "@/lib/works";

type Collection = NonNullable<ReturnType<typeof getWorksPage>>;

export function WorksPage({ category, collection }: { category?: string; collection: Collection }) {
  const current = category ? getWorkCategory(category) : undefined;
  const base = category ? `/works/${category}` : "/works";
  const labels = Object.fromEntries(WORK_CATEGORIES.map(item => [item.id, item.label]));
  const pageLink = (page: number) => `${base}${page === 1 ? "" : `?page=${page}`}#work-grid`;

  return (
    <>
      <MobileTopBar />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-margin-mobile pb-8 pt-24 sm:px-8 lg:px-12 lg:pt-28">
        <nav aria-label="Breadcrumb" className="mb-7 flex flex-wrap items-center gap-3 font-label text-[10px] uppercase tracking-wider text-on-surface-variant sm:mb-9">
          <Link href="/" className="py-2 hover:text-white">Home</Link><span aria-hidden="true">/</span>
          {current ? <><Link href="/works" className="py-2 hover:text-white">Our Works</Link><span aria-hidden="true">/</span><span aria-current="page" className="text-white">{current.label}</span></> : <span aria-current="page" className="text-white">Our Works</span>}
        </nav>

        <header className="border-b-2 border-outline-variant pb-7 sm:pb-12">
          <p className="label-caps mb-5 text-[10px] text-action-red">Made by Framers. Made personal.</p>
          <div className="flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-end lg:gap-12">
            <div>
              <h1 className={`max-w-4xl font-black leading-[0.9] tracking-[-0.065em] ${current && current.label.length >= 8 ? "text-[clamp(1.75rem,10.5vw,8rem)]" : "text-[clamp(2.25rem,10vw,8rem)]"}`}>
                {current ? <>{current.label}<span className="text-neon-accent">.</span></> : <>Our <span className="text-neon-accent">Works.</span></>}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-on-surface-variant sm:mt-6 sm:text-lg">
                {current?.description ?? "Custom artwork for your rides, your people, and your favourite moments."}
              </p>
            </div>
            <Link href="/design/start" className="inline-flex min-h-12 shrink-0 items-center gap-8 border border-neon-accent bg-neon-accent px-5 py-3 font-label text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-white hover:border-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-accent">
              Make it yours <ArrowUpRight size={21} aria-hidden="true" />
            </Link>
          </div>
        </header>

        <nav aria-label="Work categories" className="flex flex-wrap gap-2 py-7 sm:py-9">
          {[{ id: undefined, label: "All works", count: WORKS.length }, ...WORK_CATEGORIES.map(item => ({ ...item, count: WORKS.filter(work => work.category === item.id).length }))].map(item => {
            const active = item.id === category;
            return (
              <Link key={item.id ?? "all"} href={item.id ? `/works/${item.id}` : "/works"} aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 border px-3 py-2 font-label text-[11px] font-bold uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-neon-accent sm:px-4 ${active ? "border-neon-accent bg-neon-accent text-black" : "border-outline-variant bg-surface text-on-surface-variant hover:border-white hover:text-white"}`}>
                {item.label}<span className={`text-[10px] tabular-nums ${active ? "text-black/65" : "text-outline"}`}>{String(item.count).padStart(2, "0")}</span>
              </Link>
            );
          })}
        </nav>

        <section id="work-grid" aria-label={current ? `${current.label} artwork` : "All artwork"} className="scroll-mt-24">
          <div className="mb-5 flex items-center justify-between gap-4 border-b border-outline-variant pb-4 font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
            <p>{collection.total} {collection.total === 1 ? "piece" : "pieces"}{collection.totalPages > 1 && ` / Showing ${(collection.page - 1) * 24 + 1}–${Math.min(collection.page * 24, collection.total)}`}</p>
            <p className="text-right">Open a piece. Take a closer look.</p>
          </div>
          <WorksGrid key={`${base}-${collection.page}`} items={collection.items} labels={labels} />
        </section>

        {collection.totalPages > 1 && (
          <nav aria-label="Artwork pages" className="mt-12 grid grid-cols-2 items-center justify-between gap-4 border-t border-outline-variant pt-6 sm:flex">
            {collection.page > 1 ? <Link href={pageLink(collection.page - 1)} className="inline-flex min-h-11 items-center gap-2 font-label text-xs uppercase hover:text-neon-accent"><ArrowLeft size={17} aria-hidden="true" /> Previous</Link> : <span className="inline-flex min-h-11 items-center gap-2 font-label text-xs uppercase text-outline"><ArrowLeft size={17} aria-hidden="true" /> Previous</span>}
            <div className="col-span-2 row-start-1 flex justify-center gap-1">
              {Array.from({ length: collection.totalPages }, (_, index) => index + 1).map(page => <Link key={page} href={pageLink(page)} aria-label={`Page ${page}`} aria-current={page === collection.page ? "page" : undefined} className={`grid h-11 min-w-9 place-items-center px-2 font-label text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-neon-accent ${page === collection.page ? "bg-neon-accent font-bold text-black" : "text-on-surface-variant hover:bg-surface-muted hover:text-white"}`}>{page}</Link>)}
            </div>
            {collection.page < collection.totalPages ? <Link href={pageLink(collection.page + 1)} className="inline-flex min-h-11 items-center justify-end gap-2 font-label text-xs uppercase hover:text-neon-accent">Next <ArrowRight size={17} aria-hidden="true" /></Link> : <span className="inline-flex min-h-11 items-center justify-end gap-2 font-label text-xs uppercase text-outline">Next <ArrowRight size={17} aria-hidden="true" /></span>}
          </nav>
        )}

        <section className="mt-16 flex flex-col justify-between gap-6 border-y border-outline-variant py-10 sm:flex-row sm:items-center">
          <div><p className="label-caps mb-3 text-[10px] text-neon-accent">Your photo is next</p><h2 className="text-2xl leading-tight sm:text-3xl">Something worth framing.</h2><p className="mt-3 max-w-lg text-sm leading-relaxed text-on-surface-variant">Upload your photo, choose a frame, and make it your own.</p></div>
          <Link href="/design/start" className="inline-flex min-h-12 items-center justify-center gap-6 self-start bg-action-red px-6 py-4 font-label text-xs font-bold uppercase text-white hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action-red">Start framing <ArrowUpRight size={19} aria-hidden="true" /></Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
