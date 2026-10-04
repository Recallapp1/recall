# ADR-008: shadcn/ui bileşenleri DESIGN.md token'larıyla doğrudan temalanır

- **Durum:** Kabul edildi
- **Tarih:** 2026-10-04
- **İlgili:** [ADR-001](ADR-001-stack.md) (stack: shadcn/ui), [ADR-005](ADR-005-design-system.md), [ADR-007](ADR-007-navy-palette-and-landing.md), görev F4.2

## Bağlam

Panel için form, tablo, dialog, menü gibi erişilebilir temel bileşenlere ihtiyaç var. Stack kararı shadcn/ui (Radix tabanlı, kod projeye kopyalanır). shadcn bileşenleri kendi tema adlarını kullanır: `background`, `foreground`, `muted`, `popover`, `accent`, `destructive`, `input`, `ring`…

Bu adların ikisi bizim token'larımızla çakışır:

- shadcn'de `accent` menü öğesinin hover zeminidir; bizde `accent` yalnızca koyu zeminde kullanılan parlak mavidir (beyazda 2,5:1).
- shadcn'de `primary-foreground` gibi çiftler vardır; bizde karşılığı `on-dark` token'ıdır.

## Karar

1. **Takma ad katmanı yok.** shadcn'in tema değişkenleri `globals.css`'e eklenmez. Bileşenler (`src/components/ui/`) eklendikten sonra sınıfları DESIGN.md token'larına çevrilir: `background`/`popover`/`card` → `paper`, `muted` → `canvas`, `muted-foreground` → `body`, `foreground` → `heading`, `border`/`input` → `hairline`, `ring` → `primary`, `destructive` → `danger`, `primary-foreground` → `on-dark`. Hover/odak zemini: `primary-soft`.
2. `pnpm lint:tokens` shadcn tema adlarını yakalar. Yeni bir `shadcn add` sonrası bu kontrol çevrilmemiş sınıfları listeler; aksi hâlde bileşen hata vermeden stilsiz görünürdü.
3. **Taban:** Radix (`radix-ui`), stil `radix-nova`. `components.json` `utils` takma adı `@/lib/cn`'e yönlendirilir. `tw-animate-css` içe aktarılır. Radix durum varyantları (`data-open:`, `data-checked:` …) shadcn'in `tailwind.css` dosyasından (MIT) `globals.css`'e kopyalandı; shadcn CLI bağımlılık değildir, bileşen eklemek için `pnpm dlx shadcn@latest add <ad>` kullanılır.
4. **Yeni token'lar (panel):** `danger` `#B91C1C` (beyazda 6,5:1), `danger-hover`, `danger-soft`, `success-soft`. DESIGN.md hata ve yıkıcı eylem rengi tanımlamıyordu. Panel türetmeleriyle birlikte ürün ekibinin onayına sunulur.
5. **Odak halkası:** Açık zeminde `primary` (6,7:1), koyu zeminde `accent` (6,9:1). Önceki `accent` halka beyazda 2,5:1 ile WCAG 1.4.11'i (3:1) karşılamıyordu. `surface-dark` yardımcısı `--focus-ring` değişkenini ayarlar.
6. Uygulamanın tamamı açık temalıdır; shadcn'in `dark:` sınıfları ve `next-themes` kaldırıldı.

## Sonuçlar

- ✅ Tek renk sistemi; shadcn ile DESIGN.md arasında iki paralel palet yok.
- ✅ Yeni bileşen eklemek güvenli: lint, çevrilmemiş sınıfları gösterir.
- ⚠️ `shadcn add` ile bir bileşeni yeniden üretmek elle yapılan temalamayı ezer. Güncelleme gerekirse fark elle birleştirilir.
- ⏳ `danger` token'ı ve panel türetmeleri F5 öncesi ürün ekibinin onayını bekliyor.
