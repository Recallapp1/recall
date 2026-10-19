# Tasarım Sistemi: Kod Karşılığı ve Panel Türetmeleri

> **Tek tasarım kaynağı kök dizindeki [DESIGN.md](../../DESIGN.md) dosyasıdır** (v2, lacivert + beyaz; [ADR-005](../decisions/ADR-005-design-system.md), [ADR-007](../decisions/ADR-007-navy-palette-and-landing.md)).
> Bu belge DESIGN.md'nin koddaki karşılığını ve DESIGN.md'nin tarif etmediği panel öğelerini (tablo, form, takvim, rozet vb.) **DESIGN.md kurallarını bozmadan** tanımlar. Çelişki olursa DESIGN.md geçerlidir.

Canlı stil rehberi (yalnızca geliştirmede): http://localhost:3000/dev/tasarim

## 1. Token'lar

Tek yer: [`src/app/globals.css`](../../src/app/globals.css) (`@theme`). Bileşenlerde sabit renk yasaktır; `pnpm lint:tokens` (CI'da) hex, `rgb()` ve Tailwind'in hazır paletini (`bg-blue-700` vb.) yakalar.

| Rol                         | Token / sınıf                                    | Değer                                  |
| --------------------------- | ------------------------------------------------ | -------------------------------------- |
| En koyu lacivert            | `ink`                                            | `#050B1F`                              |
| Koyu bölüm zemini           | `surface-dark`                                   | `#0B1736`                              |
| Koyu gradyanın alt yarısı   | `surface-darker`                                 | `#060E24`                              |
| Koyu zeminde kart           | `surface-raised`                                 | `#13254F`                              |
| Koyu zeminde hover          | `surface-dark-hover`                             | `#1A2B57`                              |
| Sayfa zemini                | `canvas`                                         | `#F4F7FC`                              |
| Kart / açık bölüm           | `paper`                                          | `#FFFFFF`                              |
| Birincil (buton, link)      | `primary` / `primary-hover`                      | `#1D4ED8` / `#1E40AF`                  |
| İkon zemini (açık)          | `primary-soft`                                   | `#DBEAFE`                              |
| Vurgu (yalnızca koyu zemin) | `accent`                                         | `#60A5FA`                              |
| Olumlu durum                | `success` / `success-soft`                       | `#15803D` / `#DCFCE7`                  |
| Hata, yıkıcı eylem (panel)  | `danger` / `danger-hover` / `danger-soft`        | `#B91C1C` / `#991B1B` / `#FEE2E2`      |
| Odak halkası                | `--focus-ring`                                   | açıkta `primary`, koyuda `accent`      |
| Başlık / gövde (açık)       | `heading` / `body`                               | `#0B1736` / `#475569`                  |
| Kenarlık (açık)             | `hairline`                                       | `#E3E8F2`                              |
| Glass                       | `glass` / `glass-strong` / `glass-border`        | %5 / %10 / %12 beyaz                   |
| Koyu zeminde metin          | `on-dark` / `on-dark-soft` / `on-dark-muted`     | beyaz / %85 / `#A5B4CF`                |
| Font                        | `font-sans`                                      | Montserrat (yerel paket, `latin-ext`)  |
| Başlık / etiket             | `text-display` / `text-label`                    | `-0.05em`, `1.05` / 700, 10px, `0.2em` |
| Radius                      | `rounded-section` / `bento` / `card` / `card-sm` | 2.5 / 2 / 1.5 / 1 rem                  |
| Blur                        | `glass` (12px), `glass-nav` (20px)               |                                        |
| Giriş animasyonu            | `animate-fade-in-up`                             | 20px → 0, 0.8 sn                       |

**Koyu zemin kuralı:** Koyu yüzeyler `surface-dark` sınıfını kullanır (lacivert gradyan + %8 grain + beyaz metin). Dekoratif ışık katmanları kullanan koyu bölümlere `overflow-hidden` eklenir; aksi hâlde sayfa yatay taşar.

## 2. Bileşenler

**Ortak** ([`src/components/design/`](../../src/components/design/)):

| Bileşen                                     | Kullanım                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `ActionButton`, `ActionLink`                | Ana eylem. `variant="onDark"` (lacivertte beyaz) veya `"primary"` (açıkta mavi) |
| `SecondaryLink`                             | İkincil eylem, çerçeveli hap. `tone="onDark" \| "onLight"`                      |
| `GlassCard`, `GlassStatCard`                | Koyu zemindeki paneller ve metrikler                                            |
| `StatusTag`                                 | Vurgu noktalı, hafif zıplayan cam etiket                                        |
| `SectionShell`, `PageContainer`, `FadeInUp` | Bölüm kapsayıcısı, sayfa kapsayıcısı, giriş animasyonu                          |
| `Eyebrow`, `DisplayHeading`, `BodyText`     | Etiket, bölüm başlığı, gövde metni                                              |

**Tanıtım sayfası** ([`src/app/(marketing)/`](<../../src/app/(marketing)/>)): `_content.ts` tüm metinleri tutar (tasarıma dokunmadan düzenlenir). `_components/` altında `site-header` (sticky), `hero`, `overview` (klinik türleri, sorun, nasıl çalışır, özellikler), `product` (örnek görüşme, panel önizlemesi), `trust` (güvenlik, kurulum, paketler, SSS), `contact` + `demo-form`, `site-footer`, `section-header`, `logo`.

**Panel temelleri** ([`src/components/ui/`](../../src/components/ui/), shadcn/ui + Radix, [ADR-008](../decisions/ADR-008-shadcn-theming.md)): `Button` (default, outline, secondary, ghost, destructive, link; hap), `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Label`, `Dialog`, `Sheet`, `Popover`, `Calendar` (tarih seçici, Türkçe, hafta pazartesi başlar), `DropdownMenu`, `Tooltip`, `Tabs`, `Table`, `Badge`, `Avatar`, `Skeleton`, `Separator`, `Toaster` (sonner). Yeni bir shadcn bileşeni eklendiğinde sınıflar DESIGN.md token'larına çevrilir; `pnpm lint:tokens` çevrilmemiş olanları yakalar.

**Panel bileşenleri** ([`src/components/panel/`](../../src/components/panel/)):

| Bileşen                                            | Kullanım                                                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `AppointmentStatusBadge`, `AppointmentSourceBadge` | Durum ve kaynak rozetleri; etiketler `src/lib/contracts/appointment.ts` (DB enum'larıyla aynı kaynak) |
| `ScheduleGrid`                                     | Gün (hekim kolonları) ve hafta (gün kolonları) takvimi; çakışan randevular yan yana; "şimdi" çizgisi  |
| `FormField`                                        | Etiket + alan + ipucu/hata; `aria-describedby` ve `aria-invalid` otomatik                             |
| `EmptyState`                                       | Boş liste/takvim                                                                                      |

Sınıf birleştirme: `cn()` ([`src/lib/cn.ts`](../../src/lib/cn.ts)); özel token'ları tanır. Yeni token eklenirse buradaki listeye de eklenmelidir. İkonlar: [lucide-react](https://lucide.dev).

## 3. Panel türetmeleri (F4.2 / F5)

Türetmeler **ürün sahibi onayladı, 2026-10-20**: stil rehberinde (`/dev/tasarim`) görüldüğü gibi, değişiklik istenmedi. F4.2'de koda döküldü; canlı hâli stil rehberinin "Panel bileşenleri" bölümünde.

### Kabuk

- **Kenar çubuğu:** `surface-dark` (lacivert gradyan + grain). Aktif öğe: `glass-strong` zemin ve `accent` nokta.
- **İçerik alanı:** `canvas` zemin; kartlar `paper`, `rounded-card`, `hairline` kenarlık.
- **Üst bar:** Tanıtım sayfasındaki header ile aynı dil (lacivert cam hap).
- **Mobil:** Alt sekme çubuğu.

### Yoğun veri öğeleri

| Öğe             | Öneri                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Tablo           | `paper` kart; başlık satırı `text-label text-body`; satır ayırıcı `hairline`; hover `canvas`                                               |
| Form alanı      | Demo formundaki stil: `paper`, `hairline`, `rounded-card-sm`, 44px yükseklik; odakta `primary` kenarlık; hatada `danger` kenarlık ve metin |
| Birincil buton  | `ActionButton variant="primary"` veya düz `primary` hap                                                                                    |
| İkincil buton   | `SecondaryLink tone="onLight"`                                                                                                             |
| Takvim ızgarası | `paper` kart; saat çizgileri `hairline`; randevu blokları `primary-soft` zemin, `rounded-card-sm`                                          |
| Dialog / Sheet  | `paper`, `rounded-bento`; arka plan karartması `ink` %40                                                                                   |
| Boş durum       | `primary-soft` daire içinde ikon + kısa açıklama + tek eylem                                                                               |
| Toast           | `surface-dark` kart, beyaz metin, `accent` ikon; hata toast'u `danger` zemin                                                               |
| Menü / Select   | `paper`, `rounded-card-sm`, `hairline` çerçeve; odaktaki öğe `primary-soft`; yıkıcı öğe `danger`                                           |
| Sekmeler        | Hap; liste zemini `hairline`, aktif sekme `paper`                                                                                          |

### Durum rozetleri (ürün sahibi onayladı, 2026-10-20)

Renk tek başına anlam taşımaz; her rozette metin vardır.

| Durum         | Rozet                                                                         |
| ------------- | ----------------------------------------------------------------------------- |
| scheduled     | `hairline` kenarlıklı hap, "Planlandı"                                        |
| confirmed     | `primary-soft` zemin, `primary` metin, "Onaylandı"                            |
| completed     | `canvas` zemin, `body` metin, "Tamamlandı"                                    |
| cancelled     | `canvas` zemin, üstü çizili "İptal"                                           |
| no_show       | kesikli kenarlık, "Gelmedi"                                                   |
| kaynak: voice | `primary-soft` hap, "Asistan" (tanıtım sayfasındaki panel önizlemesiyle aynı) |
| kaynak: panel | `hairline` hap, "Panel"                                                       |

## 4. Erişilebilirlik

| Kombinasyon                      | Kontrast | Sonuç                       |
| -------------------------------- | -------- | --------------------------- |
| `body` / `paper`                 | 7,58     | ✅ AA                       |
| `body` / `canvas`                | 7,06     | ✅ AA                       |
| `heading` / `paper`              | 17,65    | ✅ AAA                      |
| beyaz / `primary`                | 6,70     | ✅ AA                       |
| `accent` / `surface-dark`        | 6,94     | ✅ AA                       |
| `on-dark-muted` / `surface-dark` | 8,43     | ✅ AAA                      |
| `success` / `paper`              | 5,02     | ✅ AA                       |
| `accent` / `paper`               | 2,54     | ❌ Metin olarak kullanılmaz |

- Odak: tüm etkileşimli öğelerde 2px vurgu halkası.
- `prefers-reduced-motion` destekleniyor.
- Form hataları alanla `aria-describedby` ile ilişkili; genel hata `role="alert"`, başarı `role="status"`.

## 5. UI yazım tonu

- Panel ve site yalnızca Türkçe; "siz" dili.
- Kısa ve eylem odaklı: "Randevu oluştur", "Demo talep edin".
- Hata mesajı ne olduğunu ve ne yapılacağını söyler: "Geçerli bir telefon numarası yazın."
- Uydurma müşteri, yorum veya istatistik yok; örnek görseller "örnek" olarak etiketlenir.

## 6. Bekleyen varlıklar

- **Recall logosu:** Şimdilik geçici yazı-logo (`_components/logo.tsx`).
- **Görsel varlıklar:** Hero ve özellik bölümlerinde CSS tabanlı derinlik (ışık, ızgara, grain) kullanılıyor. Ürün ekibiyle birlikte üretilecek.
