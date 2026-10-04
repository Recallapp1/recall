# WORKLOG: Recall Çalışma Günlüğü

> **Agent'lar ve geliştiriciler için:** Bu dosya projede yapılan her işin kronolojik kaydıdır.
> İşe başlamadan önce **"Güncel durum"** bölümünü ve [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) belgesini oku.
> İşini bitirdiğinde **en üste** yeni bir kayıt ekle ve "Güncel durum" bölümünü güncelle. Kayıt eklemeden oturum bitmiş sayılmaz.

---

## Güncel durum

_Son güncelleme: 2026-10-04 (F1 oturumu)_

| Konu                    | Durum                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aktif faz               | **F1.8**: demo kliniğin Retell ajanı canlı oluşturuldu ve doğrulandı (`agent_d0b8…`). Sıradaki: Retell panelinden web call senaryo testleri, model/ses/ASR karşılaştırması |
| Sıradaki faz            | **F4** (DESIGN.md tasarım sistemi), ardından F3 (hesaplar)                                                                                                                 |
| Ses sağlayıcısı         | **Retell AI**, klinik başına senkronize ajan ([ADR-004](docs/decisions/ADR-004-retell-voice-platform.md)). Vapi kodu tamamen silindi                                       |
| Tasarım                 | **[DESIGN.md](DESIGN.md) tek kaynak** ([ADR-005](docs/decisions/ADR-005-design-system.md)). Kodda hâlâ eski teal + Geist teması var, F4.1'de taşınacak                     |
| E-posta                 | Resend, adaptör arkasında ([ADR-006](docs/decisions/ADR-006-email-provider.md)); F3'te kurulacak                                                                           |
| Testler                 | **82 test** geçiyor (birim + PGlite entegrasyon). Lint, typecheck, format, `next build` temiz                                                                              |
| Lokal DB                | `pnpm db:local` (PGlite, Docker gerekmez) veya `pnpm db:up` (Docker)                                                                                                       |
| GitHub                  | `origin` = https://github.com/recallapp0/recall (`main` push'lu)                                                                                                           |
| Deploy                  | Yok. Vercel takımı `RECALL` (`recall25`) hazır, proje yok. Neon bekleniyor (F8)                                                                                            |
| Bekleyen ürün kararları | [IMPLEMENTATION-PLAN.md → Açık sorular](docs/IMPLEMENTATION-PLAN.md#açık-sorular-ürün-ekibine): kontrast kuralı, kayıt dinleme rolleri                                     |
| Alınan ürün kararları   | [IMPLEMENTATION-PLAN.md → Alınan kararlar](docs/IMPLEMENTATION-PLAN.md#alınan-kararlar)                                                                                    |

### Dallar ve saklanan işler

| Ad          | İçerik                                                                                                                                   | Durum                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `main`      | F0 + plan + F1                                                                                                                           | Kararlı, `origin/main` ile aynı                                    |
| `stash@{0}` | "WIP F3 (orphaned session): add better-auth dependency": önceki bir oturumun commit'lenmemiş `package.json`/`pnpm-lock.yaml` değişikliği | F3'e başlarken incelenip uygulanacak veya silinecek (plan F3 notu) |

### Sıradaki işler

1. Ürün ekibi: `.env.local` → `RETELL_API_KEY`, `RETELL_VOICE_ID` ([RETELL-SETUP.md](docs/02-voice-agent/RETELL-SETUP.md) adım 2 ve 4)
2. F1.8: ilk `pnpm voice:sync --clinic gulus-dis`, web call testleri, model/ses/ASR karşılaştırması, ajan sürümleme davranışının canlı doğrulanması
3. F4.1: DESIGN.md token'ları, Inter (`next/font/local`, ağdan bağımsız build)
4. F3: Better Auth (stash'teki yarım işi değerlendir)

----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aktif faz | **F1.8**: demo kliniğin Retell ajanı canlı oluşturuldu ve doğrulandı (`agent_d0b8…`). Sıradaki: Retell panelinden web call senaryo testleri, model/ses/ASR karşılaştırması |
| Ses sağlayıcısı | **Retell AI** ([ADR-004](docs/decisions/ADR-004-retell-voice-platform.md)). Kodda hâlâ Vapi adaptörü var, F1.7'de kaldırılacak |
| Tasarım | **[DESIGN.md](DESIGN.md) tek kaynak** ([ADR-005](docs/decisions/ADR-005-design-system.md)). Kodda hâlâ eski teal + Geist teması var, F4.1'de taşınacak |
| Testler | 72 test geçiyor (birim + PGlite entegrasyon) |
| Lokal DB | `pnpm db:local` (PGlite, Docker gerekmez) veya `pnpm db:up` (Docker) |
| Deploy | Yok. Vercel takımı `RECALL` (`recall25`) hazır, proje yok. GitHub reposu ve Neon bekleniyor (F8) |
| Bekleyen ürün kararları | [IMPLEMENTATION-PLAN.md → Açık sorular](docs/IMPLEMENTATION-PLAN.md#açık-sorular-ürün-ekibine) |
| Alınan ürün kararları | [IMPLEMENTATION-PLAN.md → Alınan kararlar](docs/IMPLEMENTATION-PLAN.md#alınan-kararlar): Recall ekibi klinik açar; e-posta + parola; özelleştirme = roller, modül görünürlüğü, kişisel tercihler (logo yok); Retell hesabı hazır |

### Dallar

| Dal                        | İçerik                                                                                                                          | Durum                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `main`                     | F0 temeli (`3ee627a`'ya kadar)                                                                                                  | Kararlı                                                        |
| `feat/panel-auth`          | `468d94b` Docker'sız lokal Postgres (PGlite). **Commit'lenmemiş:** `better-auth` bağımlılığı (`package.json`, `pnpm-lock.yaml`) | F3 için yarım iş. Sahibi devam edecek; başka agent dokunmamalı |
| `docs/implementation-plan` | Fazlı plan, WORKLOG, ADR-004/005, DESIGN.md                                                                                     | Bu oturum. `feat/panel-auth` üzerinden açıldı                  |

### Sıradaki işler

1. Ürün ekibinden: `RETELL_API_KEY` değerinin `.env.local` dosyasına girilmesi ve GitHub repo adresi
2. F1.1–F1.4: Retell belgeleri, veri modeli, imza doğrulama, ajan spec'i
3. F4.1: DESIGN.md token'ları ve Inter fontu
4. F3: `feat/panel-auth` dalında Better Auth kurulumu

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
