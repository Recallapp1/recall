import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      {/* Pulled up by the header height (h-14) plus its top margin, so the header floats inside the hero. */}
      <main className="-mt-[5.5rem] flex flex-1 flex-col sm:-mt-[6.25rem]">{children}</main>
      <SiteFooter />
    </div>
  );
}
