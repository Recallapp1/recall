import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      {/* Pulled up under the sticky header so the hero starts at the top edge. */}
      <main className="-mt-[4.25rem] flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}
