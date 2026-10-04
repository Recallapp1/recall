# WORKLOG: Recall Çalışma Günlüğü

> **Agent'lar ve geliştiriciler için:** Bu dosya projede yapılan her işin kronolojik kaydıdır.
> İşe başlamadan önce **"Güncel durum"** bölümünü ve [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) belgesini oku.
> İşini bitirdiğinde **en üste** yeni bir kayıt ekle ve "Güncel durum" bölümünü güncelle. Kayıt eklemeden oturum bitmiş sayılmaz.

---

## Güncel durum

_Son güncelleme: 2026-10-04 (DESIGN.md v2 ve yeni tanıtım sayfası)_

| Konu                    | Durum                                                                                                                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aktif faz               | **F4**: yeni tanıtım sayfası tamam (13 bölüm, sticky header, demo formu). Sırada **F4.2** (panel bileşenleri), ardından **F3** (hesaplar)                                                                                          |
| F1 (ses)                | F1.1–F1.7 tamam. **F1.8**: demo kliniğin Retell ajanı canlı (`agent_d0b8d67285431ede3db2c75201`), Türkçe ve sayı okuma ekipçe onaylandı. Ajan şu an `claude-4.5-haiku` ile; gecikme karşılaştırması ekibin test aramasını bekliyor |
| Ses sağlayıcısı         | **Retell AI**, klinik başına senkronize ajan ([ADR-004](docs/decisions/ADR-004-retell-voice-platform.md))                                                                                                                          |
| Tasarım                 | **[DESIGN.md](DESIGN.md) v2** (lacivert + beyaz, [ADR-007](docs/decisions/ADR-007-navy-palette-and-landing.md)); token'lar `globals.css`, bileşenler `src/components/design`, stil rehberi `/dev/tasarim`, `pnpm lint:tokens`      |
| E-posta                 | Resend, adaptör arkasında ([ADR-006](docs/decisions/ADR-006-email-provider.md)); F3'te kurulacak                                                                                                                                   |
| Testler                 | **114 test** geçiyor. Lint, lint:tokens, typecheck, format, build temiz                                                                                                                                                            |
| Lokal DB                | `pnpm db:local` (PGlite) veya `pnpm db:up` (Docker). PGlite verisi 2026-10-04 tarihinde bozuldu; yedek `.pglite.corrupt-20261004`. Uzun süreli kullanımda Docker tercih edilmeli                                                   |
| Lokal ses testi         | `.env.local`: `APP_URL` = cloudflared hızlı tüneli (her açılışta değişir → `pnpm voice:sync --clinic gulus-dis`)                                                                                                                   |
| GitHub                  | `origin` = https://github.com/recallapp0/recall                                                                                                                                                                                    |
| Deploy                  | Yok. Vercel takımı `RECALL` (`recall25`) hazır, proje yok. Neon bekleniyor (F8)                                                                                                                                                    |
| Bekleyen ürün kararları | [IMPLEMENTATION-PLAN.md → Açık sorular](docs/IMPLEMENTATION-PLAN.md#açık-sorular-ürün-ekibine)                                                                                                                                     |
| Alınan ürün kararları   | [IMPLEMENTATION-PLAN.md → Alınan kararlar](docs/IMPLEMENTATION-PLAN.md#alınan-kararlar)                                                                                                                                            |

### Dallar ve saklanan işler

| Ad          | İçerik                                                  | Durum                                               |
| ----------- | ------------------------------------------------------- | --------------------------------------------------- |
| `main`      | Tüm tamamlanan işler                                    | `origin/main` ile aynı                              |
| `stash@{0}` | "WIP F3 (orphaned session): add better-auth dependency" | F3'e başlarken incelenip uygulanacak veya silinecek |

### Sıradaki işler

1. Ürün ekibi: tanıtım sayfası geri bildirimi; `claude-4.5-haiku` ile bir test araması (gecikme karşılaştırması)
2. F4.2: panel bileşenleri (form, tablo, dialog, takvim, rozetler)
3. F3: Better Auth, klinik hesapları, roller (stash'teki yarım işi değerlendir)
4. Demo talepleri: ekibe e-posta bildirimi ve görüntüleme (F3/F6)
5. Logo ve görsel varlıklar (ürün ekibiyle birlikte)

---

## Kayıt biçimi

Her kayıt şu şablonu izler (en yeni en üstte):

```markdown
### YYYY-AA-GG · <kısa başlık> · <görev kimlikleri, ör. F1.3, F1.4>

**Agent/kişi:** <model veya isim> · **Dal:** <dal> · **Commit'ler:** <kısa hash'ler>

**Ne yapıldı**

- …

**Neden** (kararlar ve gerekçeleri; büyükse ADR'ye bağlantı)

- …

**Doğrulama**

- Çalıştırılan komutlar ve sonuçları (ör. `pnpm test`: 80/80)

**Açık kalanlar / dikkat**

- …
```

Kurallar:

- Dosya yollarını tıklanabilir link olarak yaz.
- Kişisel veri, gizli anahtar veya token yazma.
- Başarısız denemeleri de yaz; bir sonraki agent'ın aynı hatayı yapmasını önler.

---

## Kayıtlar

### 2026-10-04 · Navbar genişliği · F4.3

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `main` · **Commit'ler:** bu kaydı içeren commit

- Ürün ekibi isteği: navbar yatayda biraz kısalsın. `max-w-6xl` (1152 px) → `max-w-5xl` (1024 px), ortalı. 1280 px'te linkler ve buton sığıyor, taşma yok. Mobil değişmedi. DESIGN.md §3 güncellendi.

### 2026-10-04 · Navbar ile hero arasındaki oran · F4.3

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `main` · **Commit'ler:** bu kaydı içeren commit

**Ne yapıldı**

- Navbar hero kartının üst kenarına yapışıktı. Header artık `sticky top-3 mt-8 sm:mt-11 px-8 sm:px-12`, navbar sabit `h-14`; hero `mt-4 sm:mt-6`; `main` negatif üst boşluğu header yüksekliği + üst boşluk kadar (`-mt-[5.5rem] sm:-mt-[6.25rem]`). Yüzey ölçüm noktası `PROBE_Y` 36 → 40.

**Doğrulama (ölçüm)**

- 375 px: navbar hero'nun üstünden ve iki yanından 16 px. 1280 px: üstten 20 px, yanlarda içerikle aynı hiza (56 / 1208). 1680 px: aynı hiza (257 / 1409). Kaydırırken üstten 12 px. Taşma yok. Lint, typecheck temiz.

### 2026-10-04 · Tanıtım sayfası geri bildirimi: şeffaf navbar, köşeli hero ve footer · F4.3

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `main` · **Commit'ler:** bu kaydı içeren commit

**Ne yapıldı**

- Hero'daki "Kliniklere özel yapay zekâ asistanı" etiketi kaldırıldı.
- Hero ve footer, aradaki bölümler gibi kenarlardan içeride ve dört köşesi `2.5rem` yuvarlak.
- Navbar şeffaf ve uyarlanabilir ([header-surface.tsx](<src/app/(marketing)/_components/header-surface.tsx>)): altındaki yüzeyi `elementsFromPoint` ile üç noktadan örnekler. Koyu yüzeyde şeffaf cam ve beyaz yazı, herhangi bir noktada açık yüzey varsa buzlu beyaz (%55) ve koyu yazı. Koyu bölümler ve açık bölümdeki koyu kartlar `data-header-tone="dark"`, koyu bölümdeki açık kartlar (demo formu, hero kartı) `"light"`.
- DESIGN.md §3 ve §4 güncellendi.

**Neden**

- Tamamen şeffaf ve beyaz yazılı bir navbar beyaz bölümlerde okunmaz; ilk sürümde koyu İletişim bölümündeki beyaz form kartının üzerinde bu tam olarak yaşandı. Bölüm bazlı değil yüzey bazlı ölçüm gerekiyordu.

**Doğrulama**

- Lint, lint:tokens, typecheck temiz. Tarayıcı (1280 px, 375 px): hero'da koyu, açık bölümde açık, form kartı üzerinde açık, Özellikler'de koyu; yatay taşma yok.
- Not: Tarayıcı panelinde ölçüm yaparken `requestAnimationFrame` gecikebiliyor; durumu bir kare bekledikten sonra okumak gerekiyor.

### 2026-10-04 · DESIGN.md v2 (lacivert) ve yeni tanıtım sayfası · F4.3, ADR-007

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `feat/landing-redesign` → `main` · **Commit'ler:** bu kaydı içeren commit'ler

**Ne yapıldı**

- Ürün ekibi tasarımı baştan istedi: kliniklere hitap eden, "cool" ama son derece profesyonel; **koyu mavi + beyaz** palet; en az 7–8 bölüm; **sticky header**; başlık "Kliniğinizin yeni nesil sekreteri" ve verilen açıklama metni.
- **Palet:** Token adları korunarak değerler lacivert/beyaza çevrildi; `primary`, `primary-hover`, `primary-soft`, `surface-raised`, `success` eklendi. Tüm metin kontrastları hesaplanıp AA doğrulandı (gövde 7,6:1). Grain %15 → %8.
- **DESIGN.md v2** yazıldı (yapısal kurallar korundu), [ADR-007](docs/decisions/ADR-007-navy-palette-and-landing.md), [DESIGN-SYSTEM.md](docs/04-panel/DESIGN-SYSTEM.md) yeni palete göre güncellendi.
- **Tanıtım sayfası** (`src/app/(marketing)/`): marketing `layout.tsx` (sticky header + footer), `_content.ts` (tüm metinler), `_components/` (hero, overview, product, trust, contact, demo-form, header, footer, logo, section-header). 13 bölüm + footer. Mobil menü JavaScript'siz (`<details>`).
- `ActionButton` / `ActionLink` iki varyantlı (`onDark`, `primary`), yeni `SecondaryLink`.
- **Demo talep formu gerçek:** [ortak sözleşme](src/lib/contracts/demo-request.ts) (Zod, client + server), `demo_requests` tablosu ([0003](drizzle/0003_demo_requests.sql)), [domain](src/server/domain/demo-requests.ts), [server action](<src/app/(marketing)/actions.ts>), KVKK onay kutusu, honeypot.
- **KVKK log açığı kapatıldı:** Drizzle hata mesajları sorgu parametrelerini (ad, telefon) içeriyordu ve `tool.failed`, demo formu gibi noktalarda loglanıyordu. [`safeError()`](src/lib/safe-error.ts) eklendi ve tüm hata loglarında kullanılıyor (testli).
- **İçerik doğruluğu:** Uydurma logo, yorum ve istatistik yok. "Verileriniz Avrupa'da" ifadesi "uygulama ve veritabanı Avrupa'da" olarak daraltıldı (ses işleme Retell'de).

**Olaylar**

- Lokal PGlite veritabanı **bozuldu** (uzun süre çalışan sunucu kapanmış; yeniden açılışta WASM `Aborted()`). Bozuk klasör silinmedi, `.pglite.corrupt-20261004` olarak saklandı (`.gitignore`: `/.pglite*`). Temiz DB → migrate → seed. **Retell ajan bağlantısı elle geri yazıldı** (`agent_d0b8…`, `llm_9a1e…`); `voice:sync` → `updated` (çift ajan oluşmadı). Kalıcılık gereken testlerde Docker (`pnpm db:up`) tercih edilmeli.
- WORKLOG'un "Güncel durum" bölümü bozuk bulundu: önceki bir otomatik düzenleme bölüm sonunu ararken tablo ayırıcısındaki `---`'e takılmış, eski tablonun yarısı kalmıştı. Bölüm baştan yazıldı. **Ders:** Bu dosyada bölüm sınırını `---` ile değil başlıkla (`## Kayıt biçimi`) bul; geçici dosya yazarken boş `cat >` kullanma (girdi bekler ve takılır).

**Doğrulama**

- `pnpm test`: 114/114. `lint`, `lint:tokens`, `typecheck`, `format:check`, `build` temiz.
- Tarayıcı: 1280 px, ~1000 px ve 375 px; yatay taşma yok (dekoratif ışıklar `overflow-hidden` ile kırpıldı); sticky header kaydırırken sabit; mobil menü açılıyor.
- Form: boş gönderimde 5 alan hatası (Türkçe); geçerli gönderim DB'ye yazıldı (telefon E.164'e normalize), test kaydı silindi.

**Açık kalanlar / dikkat**

- Logo ve görseller ürün ekibiyle üretilecek.
- Demo talepleri için ekibe bildirim (e-posta, ADR-006) ve görüntüleme ekranı (F6).
- Panel türetmeleri ve durum rozetleri F5 öncesi onaya sunulacak.
- Ajan hâlâ `claude-4.5-haiku` ile; gecikme karşılaştırması ekibin test aramasını bekliyor.

### 2026-10-04 · DESIGN.md tasarım sistemi ve yeni tanıtım sayfası · F4.1, F4.3

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `feat/F4-design-system` → `main` · **Commit'ler:** bu kaydı içeren commit'ler

**Ne yapıldı**

- **F1.8 hazırlığı:** Ürün ekibi numara okuma ve hitap düzeltmelerini onayladı ("gayet iyi"). Gecikme deneyi için ajan `claude-4.5-haiku`'ya geçirildi (`.env.local` → `RETELL_LLM_MODEL`, `voice:sync` → `updated`). Karşılaştırma ekibin bir sonraki test aramasını bekliyor.
- **F4.1:** [globals.css](src/app/globals.css) DESIGN.md token'larıyla yeniden yazıldı (palet, radius, blur, motion, `surface-dark` = gradyan + grain). Inter yerel paketten (`@fontsource-variable/inter`); build artık Google Fonts'a bağımlı değil (denetim raporu bulgusu kapandı). [`cn()`](src/lib/cn.ts) özel token'ları tanıyacak şekilde yapılandırıldı (yoksa `text-label` yanındaki `text-on-dark` düşüyordu; testli).
- DESIGN.md §5 bileşenleri: [`src/components/design/`](src/components/design/) (`ActionButton/Link`, `GlassCard`, `GlassStatCard`, `StatusTag`, `SectionShell`, `PageContainer`, `FadeInUp`, `Eyebrow`, `DisplayHeading`, `BodyText`).
- Canlı stil rehberi `/dev/tasarim` (production'da 404, doğrulandı).
- `pnpm lint:tokens` ([check-design-tokens.ts](scripts/check-design-tokens.ts)) CI'a eklendi; ilk çalıştırmada bir ihlal yakaladı ve düzeltildi.
- **F4.3:** Tanıtım sayfası DESIGN.md'nin dört bölümüyle yeniden kuruldu: hero (cam navigasyon, 22vw dekoratif metin, cam kartlar), açık özellik ızgarası, ızgara çizgili koyu "nasıl çalışır" bloğu ve 3° mock pencere, bento paketler. Hero görseli yerine geçici CSS zemini.
- [DESIGN-SYSTEM.md](docs/04-panel/DESIGN-SYSTEM.md): token eşlemesi, bileşenler, panel türetme önerileri, durum rozetleri önerisi, erişilebilirlik (hesaplanmış kontrastlar), yazım tonu.

**Neden**

- Durum rozetleri renk yerine biçim ve metinle ayrışıyor: DESIGN.md tek vurgu rengi tanımlıyor ve renk tek başına anlam taşımamalı.
- `body-strong` (Zinc-600) token'ı eklenmedi: kontrast kuralı ürün ekibinin onayını bekliyor.

**Doğrulama**

- `pnpm lint`, `lint:tokens`, `typecheck`, `format:check`, `test` (107/107), `build` temiz.
- Tarayıcı: 1440 px ve 375 px'te yatay taşma yok; Inter ve Türkçe karakterler doğru. Mobilde gezinme çubuğundaki satır kırılması düzeltildi.

**Açık kalanlar / dikkat**

- Ürün ekibi onayı: kontrast kuralı, panel türetmeleri ve durum rozetleri (F5 öncesi).
- Logo ve hero görseli birlikte üretilecek.
- Sıradaki: F4.2 panel bileşenleri (form, tablo, dialog, takvim…), ardından F3.
- Prettier Tailwind eklentisinin `tailwindStylesheet` ayarı olmadan özel sınıfları yanlış sıralıyor; ayar `.prettierrc.json` içinde.

### 2026-10-04 · Sayıların sesli okunması ve hitap kuralı · F1.8

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `main` · **Commit'ler:** bu kaydı içeren commit

**Ne yapıldı**

- Ürün ekibi geri bildirimi: ses iyi, isimde ton değişimi geçti; **telefon numarası geri okunurken ses değişti**. Döküm (`call_dcab36dbd90b88b5f27b66a0f8c`): numara rakamla yazılmış. Ayrıca asistan yine "Mehmet Bey" dedi; özet Türkçe ve ad içermiyor (önceki düzeltme tuttu). TTS p50 161 → 461 ms (`eleven_multilingual_v2` beklenen maliyeti).
- [speech.ts](src/server/domain/speech.ts): `numberToWords` (0–9999), `spokenTime`, `spokenDate` (kelimeyle gün), `spokenPhone` (dikte grupları). Yazılı biçim `time.ts` içinde `displayDate` olarak yeniden adlandırıldı (SMS kullanır).
- Tool sonuçlarına `spokenTime`; `spokenDate` artık kelimeyle.
- Prompt: "Sayılar ve kısaltmalar" bölümü (rakam yasağı, telefon örneği, Dt./Dr./Uzm.) ve örnekli ayrı "Hitap" bölümü.
- Ajan güncellendi (`updated`), kurallar Retell'de doğrulandı. Testler 105/105.

**Açık kalanlar / dikkat**

- Ürün ekibinin yeniden test etmesi gerekiyor: numara okuma ve "Bey" hitabı.
- Gecikme hâlâ açık konu (ADR-003); sıradaki deneme `claude-4.5-haiku`.

### 2026-10-04 · İlk web call testi ve düzeltmeler · F1.8

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `main` · **Commit'ler:** bu kaydı içeren commit

**Ne yapıldı**

- Ürün ekibi Retell panelinden ilk test aramasını yaptı: **Türkçe beğenildi, randevu oluştu** (Diş Taşı Temizliği, 5 Ekim 14:00, Dt. Can Demir, kaynak `voice`, arama sonucu `booked`, maliyet 0,39 $ / 124 sn).
- Döküm incelendi (`call_66a9fb509847226d348995b84e8`): isim doğru anlaşılmış. Bildirilen sorun ("isim başka bir sesle söylendi") TTS kaynaklı: cümle özel isimle başlayınca çok dilli ses tonu değişti.
- Düzeltmeler (ajan `voice:sync` ile yerinde güncellendi, `updated`):
  - `RETELL_VOICE_MODEL` (yeni env, opsiyonel) → ajanın `voice_model` alanı. `.env.local`'da `eleven_multilingual_v2`.
  - `post_call_analysis_data`: Türkçe ve minimal özet (ad, telefon, şikâyet ayrıntısı yok). Önceden özet İngilizce ve ad içeriyordu.
  - Prompt: isimden cinsiyet tahmin etme, "Bey/Hanım" ekleme (asistan "Mehmet Bey" demişti).
- Testler: 85/85 (yeni: voice_model, özet, hitap kuralı).

**Ölçüm**

- Uçtan uca gecikme p50 2,22 sn / p90 3,34 sn; LLM p50 1,41 sn (`claude-5-sonnet`), ASR 0,60 sn, TTS 0,16 sn. **Hedefin çok üstünde.** [ADR-003](docs/decisions/ADR-003-llm-model.md) içine işlendi.

**Açık kalanlar / dikkat**

- Ürün ekibi yeni sesle tekrar test etmeli (isimde ton değişimi kalktı mı, `eleven_multilingual_v2` gecikmeyi ne kadar artırdı).
- Gecikme için sıradaki deneme: `RETELL_LLM_MODEL=claude-4.5-haiku` → sync → aynı senaryo → `call.latency` karşılaştırması.
- Veritabanı aracında `at time zone` sonucu node tarafından yerel saat sanılıp UTC'ye çevrilir; saat 3 saat kaymış görünür. Sorgularda `to_char(...)` kullan.

### 2026-10-04 · İlk canlı Retell senkronu · F1.8

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `main` · **Commit'ler:** bu kaydı içeren commit

**Ne yapıldı**

- `.env.local` düzeltildi (ürün ekibinin onayıyla, anahtara dokunulmadan): `APP_URL` başına `https://` eklendi (eksikti, `z.url()` doğrulaması tüm komutları durduruyordu); `RETELL_VOICE_ID` ajan kimliğinden `11labs-Anna`'ya çevrildi (başlangıç önerisi, ürün ekibi değiştirebilir).
- `pnpm voice:sync --clinic gulus-dis` → **created**, `agent_d0b8d67285431ede3db2c75201` (v0), LLM `llm_9a1ea885e8b399803b5f448102b4`. Retell ilk denemede hiçbir parametreyi reddetmedi.
- Retell'den geri okuma: `tr-TR`, `11labs-Anna`, `Europe/Istanbul`, olay webhook'u tünel adresinde, 27 `boosted_keywords`, `claude-5-sonnet`, sıcaklık 0, 6 custom tool + `end_call`, varsayılan değişkenler doğru. `is_published: false` (taslak, v0).
- İkinci senkron `unchanged` (Retell'e istek gitmedi). `pnpm voice:send function-call` gerçek anahtarla imzalı → `200`, demo randevusu bulundu.

**Açık kalanlar / dikkat**

- Hızlı tünel adresi her açılışta değişir → `APP_URL` güncelle + `pnpm voice:sync --clinic gulus-dis` (spec değiştiği için `updated` olur).
- Sıradaki: Retell panelinden web call ile senaryo testleri. Yayınlanmamış (v0) taslak sürüme `override_agent_version` ile gelen gerçek telefon aramasının davranışı F2'de doğrulanacak.

### 2026-10-04 · F1.8 kurulum desteği: 4. adım (tünel) · F1.8

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `main` · **Commit'ler:** bu kaydı içeren commit

**Ne yapıldı**

- Ürün ekibi kurulumun tünel adımında takıldı. Kontrol sonucu:
  - `cloudflared` kurulu (`C:\Program Files (x86)\cloudflared\`, PATH'te) ama terminal kurulumdan önce açıldığı için komut bulunamıyordu → yeni terminal veya tam yol.
  - `.env.local` içinde `APP_URL` **boş** → tüm komutlar `Invalid environment variables` ile duruyordu.
  - `RETELL_VOICE_ID` alanına bir **ajan kimliği** (`agent_…`) yazılmıştı; ses kimliği olmalı (`11labs-…`). Ekip Retell panelinde elle bir ajan oluşturmuş; kullanılmayacak.
- `RETELL_API_KEY` doğrulandı: Retell ses listesi (300 ses) başarıyla alındı.
- [RETELL-SETUP.md](docs/02-voice-agent/RETELL-SETUP.md) sorun giderme tablosuna bu üç durum eklendi.

**Açık kalanlar / dikkat**

- Ekip `APP_URL` ve `RETELL_VOICE_ID` değerlerini düzeltince `pnpm voice:sync --clinic gulus-dis` çalıştırılacak (ilk canlı Retell çağrısı).

### 2026-10-04 · Retell geçişi ve sesli asistan çekirdeği · F1.1–F1.7

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `feat/F1-retell` → `main` · **Commit'ler:** bu kaydı içeren commit'ler

**Ne yapıldı**

- **Git düzeni:** `origin` (recallapp0/recall) doğrulandı. Önceki oturumdan kalan commit'lenmemiş `better-auth` değişikliği **silinmeden** `stash@{0}` olarak saklandı (aynı makinede başka aktif oturum olmadığı `ListAgents` ile doğrulandı). Belge commit'leri `main`'e fast-forward edilip push'landı. Tüm işi içeren `feat/panel-auth` dalı silindi.
- **Retell SDK incelemesi** (`retell-sdk` 6.0.1, `.d.ts` dosyalarından): Claude modelleri `claude-5-sonnet`, `claude-4.6-sonnet`, `claude-4.5-sonnet`, `claude-4.5-haiku` (Opus yok); `language: 'tr-TR'`; ajan sürümleri (`update` taslağı günceller, `publish` ayrı); `verify`/`sign` imza yardımcıları; `call_cost.combined_cost` cent cinsinden; yerleşik değişkenler `{{current_time_<tz>}}`, `{{current_calendar_<tz>}}`, `{{user_number}}`.
- **F1.2:** `voice_agents`, `phone_numbers` tabloları; `clinics.phone_number` veri taşıma adımıyla kaldırıldı ([0002](drizzle/0002_voice_agents_and_phone_numbers.sql)). Klinik bulma: id, slug, numara, ajan. Seed, Retell ajan bağlantısını koruyor.
- **F1.3–F1.6:** [`src/server/voice/providers/retell/`](src/server/voice/providers/retell/): `config`, `schemas`, `agent-spec`, `sync`, `handlers`, `deps`. Rotalar `/api/voice/retell/{inbound,tools,events}`. Prompt sağlayıcıdan bağımsız şablona çevrildi ([prompt.ts](src/server/voice/prompt.ts)). `completeCall` yalnızca gelen alanları yazıyor ve sonucu öncelik korumalı güncelliyor. Duraklatılmış klinikte sesli randevu sunucuda engelleniyor.
- **CLI:** `pnpm voice:sync`, `pnpm voice:voices`, `pnpm voice:send` (`tsx --conditions=react-server` ile; `server-only` modüller yüklenebilsin diye).
- **F1.7:** Vapi kodu, testleri, fixture'ları ve env değişkenleri silindi; `.env.example` ve `.env.local` Retell bölümüne geçirildi (`.env.local` gizli değer içermiyordu).
- **F1.1:** 22 belge Retell'e taşındı; yeni [RETELL-SETUP.md](docs/02-voice-agent/RETELL-SETUP.md).
- **Kararlar:** Panel yalnızca Türkçe; Netgsm en son birlikte; logo/hero F4.3'te birlikte; e-posta Resend ([ADR-006](docs/decisions/ADR-006-email-provider.md)).

**Neden**

- Ajanı elle değil koddan oluşturmak: yüzlerce klinik için tek doğru kaynak DB, Retell bir senkron hedefi. Spec hash ile gereksiz API çağrısı yok; yarım kalan senkron çift ajan üretmiyor.
- Yerleşik saat/takvim değişkenleri: Retell panelindeki testlerde inbound webhook çalışmaz; kendi tarih değişkenimiz olsaydı prompt boş tarih görürdü.
- Sürümleme: `publish` akışı canlı doğrulanmadan kullanılmadı; taslak yerinde güncelleniyor ve sürüm numarası aramalara açıkça veriliyor.
- E-posta: Resend verisi ABD'de tutuluyor ama e-postalar yalnızca çalışanlara gidiyor ve hasta verisi içermiyor; adaptör sayesinde SES/Brevo'ya geçiş ucuz.

**Doğrulama**

- `pnpm test`: **82/82** (yeni: agent-spec 6, sync 6, handlers 11). Testlerde istekler SDK'nın `sign` fonksiyonuyla imzalanıyor.
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build` temiz. Build rotaları: `/api/voice/retell/{events,inbound,tools}`.
- Canlı duman testi (`pnpm dev`, PGlite): `/api/health` → ok; anahtar yokken Retell uç noktaları → `503 VOICE_NOT_CONFIGURED`; eski `/api/voice/vapi` → 404. Migration 0002 ve seed gerçek sunucuda uygulandı.

**Açık kalanlar / dikkat**

- **Canlı Retell ile hiçbir şey denenmedi** (anahtar yok). İlk `voice:sync` sırasında Retell'in parametreleri (ör. `boosted_keywords` sınırı, model adı) reddetme ihtimali var. Hata mesajı `voice_agents.last_error` alanına ve konsola yazılır.
- Sürümleme ve `publish` davranışı F1.8'de doğrulanmalı.
- Sahte Retell istemcisi testlerde her örnekte tekil kimlik üretmeli (`external_agent_id` unique). Bir kez bu yüzden test kırıldı.
- Windows'ta `git rm` boşalan klasörü siler (`scripts/fixtures`); yeniden oluşturmak gerekti.
- Python ile Prettier tablolarını düzenlerken hizalama nedeniyle düz metin eşleşmesi tutmaz; satır başı (`startswith`) ile eşleştir.
- `outputs/claude-denetim-raporu.md`: başka bir araçla yapılmış bağımsız denetim raporu, takip edilmiyor. Bulgusu (Google Fonts build bağımlılığı) plana F4.1 olarak işlendi.

### 2026-10-04 · Fazlı uygulama planı, Retell kararı, DESIGN.md kabulü · Planlama

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `docs/implementation-plan` · **Commit'ler:** bu kaydı içeren commit

**Ne yapıldı**

- Ürün ekibinin yönergeleri kayıt altına alındı:
  - Birincil ses altyapısı **Retell AI Voice Agent API**. **Vapi kullanılmayacak.** Netgsm gibi yerel altyapılar (SIP ve SMS) test edilip karşılaştırılacak.
  - Tasarımda kök dizindeki [DESIGN.md](DESIGN.md) dosyasına kesinlikle sadık kalınacak.
  - Sistem çok sayıda kliniğe uyarlanabilir olacak: her kliniğin kendi hesabı, kendi çalışanları ve özelleştirilebilir paneli.
  - Backend ve frontend birbiriyle uyumlu geliştirilecek.
  - Tüm işler bu dosyaya kaydedilecek.
- Retell dokümantasyonu araştırıldı ve bulgular [ADR-004](docs/decisions/ADR-004-retell-voice-platform.md) içine kaynaklarıyla yazıldı: `tr-TR` desteği, inbound webhook, custom function, `X-Retell-Signature`, SIP trunk, olay webhook'ları, Claude model desteği.
- [ADR-004](docs/decisions/ADR-004-retell-voice-platform.md) (Retell, klinik başına senkronize ajan) yazıldı. ADR-002 "yerini aldı" olarak işaretlendi.
- [ADR-005](docs/decisions/ADR-005-design-system.md) (DESIGN.md tek tasarım kaynağı) yazıldı. [DESIGN-SYSTEM.md](docs/04-panel/DESIGN-SYSTEM.md) DESIGN.md'nin uzantısı olacak şekilde yönlendirildi.
- [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md): F0–F10 fazları, görev kimlikleri, dosyalar, testler, çıkış kriterleri, ortak sözleşmeler ve açık sorular.
- [ROADMAP.md](docs/00-product/ROADMAP.md) özet tablosuna indirildi ve plana bağlandı.
- [CLAUDE.md](CLAUDE.md): stack (Retell, Inter, DESIGN.md), yeni kurallar (DESIGN.md, ortak sözleşmeler, WORKLOG zorunluluğu).
- DESIGN.md `.prettierignore` dosyasına eklendi (ürün ekibinin dosyası, biçimlendirilmez).

**Neden**

- Klinik başına ayrı Retell ajanı: ses, model, prompt ve tool'lar kliniğe göre farklılaşabilir. Tek kaynak bizim DB'miz, Retell bir senkron hedefi. Arama anına özgü veriler inbound webhook'un `dynamic_variables` alanıyla verilir.
- Kiracı, Retell çağrılarında `call.agent_id` (→ `voice_agents`) ve `metadata.clinic_id` ile çapraz doğrulanır. LLM argümanları asla kiracı belirlemez.

**Doğrulama**

- Yalnızca belge değişikliği. `pnpm format:check` temiz.

**Açık kalanlar / dikkat**

- `feat/panel-auth` dalında commit'lenmemiş `better-auth` değişikliği **bulundu ve dokunulmadı**. O dal başka bir oturumun yarım işi.
- Retell'in custom function çağrılarını hangi bölgeden yaptığı bilinmiyor. Gecikme F1.8'de ölçülecek.
- Erişilebilirlik: Zinc-500 / Zinc-100 kontrastı ≈ 4,4:1 (AA eşiği 4,5:1). Ürün ekibine soruldu.
- Ürün ekibi kararları (aynı oturum): klinikleri Recall ekibi açar; giriş e-posta + parola, açık kayıt kapalı; panel özelleştirme = rol ve yetkiler + modül görünürlüğü + kişisel tercihler (logo ve renk yok); Retell hesabı hazır; GitHub reposu açıldı (adres bekleniyor). Plana "Alınan kararlar" tablosu olarak işlendi.

### 2026-10-04 · Docker'sız lokal Postgres · Altyapı

**Agent/kişi:** Claude (Opus 5.5, önceki oturum) · **Dal:** `feat/panel-auth` · **Commit'ler:** `468d94b`

**Ne yapıldı**

- `pnpm db:local`: PGlite'ı Postgres protokolüyle 5433 portunda sunan [scripts/local-db.ts](scripts/local-db.ts). Veri `.pglite/` altında (gitignore'da). Docker Desktop açılamadığı için eklendi.
- [LOCAL-DEVELOPMENT.md](docs/06-operations/LOCAL-DEVELOPMENT.md) ve [README.md](README.md) güncellendi.
- Ardından Better Auth kurulumuna başlandı (`better-auth` bağımlılığı eklendi, **commit'lenmedi**).

**Açık kalanlar / dikkat**

- F3 bu dalda devam edecek.

### 2026-10-04 · Proje temeli (F0) · F0

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `main` · **Commit'ler:** `8bf14be` … `3ee627a`

**Ne yapıldı**

- Next.js 16 iskeleti (pnpm, TypeScript strict, Tailwind 4, ESLint, Prettier, Vitest, GitHub Actions CI, `vercel.json` `fra1`).
- 38 belge: ürün (PRD, personalar, akışlar, yol haritası, fiyatlandırma), mimari, sesli asistan, telefon, panel, KVKK/güvenlik/saklama, operasyon, ADR-001..003.
- Drizzle şeması: `clinics`, `practitioners`, `services`, `practitioner_services`, `working_hours`, `time_off`, `patients`, `appointments`, `calls`, `callback_requests`. Özel migration ile `EXCLUDE USING gist` çifte rezervasyon engeli ([drizzle/0001_appointment_overlap_guard.sql](drizzle/0001_appointment_overlap_guard.sql)).
- Domain: müsaitlik motoru ([availability.ts](src/server/domain/availability.ts), saf), randevu akışları ([appointments.ts](src/server/domain/appointments.ts): atomik erteleme, idempotent oluşturma), arama kayıtları ([calls.ts](src/server/domain/calls.ts): sonuç önceliği), klinik ayarları şeması ([clinic-settings.ts](src/server/domain/clinic-settings.ts)).
- Sesli asistan: sağlayıcıdan bağımsız 6 tool ([src/server/voice/tools/](src/server/voice/tools/)), prompt üretici ([prompt.ts](src/server/voice/prompt.ts)), Vapi adaptörü (artık geçersiz, F1.7'de silinecek).
- SMS: konsol ve Netgsm adaptörü ([sms.ts](src/server/notifications/sms.ts)). Netgsm uç noktası doğrulanmadı.
- Testler: 72 (birim + [PGlite](src/test/db.ts) ile gerçek migration'lara karşı entegrasyon).
- Canlı doğrulama: `/api/health` ok, webhook 18–53 ms, tool 6 ms.

**Neden**

- Gerçek zamanlı ses Vercel Functions'ta çalışmadığı için ses yönetilen bir platformda, iş mantığı bizde ([ARCHITECTURE.md](docs/01-architecture/ARCHITECTURE.md)).
- Çifte rezervasyon DB seviyesinde engellendi; eşzamanlı aramalarda uygulama kontrolü yetmez.

**Açık kalanlar / dikkat**

- Windows'ta Python ile dosya yazarken `newline="\n"` kullan. Aksi hâlde CRLF oluşur ve Prettier kontrolü bozulur.
- `next build` sonrası `.next/types` eski rotalara referans verirse `rm -rf .next && pnpm exec next typegen`.
