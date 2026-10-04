# Tasarım Sistemi: Kod Karşılığı ve Panel Türetmeleri

> **Tek tasarım kaynağı kök dizindeki [DESIGN.md](../../DESIGN.md) dosyasıdır** ([ADR-005](../decisions/ADR-005-design-system.md)).
> Bu belge DESIGN.md'nin koddaki karşılığını ve DESIGN.md'nin tarif etmediği panel öğelerini (tablo, form, takvim, rozet vb.) **DESIGN.md kurallarını bozmadan** tanımlar. Çelişki olursa DESIGN.md geçerlidir.

Canlı stil rehberi (yalnızca geliştirmede): http://localhost:3000/dev/tasarim

## 1. Token'lar

Tek yer: [`src/app/globals.css`](../../src/app/globals.css) (`@theme`). Bileşenlerde sabit renk yasaktır; `pnpm lint:tokens` (CI'da) hex, `rgb()` ve Tailwind'in hazır paletini (`bg-zinc-700` vb.) yakalar.

| DESIGN.md                    | Token / sınıf                                    | Değer                                             |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| Primary Dark                 | `ink`                                            | `#000000`                                         |
| Dark Surface (Zinc-900)      | `surface-dark`                                   | `#18181B`                                         |
| Koyu gradyanın alt ucu       | `surface-darker` (Zinc-950)                      | `#09090B`                                         |
| Action button ikon hover     | `surface-dark-hover` (Zinc-700)                  | `#3F3F46`                                         |
| Light Background (Zinc-100)  | `canvas`                                         | `#F4F4F5`                                         |
| Açık kart zemini             | `paper`                                          | `#FFFFFF`                                         |
| Accent (Emerald-400)         | `accent`                                         | `#34D399`                                         |
| Body Text (Zinc-500)         | `body`                                           | `#71717A`                                         |
| Açık zeminde başlık          | `heading` (Zinc-900)                             | `#18181B`                                         |
| Light Card Border (Zinc-100) | `hairline`                                       | `#F4F4F5`                                         |
| Glass                        | `glass` / `glass-strong` / `glass-border`        | %5 / %10 / %10 beyaz                              |
| Koyu zeminde metin           | `on-dark` / `on-dark-soft` / `on-dark-muted`     | beyaz / %80 / %60                                 |
| Font                         | `font-sans`                                      | Inter (yerel paket, `latin-ext`)                  |
| Başlık                       | `text-display`                                   | `-0.05em`, satır yüksekliği `1.05`                |
| Etiket                       | `text-label`                                     | 700, 10px, `0.2em`, büyük harf                    |
| Radius                       | `rounded-section` / `bento` / `card` / `card-sm` | 2.5 / 2 / 1.5 / 1 rem                             |
| Blur                         | `glass` (12px), `glass-nav` (20px)               |                                                   |
| Giriş animasyonu             | `animate-fade-in-up`                             | 20px → 0, 0.8 sn, `cubic-bezier(0.16, 1, 0.3, 1)` |
| Durum etiketi                | `animate-status-bounce`                          |                                                   |
| Sayfa genişliği              | `max-w-page`                                     | 1600px                                            |

**Koyu zemin kuralı** (DESIGN.md §6): Koyu yüzeyler `surface-dark` sınıfını kullanır. Bu sınıf alttan ağırlıklı gradyanı (`bg-dark-gradient`), %15 grain dokusunu ve beyaz metni birlikte uygular. Düz koyu zemin kullanılmaz.

**Hareket:** `prefers-reduced-motion` açıksa tüm animasyonlar kapanır (`globals.css` base katmanı).

## 2. Bileşenler

Konum: [`src/components/design/`](../../src/components/design/). İçe aktarma: `@/components/design`.

| Bileşen                                 | DESIGN.md                    | Kullanım                                                       |
| --------------------------------------- | ---------------------------- | -------------------------------------------------------------- |
| `ActionButton`, `ActionLink`            | §5 Interactive Action Button | Ana eylemler. Beyaz hap, iç içe yuvarlak ikon, hover'da %105   |
| `GlassCard`                             | §1 Glassmorphism             | Koyu zeminlerdeki paneller                                     |
| `GlassStatCard`                         | §5 Glass Stat Card           | Metrik + açıklama, `w-72`                                      |
| `StatusTag`                             | §2 status tag                | Emerald noktalı, hafif zıplayan cam etiket                     |
| `SectionShell`                          | §3, §6                       | `tone="dark" \| "light" \| "paper"`; her zaman `2.5rem` radius |
| `PageContainer`                         | §3                           | 1600px ortalanmış kapsayıcı                                    |
| `FadeInUp`                              | §2                           | Giriş animasyonu; `delay` ile kademeli                         |
| `Eyebrow`, `DisplayHeading`, `BodyText` | §1 Typography                | Etiket, bölüm başlığı (4xl–5xl), gövde metni                   |

Sınıfları birleştirmek için `cn()` ([`src/lib/cn.ts`](../../src/lib/cn.ts)) kullanılır; özel token'larımızı tanıyacak şekilde yapılandırılmıştır.

İkonlar: [lucide-react](https://lucide.dev).

## 3. Panel türetmeleri (F4.2 / F5)

DESIGN.md büyük ölçüde tanıtım sayfasını tarif eder. Panel için önerilen türetmeler aşağıdadır; **F5 başlamadan önce ürün ekibine gösterilip onaylatılacaktır.**

### Kabuk

- **Kenar çubuğu:** `surface-dark` (gradyan + grain), cam menü öğeleri. Aktif öğe: `glass-strong` zemin ve `accent` nokta.
- **İçerik alanı:** `canvas` zemin. Kartlar `paper`, `rounded-card`, `hairline` kenarlık.
- **Üst bar:** `glass-nav` hap biçiminde; klinik adı, klinik değiştirici, kullanıcı menüsü.
- **Mobil:** Kenar çubuğu yerine alt sekme çubuğu (`glass-nav`).

### Yoğun veri öğeleri

| Öğe             | Öneri                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Tablo           | `paper` kart içinde; başlık satırı `text-label text-body`; satır ayırıcı `hairline`; hover `canvas` |
| Form alanı      | `paper` zemin, `hairline` kenarlık, `rounded-card-sm`; odakta `accent` halka                        |
| Birincil buton  | `ActionButton` (açık zeminde koyu varyant: zemin `surface-dark`, metin `on-dark`)                   |
| İkincil buton   | `rounded-full`, `hairline` kenarlık, `paper` zemin                                                  |
| Takvim ızgarası | `paper` kart; saat çizgileri `hairline`; randevu blokları `rounded-card-sm`                         |
| Dialog / Sheet  | `paper`, `rounded-bento`; arka plan karartması `ink` %40                                            |
| Boş durum       | Ortalanmış ikon (`canvas` daire) + kısa açıklama + tek eylem                                        |
| İskelet yükleme | `canvas` bloklar, yumuşak nabız; `prefers-reduced-motion` ile statik                                |
| Toast           | `surface-dark` hap, `on-dark` metin, başarıda `accent` nokta                                        |

### Durum rozetleri (öneri, onay bekliyor)

DESIGN.md tek vurgu rengi tanımlıyor (Emerald-400). Durumlar bu yüzden renk yerine **biçim ve etiketle** ayrışır; renk tek başına anlam taşımaz (erişilebilirlik için de doğru olan budur).

| Durum         | Rozet                                            |
| ------------- | ------------------------------------------------ |
| scheduled     | `hairline` kenarlıklı boş hap, metin "Planlandı" |
| confirmed     | `accent` noktalı hap, metin "Onaylandı"          |
| completed     | `canvas` dolgu, metin "Tamamlandı"               |
| cancelled     | `canvas` dolgu, üstü çizili metin "İptal"        |
| no_show       | kesikli kenarlık, metin "Gelmedi"                |
| kaynak: voice | `surface-dark` hap, mikrofon ikonu, "Asistan"    |
| kaynak: panel | `hairline` hap, "Panel"                          |

## 4. Erişilebilirlik

| Konu                            | Durum                                                                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zinc-500 metin / Zinc-100 zemin | Kontrast ≈ **4,4:1**. WCAG AA küçük metin için 4,5:1 ister. **Öneri (onay bekliyor):** küçük gövde metni `paper` (beyaz) zeminde kullanılır (≈ 4,8:1); `canvas` üzerinde yalnızca büyük metin veya Zinc-600'e geçiş |
| Emerald-400                     | Beyaz zeminde metin olarak yetersiz (≈ 1,9:1). Açık zeminde yalnızca dolgu/nokta/odak halkası; metin olarak yalnızca koyu zeminde                                                                                   |
| Odak                            | Tüm etkileşimli öğelerde 2px `accent` odak halkası                                                                                                                                                                  |
| Hareket                         | `prefers-reduced-motion` destekleniyor                                                                                                                                                                              |
| Durumlar                        | Renk tek başına anlam taşımaz; her rozette metin var                                                                                                                                                                |

## 5. UI yazım tonu

- Panel yalnızca Türkçe; "siz" dili.
- Kısa ve eylem odaklı: "Randevu oluştur", "İptal et".
- Hata mesajı ne olduğunu ve ne yapılacağını söyler: "Bu saat dolu. Başka bir saat seçin."
- Sayılar arayüzde rakamla yazılır (sesli asistandaki rakam yasağı yalnızca konuşma için geçerlidir).

## 6. Bekleyen varlıklar

- **Recall logosu** ve **hero görseli** (DESIGN.md §4: yüksek çözünürlüklü soyut görsel, %60 opaklık). Ürün ekibiyle birlikte üretilecek. Şimdilik hero'da CSS tabanlı soyut zemin var: [`src/app/(marketing)/page.tsx`](<../../src/app/(marketing)/page.tsx>).
