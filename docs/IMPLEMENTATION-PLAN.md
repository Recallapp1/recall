# Uygulama Planı

> Bu belge Recall'un bundan sonraki tüm geliştirme işini fazlara ve görevlere böler.
> **Her agent ve geliştirici işe başlamadan önce bu belgeyi ve [WORKLOG.md](../WORKLOG.md) dosyasını okur.**
> Görev kimlikleri (ör. `F1.4`) commit mesajlarında, dal adlarında ve WORKLOG kayıtlarında kullanılır.

Son güncelleme: 2026-10-08 · Sahip: Ürün + Mühendislik. **Güncel durumun tek kaynağı:** [WORKLOG.md → Güncel durum](../WORKLOG.md#güncel-durum); aşağıdaki faz tablosu tarihli bir özettir.

---

## 0. Değişmez ilkeler

Bu ilkeler her fazda geçerlidir. Bir görev bunlardan birini ihlal ediyorsa görev yanlış tanımlanmıştır.

| #   | İlke                                                                                                                                                      | Nasıl uygulanır                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Çok kiracılı (multi-tenant):** Tek kod tabanı, sınırsız klinik. Her klinik kendi verisi, kendi asistanı, kendi ekibi ve kendi panel ayarlarıyla çalışır | Her tablo `clinic_id` taşır. Her sorgu `clinicId` ile filtrelenir. Kiracı **sunucuda** belirlenir (oturum, aranan numara, ajan kimliği), asla istemciden veya LLM'den gelmez. Bkz. [MULTI-TENANCY.md](01-architecture/MULTI-TENANCY.md) |
| 2   | **Klinik başına özelleştirme veriyle yapılır, kodla değil**                                                                                               | Klinikler arası farklar `clinics.settings`, ilişkisel tablolar ve rol/izin kayıtlarındadır. Kodda `if (clinic.slug === …)` yasaktır                                                                                                     |
| 3   | **Ses sağlayıcısı: Retell AI** ([ADR-004](decisions/ADR-004-retell-voice-platform.md)). Vapi kullanılmaz                                                  | Sağlayıcıya özgü kod yalnızca `src/server/voice/providers/retell/` altındadır. Domain, tool'lar ve prompt sağlayıcıdan bağımsızdır                                                                                                      |
| 4   | **Tasarım: [DESIGN.md](../DESIGN.md) tek kaynaktır** ([ADR-005](decisions/ADR-005-design-system.md))                                                      | Renk, font, radius, blur, motion yalnızca `globals.css` token'larından gelir. Panel türetmeleri [DESIGN-SYSTEM.md](04-panel/DESIGN-SYSTEM.md) içinde, DESIGN.md'yi bozmadan tanımlanır                                                  |
| 5   | **Backend ve frontend tek sözleşme kullanır**                                                                                                             | Form ve API girdileri için Zod şemaları `src/lib/contracts/` altında tanımlanır (client'ta da çalışır). Server Action'lar aynı şemayla doğrular. UI tipleri bu şemalardan türetilir (`z.infer`), elle tekrar yazılmaz                   |
| 6   | **KVKK:** Sağlık verisi                                                                                                                                   | Loglarda kişisel veri yok, AB bölgesi, veri saklama süreleri, anonimleştirme. Bkz. [KVKK.md](05-compliance/KVKK.md)                                                                                                                     |
| 7   | **Test edilmemiş iş bitmiş değildir**                                                                                                                     | Domain: birim testi. DB'ye dokunan kod: PGlite entegrasyon testi. UI akışları: Playwright (Faz 5+). `pnpm lint && pnpm typecheck && pnpm test` temiz                                                                                    |
| 8   | **Her iş kayıt altındadır**                                                                                                                               | Her çalışma oturumu [WORKLOG.md](../WORKLOG.md) dosyasına bir kayıt ekler. Mimari kararlar ADR olarak yazılır                                                                                                                           |

### Çalışma akışı (her görev için)

1. WORKLOG.md'nin "Güncel durum" bölümünü ve bu planda ilgili görevi oku.
2. Dal aç: `feat/F1.4-retell-tools`, `fix/…`, `docs/…`, `chore/…`.
3. Uygula. Önce domain ve testler, sonra adaptör ve endpoint, en son UI.
4. `pnpm lint && pnpm typecheck && pnpm test` (UI varsa `pnpm build`).
5. Conventional Commit: `feat(voice): add retell inbound webhook (F1.5)`.
6. Bu plandaki görev kutusunu işaretle, WORKLOG.md'ye kayıt ekle, gerekiyorsa belgeleri güncelle.
7. `main`'e birleştir (GitHub kurulunca PR ile).

---

## Faz durum özeti (2026-10-08)

| Faz | Başlık                                                      | Durum                                                                                                                                                     | Bağımlılık |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| F0  | Temel (belgeler, iskelet, domain, testler)                  | ✅ Tamamlandı                                                                                                                                             | —          |
| F1  | Retell geçişi ve sesli asistan çekirdeği                    | 🟡 F1.1–F1.7 ✅ · F1.8: 24 senaryoluk ses değerlendirmesi depoda (`pnpm voice:eval`), gecikme ölçüldü ([VOICE-EVAL.md](02-voice-agent/VOICE-EVAL.md))     | F0         |
| F2  | Telefon (SIP) ve SMS: Netgsm ve alternatiflerin testi       | ⏳                                                                                                                                                        | F1         |
| F3  | Hesaplar, kimlik doğrulama, roller, klinik yönetimi         | ✅ (testler: rol × eylem, kiracı izolasyonu, davet)                                                                                                       | F0         |
| F4  | Tasarım sistemi (DESIGN.md) uygulaması                      | 🟡 F4.1 ✅ · F4.2 ✅ (onay bekliyor) · F4.3 ✅ (logo/görseller bekleniyor)                                                                                | F0         |
| F5  | Klinik paneli                                               | ✅ ekranlar, sıralama, action testleri, E2E · açık: logo/görsel, 375/1440 görsel kontrol                                                                  | F3, F4     |
| F6  | Recall yönetim konsolu (platform admin)                     | 🟡 Konsol ✅ (ADR-010); numara içe aktarma F2 ile                                                                                                         | F3, F1     |
| F7  | KVKK, güvenlik, veri saklama                                | 🟡 saklama, anonimleştirme, dışa aktarma, hız sınırı, CSP, denetim, güvenlik incelemesi ✅ · açık: yasal metinler, avukat, alan şifreleme değerlendirmesi | F5         |
| F8  | Production: Vercel, Neon, izleme                            | 🟡 canlı, CI yeşil, iş kalp atışı · açık: Sentry/uptime hesapları, `main` koruması, Pro/ücretli Neon                                                      | F1, F3     |
| F9  | Pilot (3 klinik) ve eval                                    | ⏳                                                                                                                                                        | F1–F8      |
| F10 | V1 ve sonrası (faturalandırma, self-servis, entegrasyonlar) | ⏳                                                                                                                                                        | F9         |

**Önerilen sıra (2026-10-04 güncel):** F1 → F4 (tasarım temeli) → F3 (hesaplar) → F5 ve F6 (panel, konsol) → F7 → F8 (production) → **F2 (Netgsm: ürün ekibiyle birlikte, en son)** → F9. F1.8 ürün ekibinin Retell anahtarını girmesiyle paralel yürür.

---

## F0: Temel ✅

Tamamlananlar ([WORKLOG.md](../WORKLOG.md) içinde ayrıntılı):

- [x] 38 belge (ürün, mimari, ses, telefon, panel, uyum, operasyon, ADR'ler)
- [x] Next.js 16, TypeScript strict, Tailwind 4, pnpm, ESLint, Prettier, Vitest, CI
- [x] Drizzle şeması (10 tablo), migration'lar, `EXCLUDE USING gist` ile çifte rezervasyon engeli, seed
- [x] Müsaitlik motoru (saf fonksiyon) ve testleri
- [x] Randevu oluşturma, bulma, iptal ve erteleme domain'i (atomik, idempotent, kiracı izolasyonlu)
- [x] Sağlayıcıdan bağımsız 6 tool ve system prompt üretici
- [x] Vapi adaptörü (F1.7'de kaldırıldı)
- [x] PGlite ile Docker'sız entegrasyon testleri (72 test) ve lokal DB (`pnpm db:local`)

---

## F1: Retell geçişi ve sesli asistan çekirdeği

**Hedef:** Bir klinik için Retell üzerinde, veritabanından üretilen ajanın Türkçe konuşarak gerçek takvimden randevu alması. Önce Retell web call (tarayıcı), sonra test numarası.

**Ön koşullar (ürün ekibinden):** Retell hesabı ve webhook yetkili API anahtarı (`RETELL_API_KEY`).

> **Durum (2026-10-04):** F1.1–F1.7 tamamlandı (`feat/F1-retell`). F1.8 ürün ekibinin Retell anahtarını girmesini bekliyor: [RETELL-SETUP.md](02-voice-agent/RETELL-SETUP.md). Uygulamada plandan sapılan yerler aşağıda "Not" olarak işaretli.

### F1.1 Belgeleri Retell'e taşı ✅

- [x] ARCHITECTURE, API, AGENT-DESIGN, TOOLS, SYSTEM-PROMPT, TELEPHONY, CALL-ROUTING, TECH-STACK, COST-MODEL, MONITORING, LOCAL-DEVELOPMENT, DEPLOYMENT, KVKK, SECURITY, DATA-MODEL, DATA-RETENTION, MULTI-TENANCY, TESTING, VOICE-AND-LANGUAGE, ONBOARDING, USER-FLOWS, USER-PERSONAS
- [x] [ADR-003](decisions/ADR-003-llm-model.md): adaylar Retell'in Claude listesi (`claude-5-sonnet`, `claude-4.6-sonnet`, `claude-4.5-sonnet`, `claude-4.5-haiku`)
- [x] Yeni: [RETELL-SETUP.md](02-voice-agent/RETELL-SETUP.md) (ürün ekibi için adım adım kurulum)
- [x] **Kabul:** `grep -ri vapi docs/` yalnızca ADR-002/004, karar tabloları, bu plan ve TECH-STACK'teki "elendi" notunda sonuç veriyor

### F1.2 Veri modeli: ses ajanları ve numaralar ✅

- [x] `voice_agents`: `clinic_id (unique), provider, external_agent_id (unique), external_llm_id, agent_version, spec_hash, status, last_error, synced_at`
- [x] `phone_numbers`: `clinic_id, e164 (unique), provider, carrier, is_active`. Not: `external_id`, `purpose`, `status` alanları gerçek ihtiyaç doğana kadar eklenmedi (F2)
- [x] `clinics.phone_number` → `phone_numbers` ([0002 migration](../drizzle/0002_voice_agents_and_phone_numbers.sql) içinde elle yazılmış veri taşıma adımıyla). Not: Production verisi olmadığı için tek adımda yapıldı
- [x] Not: `calls` tablosuna yeni kolon eklenmedi. `disconnection_reason` mevcut `ended_reason` kolonuna yazılıyor, ajan kimliği `voice_agents` üzerinden bulunuyor
- [x] Domain: `findClinicById`, `findClinicBySlug`, `findClinicByPhoneNumber`, `findClinicByAgentId`
- [x] Seed, demo kliniğin Retell ajan bağlantısını yeniden yüklemede korur (aksi hâlde sonraki senkron ikinci bir ajan açardı)

### F1.3 Retell istemcisi ve imza doğrulama ✅

- [x] `retell-sdk` 6.0.1
- [x] Env: `RETELL_API_KEY`, `RETELL_VOICE_ID`, `RETELL_LLM_MODEL` (varsayılan `claude-5-sonnet`). Not: İmza toleransı SDK'nın sabit 5 dakikası; ayrı env eklenmedi. Anahtar opsiyonel tutuldu (panel sessiz çalışabilsin); yoksa ses uç noktaları `503 VOICE_NOT_CONFIGURED` döner
- [x] İmza doğrulama: kendi uygulamamızı yazmak yerine SDK'nın `verify` fonksiyonu kullanıldı. Testler SDK'nın `sign` fonksiyonuyla imzalanmış gerçek isteklerle çalışıyor (yanlış anahtar, değiştirilmiş gövde, imzasız)
- [x] Gövde ham metin olarak okunup doğrulandıktan sonra parse ediliyor
- **Dosyalar:** [config.ts](../src/server/voice/providers/retell/config.ts), [schemas.ts](../src/server/voice/providers/retell/schemas.ts), [deps.ts](../src/server/voice/providers/retell/deps.ts)

### F1.4 Ajan tanımı üretimi ✅

- [x] [agent-spec.ts](../src/server/voice/providers/retell/agent-spec.ts): LLM (`general_prompt`, `begin_message`, `model`, sıcaklık 0, 6 custom tool + `end_call` + koşullu `transfer_call`, `default_dynamic_variables`) ve Agent (`tr-TR`, ses, saat dilimi, `boosted_keywords`, olay webhook'u, sessizlik ve süre sınırı)
- [x] Not: Tarih, saat, takvim ve arayan numara için kendi değişkenlerimiz yerine Retell'in **yerleşik** değişkenleri kullanıldı (`{{current_time_<tz>}}`, `{{current_calendar_<tz>}}`, `{{user_number}}`). Böylece Retell panelindeki testler de doğru tarihi bilir. Bizim değişkenlerimiz: `transfer_available`, `clinic_status`, `caller_number` (2026-10-05: `{{user_number}}` web aramalarında dolmadığı için yerine geçti)
- [x] [prompt.ts](../src/server/voice/prompt.ts) sağlayıcıdan bağımsız şablon + `buildCallVariables`
- [x] Duraklatılmış klinikte `book_appointment` ve `reschedule_appointment` sunucuda `CLINIC_PAUSED` döner (prompt kuralına ek savunma)
- [x] Kayıt tercihi: `recordCalls=false` ise kayıt URL'i saklanmıyor. Retell tarafı saklama ayarı F7'ye bırakıldı

### F1.5 Webhook uç noktaları ✅

- [x] `inbound`, `tools`, `events` ([handlers.ts](../src/server/voice/providers/retell/handlers.ts)); route dosyaları tek satır (`withRetell(handler)`)
- [x] Kiracı: inbound'da numara, tools/events'te `agent_id`; `metadata.clinic_id` çapraz kontrolü
- [x] İdempotency: `call_id` upsert; `completeCall` yalnızca gelen alanları yazar, sonuç öncelik korumalı (`markCallOutcome`)
- [x] Entegrasyon testleri: [handlers.integration.test.ts](../src/server/voice/providers/retell/handlers.integration.test.ts)

### F1.6 Ajan senkronizasyonu ✅ (otomatik tetikleme F5'te)

- [x] [sync.ts](../src/server/voice/providers/retell/sync.ts): hash ile atlama, `--force`, yarım ilerlemeyi saklama (LLM oluştu, ajan oluşmadı → bir sonraki deneme LLM'i yeniden kullanır), herkese açık olmayan `APP_URL`'i reddetme
- [x] CLI: `pnpm voice:sync --clinic <slug> | --all [--force]`, `pnpm voice:voices`
- [x] Not (sürümleme): Ajanın taslak sürümü yerinde güncelleniyor ve sürüm numarası `agent_version` olarak kaydedilip inbound webhook'ta `override_agent_version` ile açıkça gönderiliyor. Retell'in `publish` akışı canlı API'de doğrulanmadan kullanılmadı → **F1.8'de doğrulanacak**
- [ ] Hız sınırına karşı yeniden deneme: SDK'nın varsayılan yeniden denemesine bırakıldı; toplu senkron (`--all`) büyüdüğünde F6'da ele alınacak
- [x] Panelden otomatik tetikleme (F5.3) — Ayar kaydında `after()` ile; ayrıca production build'i mevcut ajanları senkronlar (2026-10-07)

### F1.7 Vapi kodunun kaldırılması ✅

- [x] Vapi adaptörü, rotası, testleri, fixture'ları ve `VAPI_*`/`VOICE_*` env değişkenleri silindi
- [x] Retell fixture'ları (`scripts/fixtures/retell-*.json`) ve imzalı istek gönderen `pnpm voice:send` ([retell-send.ts](../scripts/retell-send.ts))

### F1.8 Uçtan uca POC

- [x] Tünel (cloudflared) ile lokal → Retell'de demo klinik ajanı senkronize edildi (2026-10-04; ilk denemede başarılı, idempotent, imzalı tool çağrısı canlı doğrulandı)
- [x] ~~Retell **web call** ile 20 senaryodan en az 10'u elle denenir~~ — 2026-10-09: yerine otomatik 26 senaryoluk ses değerlendirmesi (`pnpm voice:eval`, [VOICE-EVAL.md](02-voice-agent/VOICE-EVAL.md)); ilk koşu 12/24
- [ ] Model karşılaştırması — 2026-10-09: profillerle (`baseline`, `option-a`, `option-hardening`, `option-c-gemini`, `option-c-gpt`) aynı senaryolar; kredi yüklenince kademeli plan ([VOICE-EVAL.md](02-voice-agent/VOICE-EVAL.md)), sonuç [ADR-003](decisions/ADR-003-llm-model.md)'e
- [ ] ~~ASR ve TTS karşılaştırması (Deepgram, Azure, Soniox × ElevenLabs, Cartesia)~~ — 2026-10-09: Retell'in sunduklarıyla sınırlı; ADR-003 seçenek D (standart sesler) olarak ele alınır, ayrı iş değil
- [ ] Custom function gecikmesi (Retell → Vercel `fra1`) ölçülür

**F1 çıkış kriterleri:** Webhook'lar imzalı ve testli; demo kliniğin ajanı tek komutla senkronize ediliyor; web call ile randevu panelsiz olarak DB'ye düşüyor; 20 senaryodan ≥ 18'i başarılı; tool yanıtı p95 < 300 ms.

---

## F2: Telefon (SIP) ve SMS: Netgsm ve alternatiflerin testi

**Hedef:** Gerçek bir Türk numarasının Retell'e bağlanması ve randevu SMS'lerinin gönderilmesi. Birden fazla sağlayıcının ölçülerek karşılaştırılması.

### F2.1 Sağlayıcı değerlendirme çerçevesi

- [ ] `docs/03-telephony/PROVIDER-EVALUATION.md`: aynı test protokolü ile Netgsm, Verimor ve en az bir alternatif. Ölçütler: SIP uyumu (origination `sip:sip.retellai.com`, termination, TCP/TLS), caller ID iletimi, ses kalitesi (MOS gözlemi), kurulum süresi, dakika maliyeti, numara tipleri (0850, coğrafi), numara taşıma, destek, BTK uyumu

### F2.2 SIP trunk → Retell (Netgsm öncelikli)

- [ ] Netgsm'de SIP trunk; origination → `sip:sip.retellai.com` (TCP, mümkünse TLS)
- [ ] Retell IP aralıklarının operatör tarafında izin listesine alınması
- [ ] Retell **Import Phone Number**: termination URI, kimlik bilgileri, `inbound_webhook_url = /api/voice/retell/inbound`
- [ ] `phone_numbers` kaydı ve numara–klinik eşlemesi — 2026-10-09: konsolda hazır (Klinik → Numara ekle, `addPhoneNumberAction`); ayrı CLI gerekmez. Kalan: SIP hattı ve Retell'e numara aktarımı
- [ ] Testler: gelen arama, caller ID, gizli numara, transfer (SIP REFER) ve ses kalitesi
- [ ] Yönlendirme senaryoları ([CALL-ROUTING.md](03-telephony/CALL-ROUTING.md)): her zaman, meşgul/cevapsız, mesai dışı; devir döngüsü kontrolü

### F2.3 SMS: Netgsm

- [ ] Netgsm SMS API'sinin güncel dokümana göre doğrulanması (mevcut adaptör varsayıma dayanıyor)
- [x] `notifications` tablosu: `id, clinic_id, appointment_id, type, channel, to (maskeli değil, şifreleme F7), status, provider_message_id, error, sent_at`. Tekil kısıt `(appointment_id, type)` ile idempotency — Bildirim kaydı olarak yapıldı (0008, 0011): tüm SMS'ler buradan geçer, tekillik `dedupe_key` ile (2026-10-07)
- [ ] Türkçe karakter ve uzunluk ölçümü; şablonlar [NOTIFICATIONS.md](03-telephony/NOTIFICATIONS.md) ile uyumlu
- [ ] Klinik başına gönderici başlığı (varsayılan: Recall başlığı)
- [x] Hatırlatma cron'u: `GET /api/cron/reminders` (saatlik, `CRON_SECRET`), idempotent — Günlük `/api/cron/notifications` (Hobby); devam ettirilebilir iş kaydı ve kalp atışı (2026-10-07). Saatlik iş Vercel Pro ile **[PLAN: Hobby]**
- [ ] İYS ve ticari ileti ayrımı için hukuki teyit (ürün ekibi)

**F2 çıkış kriterleri:** En az bir Türk numarası Retell'e bağlı ve 20 test aramasında sorunsuz; SMS onay ve hatırlatma gönderiliyor; değerlendirme belgesi en az iki sağlayıcıyla dolu.

---

## F3: Hesaplar, kimlik doğrulama, roller ve klinik yönetimi

**Hedef:** Her kliniğin kendi hesabı, kendi ekip üyeleri ve rolleri; Recall ekibinin klinik oluşturup yönetebilmesi. Paneli besleyecek güvenli kiracı bağlamı.

> Önceki bir oturumun yarım işi (`better-auth` bağımlılığı) `stash@{0}: WIP F3 (orphaned session)` olarak saklandı. F3'e başlarken `git stash show -p stash@{0}` ile incelenip ya uygulanır ya da `pnpm add better-auth` ile temiz kurulur, ardından stash silinir.

### F3.1 Better Auth kurulumu

> Kararlar: [ADR-009](decisions/ADR-009-accounts-and-roles.md). `stash@{0}` yerine temiz kurulum yapıldı (better-auth 1.7.7); stash'i ürün ekibi silecek.

- [x] Better Auth + Drizzle adaptörü; tablolar (çoğul, UUID): `users`, `sessions`, `accounts`, `verifications`, `organizations`, `members`, `invitations`, `organization_roles` (migration `0004_accounts`)
- [x] Giriş yöntemi: **e-posta + parola**, en az 10 karakter. Parola sıfırlama / ilk parola belirleme e-postası (aynı akış, 24 saat). E-posta bağlantısıyla açılan hesap doğrulanmış sayılır. Sihirli bağlantı ve 2FA kapsam dışı
- [x] Herkese açık kayıt **kapalı** (sunucu çağrısı dahil). Hesaplar: `pnpm clinic:member` (Recall ekibi) veya davet
- [x] `organization` ↔ `clinics` 1:1: `clinics.organization_id` (unique). `ensureClinicOrganization()` ilk kullanımda oluşturur; F6'da klinik oluşturma ikisini tek transaction'da yaratacak
- [x] Env: `BETTER_AUTH_SECRET` (prod'da zorunlu), `BETTER_AUTH_URL`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`. Şablonlar Türkçe; React Email yerine satır içi stilli HTML (`src/server/notifications/email-templates.ts`), bağımlılık eklememek için
- [x] Route handler: `src/app/api/auth/[...all]/route.ts`
- [x] Ekranlar: `/giris`, `/sifremi-unuttum`, `/sifre-belirle`, `/davet/[id]` (yeni hesap veya mevcut hesapla kabul)

### F3.2 Roller ve izinler (klinik içi)

- [x] Varsayılan roller: `owner` (Klinik sahibi), `admin` (Yönetici), `staff` (Sekreter), `practitioner` (Hekim)
- [x] İzin matrisi `src/lib/permissions.ts`: `appointments [read, create, update, cancel]`, `patients [read, update, anonymize]`, `calls [read, listen_recording]`, `callbacks [read, update]`, `clinicSettings`, `assistantSettings [read, update]`, `billing [read, manage]`, `audit [read]` + Better Auth'un `organization/member/invitation/ac` kaynakları. Testli (rol × eylem)
- [x] **Klinik başına özel roller:** altyapı hazır (dinamik erişim kontrolü, `organization_roles`, en fazla 20 rol). Arayüz F5.3 "Ekip ve roller"de
- [x] `members.practitioner_id`: hekim rolünü bir `practitioners` kaydına bağlar (takvim kapsamı F5'te uygulanır)
- [x] Sunucu yardımcıları: `requireSession()`, `requireClinic()`, `can()`, `requirePermission()` (yetkisizse `forbidden()` → 403 sayfası)
- [x] `src/proxy.ts`: `/panel/**` için çerez yoksa `/giris?sonra=…` (`safeNextPath` ile açık yönlendirme engelli). `/admin/**` F6'da eklenecek

### F3.3 Davet ve ekip yönetimi

- [x] Owner veya admin e-posta ile davet gönderir, rol seçer (`/panel/ayarlar/ekip`; yalnızca owner owner atar)
- [x] Davet kabul ekranı (`/davet/[id]`); süresi dolan davetler listelenmez, bekleyen davet iptal edilebilir
- [x] Üye çıkarma ve rol değiştirme; hekim rolü bir hekime bağlanır. Son owner çıkarılamaz / rolü düşürülemez
- [x] Bir kullanıcı birden fazla kliniğe üye olabilir; panelde klinik değiştirici
- [x] Klinik başına özel rol oluşturma arayüzü (Ayarlar → Ekip → Özel roller): yalnızca klinik verisi yetkileri (randevu, hasta, arama, geri arama, ayarlar, denetim); ekip, faturalandırma ve organizasyon yetkileri hazır rollerde kalır. Kişi kendinde olmayan yetkiyi role veremez (Better Auth). Rol adı oluşturulduktan sonra değişmez; kullanımdaki rol silinemez. Özel roller sekreter atayabilenlerce (sahip, yönetici) atanır

### F3.4 Denetim kaydı (audit log)

- [x] `audit_events`: `id, clinic_id, actor_user_id, action, target_type, target_id, metadata (kişisel veri yok), created_at` (migration `0005`); `recordAudit()` hata fırlatmaz, transaction içinde savepoint kullanır
- [x] Kaydedilenler (şimdilik): giriş, Recall ekibinin üye eklemesi, davet kabulü. Rol değişikliği, davet, ayar, anonimleştirme, kayıt dinleme ilgili Server Action'larla birlikte (eylem adları `src/server/domain/audit.ts`)

### F3.5 Panel kişiselleştirme altyapısı

- [x] `clinics.settings.panel` (klinik geneli): görünür modüller (Aramalar, Geri aranacaklar, Hastalar kapatılabilir), varsayılan takvim görünümü (gün/hafta). Takvim saat aralığı çalışma saatlerinden otomatik hesaplanır
- [x] `member_preferences` (kişi bazında): girişte açılan sayfa, takvim görünümü, takvimde varsayılan hekim (`/panel/tercihler`). [ ] Yoğunluk, bildirim tercihleri
- [x] Şemalar `src/lib/contracts/settings.ts` içinde (client ve server ortak)
- [ ] Kapsam (karar 2026-10-04): **rol ve yetkiler** (F3.2), **modül görünürlüğü** ve **kişisel tercihler**. Klinik logosu ve klinik bazında renk/font özelleştirmesi **kapsam dışı**; görünüm tamamen DESIGN.md'ye bağlıdır

### F3.6 Testler

- [x] Yetki matrisi testleri: her rol × her eylem — `permissions.test.ts` + tüm action dosyaları rol × eylem (`server-actions.integration.test.ts`, 2026-10-08)
- [x] Kiracı izolasyonu: A kliniğinin üyesi B kliniğinin verisine hiçbir Server Action ile erişemez — Action testleri (B'nin satırları bayt bayt aynı kalır) ve bileşik FK'ler (0013), 2026-10-08
- [x] Davet akışı entegrasyon testi — `accounts.test.ts`

**F3 çıkış kriterleri:** Klinik oluşturma, owner daveti, üye ekleme ve rol atama çalışıyor; tüm panel rotaları korumalı; yetki matrisi testli.

---

## F4: Tasarım sistemi (DESIGN.md) uygulaması

**Hedef:** DESIGN.md'nin kod karşılığının (token'lar, bileşenler, motion) kurulması; panel için türetmelerin belgelenmesi.

### F4.1 Token'lar ve temel

- [x] Font: **Montserrat** (2026-10-04, ürün ekibi kararı; önce Inter), `@fontsource-variable/montserrat` paketinden yerel (`latin-ext` dahil). Geist kaldırıldı. Build artık ağa bağımlı değil (doğrulandı). Not: `next/font/local` yerine paketin kendi `@font-face` CSS'i kullanıldı; dosya kopyalamaya gerek kalmadı
- [x] `globals.css` `@theme`: DESIGN.md paleti, radius, blur, motion, sayfa genişliği. Eşleme tablosu: [DESIGN-SYSTEM.md §1](04-panel/DESIGN-SYSTEM.md#1-tokenlar)
- [x] Yardımcılar: `glass`, `glass-nav`, `grain`, `bg-dark-gradient`, `surface-dark` (gradyan + grain + beyaz metin), `text-display`, `text-label`, `animate-fade-in-up`, `animate-status-bounce`, `prefers-reduced-motion`
- [x] Tipografi ölçeği (`DisplayHeading`, `BodyText`, `Eyebrow`)
- [x] **Erişilebilirlik:** DESIGN.md v2 paleti ölçülerek seçildi; tüm metin kombinasyonları AA ([DESIGN-SYSTEM.md §4](04-panel/DESIGN-SYSTEM.md#4-erişilebilirlik)). Açık soru kapandı
- [x] DESIGN-SYSTEM.md yeniden yazıldı: token eşlemesi, bileşenler, panel türetmeleri (kabuk, tablo, form, takvim, rozetler, boş durum, iskelet, toast). Panel türetmeleri F5 öncesi onaya sunulacak
- [x] `pnpm lint:tokens` (CI'da): hex, `rgb()` ve hazır Tailwind paleti yasak
- [x] Prettier Tailwind eklentisi `globals.css`'e bağlandı (özel token'lar doğru sıralanır)

### F4.2 Bileşen kütüphanesi

- [x] shadcn/ui kurulumu (Radix, `radix-nova`), DESIGN.md token'larıyla yeniden temalanması; takma ad katmanı yok, `lint:tokens` shadcn tema adlarını yakalar ([ADR-008](decisions/ADR-008-shadcn-theming.md))
- [x] DESIGN.md özel bileşenleri: `ActionButton`, `GlassCard`, `GlassStatCard`, `Eyebrow` (etiket tipografisi), `StatusTag`, `SectionShell` (F4.1'de yapılmıştı)
- [x] Panel bileşenleri: `Button` varyantları, `Input`, `Select`, `Textarea`, `Switch`, `Checkbox`, `Dialog`, `Sheet`, `Tabs`, `Table`, `Badge`, durum/kaynak rozetleri, `Toaster`, `Skeleton`, `EmptyState`, `Avatar`, `DropdownMenu`, `Tooltip`, `Popover` + `Calendar` (tarih seçici), `FormField`, `ScheduleGrid` (gün/hafta, hekim kolonları, çakışma şeritleri; düzen fonksiyonu testli)
- [x] `Table` sıralama ve sayfalama: veri katmanıyla birlikte F5'te (sunucu tarafı, URL parametreleri) — Randevular ve Hastalar sütun sıralaması, URL'de, JS'siz (2026-10-08)
- [x] Yaşayan stil rehberi: `/dev/tasarim` → "Panel bileşenleri" bölümü (yalnızca development)
- [ ] **Ürün ekibi onayı:** panel türetmeleri, durum rozetleri ve `danger` token'ı (F5 öncesi)

### F4.3 Tanıtım sitesi (DESIGN.md bölümleri)

> **2026-10-04:** Ürün ekibi isteğiyle sıfırdan yeniden tasarlandı (DESIGN.md v2, [ADR-007](decisions/ADR-007-navy-palette-and-landing.md)): 13 bölüm ve footer, sticky header, gerçek demo talep formu (`demo_requests`, KVKK onayı, honeypot). Aşağıdaki maddeler v1 içindi.

- [x] Yüzen cam navigasyon
- [x] Hero: 92vh, 2.5rem, gradyan katmanı, 22vw dekoratif metin, sağda cam kartlar. **Soyut görsel yerine geçici CSS zemini**; görsel gelince değişecek
- [x] Açık özellik ızgarası: yapışkan başlık, 2×3 ikon-etiket, koyu görsel kart ve cam ilerleme paneli (görsel yerine CSS)
- [x] Koyu "nasıl çalışır" bloğu: ızgara çizgi dokusu, numaralı adımlar, 3° döndürülmüş mock pencere, bounce durum etiketi
- [x] Bento fiyat ızgarası (fiyatlar pilot sonrası)
- [ ] Görsel varlıklar (bkz. Açık sorular: Recall logosu, hero görseli)

### F4.4 Kontroller

- [ ] Lighthouse (performans ve erişilebilirlik ≥ 90), mobil 375 px, klavye ile gezinme, `prefers-reduced-motion`

**F4 çıkış kriterleri:** Tüm token'lar tek yerde; stil rehberi sayfası eksiksiz; tanıtım sitesi DESIGN.md'deki 4 bölümü uyguluyor; kod içinde sabit hex veya px renk yok (lint kuralı veya grep kontrolü).

---

## F5: Klinik paneli

**Hedef:** Kliniğin ekibinin günlük işini yaptığı, kliniğe ve kişiye göre özelleşen panel. Tüm ekranlar F4 bileşenleriyle, tüm veriler F3 yetki katmanından.

### F5.1 Panel kabuğu

- [x] Düzen: koyu cam kenar çubuğu (gradyan + grain), açık içerik alanı (`canvas`), klinik değiştirici, kullanıcı menüsü (çıkış)
- [x] Mobil: üst bar + alt sekme çubuğu ("Daha fazla" sayfası)
- [x] Menü izinlerden hesaplanır (yetkisi olmayan menüyü görmez). `settings.panel` modül görünürlüğü F3.5 ile eklenecek

### F5.2 Ekranlar

| Ekran               | Rota                | İçerik                                                                                                         | Gerekli izin                                      |
| ------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Bugün ✅            | `/panel`            | Özet kartları (cam stat kartları), günün zaman çizelgesi, asistanın yeni aldığı randevular, açık geri aramalar | `appointments.read`                               |
| Takvim ✅           | `/panel/takvim`     | Gün/hafta, hekim kolonları, boş slota tıklayarak randevu, randevu detay paneli                                 | `appointments.read` / `create`                    |
| Randevular ✅       | `/panel/randevular` | Filtreli tablo, durum değiştirme (onayla, iptal, gelmedi, tamamlandı)                                          | `appointments.*`                                  |
| Aramalar ✅         | `/panel/aramalar`   | Liste (maskeli numara), detay: özet, transkript, kayıt oynatıcı, bağlı randevu                                 | `calls.read`, kayıt için `calls.listen_recording` |
| Hastalar ✅         | `/panel/hastalar`   | Arama, detay, geçmiş, not; anonimleştirme                                                                      | `patients.*`                                      |
| Geri aranacaklar ✅ | `/panel/geri-arama` | Açık talepler, tamamlandı işareti                                                                              | `callbacks.*`                                     |
| Ayarlar ✅          | `/panel/ayarlar/*`  | Aşağıda                                                                                                        | `settings.*`                                      |

### F5.3 Ayarlar (kliniğe özelleştirme)

- [x] Klinik: ad, adres, devir numarası (saat dilimi salt okunur)
- [x] Çalışma saatleri (gün başına birden çok aralık). Tatiller ve kapalı günler (`time_off`, 2026–2027 resmî tatil şablonu, yarım günler, çakışan randevu uyarısı, takvimde not)
- [x] Hekimler: liste, hizmet eşleme, haftalık program, aktif/pasif, izin günleri
- [x] Hizmetler: ad, eş anlamlılar, açıklama, süre, fiyat aralığı (₺ → kuruş), aktif/pasif
- [x] Asistan: ad, karşılama, fiyat söylensin mi, kayıt, SSS (20), ek talimatlar, **prompt önizleme**, son senkron durumu, "Şimdi güncelle", **tarayıcıdan test araması** (Retell web call, tek kullanımlık token). [x] Ses seçimi ve örnek dinleme (paylaşılan TTS modelinin sağlayıcısındaki sesler; örnekler İngilizce, Türkçe için test araması)
- [x] Randevu kuralları: slot aralığı, minimum ön süre, ileri gün sınırı, iptal kuralı, hekim tercihi sorulsun mu
- [x] Bildirimler: SMS onayı ve hatırlatma saati (gönderim Netgsm ile, F2)
- [x] Ekip ve roller (F3.3 arayüzü); denetim kaydı sayfası
- [x] Panel tercihleri: klinik geneli (`settings.panel`) ve kişisel (`member_preferences`)
- [x] Her kayıt: Zod (ortak sözleşme) → Server Action → domain → audit → **asistan senkronu tetiklenir** (`after()`, `src/server/voice/sync.ts`)

### F5.4 Veri tazeliği

- [x] MVP: Bugün ve Takvim 30 sn'de bir, sekme görünürken yenilenir (`AutoRefresh`)
- [ ] V1: SSE ile "yeni randevu" bildirimi

### F5.5 Testler

- [x] Server Action entegrasyon testleri (PGlite): yetki, doğrulama, kiracı izolasyonu — 2026-10-08
- [x] Playwright: giriş → takvimde randevu oluştur → iptal; ayar değiştir → senkron tetiklendi; yetkisiz rol menüyü görmüyor — `e2e/` (9 akış + 13 sayfada erişilebilirlik, CI'da), 2026-10-08
- [ ] Görsel kontrol: her ekran 375 px ve 1440 px

**F5 çıkış kriterleri:** Bir sekreter, panelden bir günü baştan sona yönetebiliyor; ayar değişiklikleri asistana yansıyor; iki farklı klinik farklı ayarlarla aynı anda sorunsuz çalışıyor.

---

## F6: Recall yönetim konsolu (platform admin)

**Hedef:** Recall ekibinin klinikleri oluşturması, numara bağlaması ve sorunları izlemesi.

> Kararlar: [ADR-010](decisions/ADR-010-platform-console.md).

- [x] Platform rolü: `users.role = 'platform_admin'` (Better Auth admin plugin); impersonation hiçbir role verilmez. İlk admin: `pnpm platform:admin`
- [x] `/admin`: klinik listesi, durum, ekip/numara sayısı, ajan senkron durumu, son 30 gün arama/dakika/maliyet, son arama
- [x] Klinik oluşturma: bilgiler → sektör şablonu (diş, estetik, fizyoterapi, boş) → owner (parola e-postası) → isteğe bağlı numara; tek transaction. Detayda "Asistanı oluştur" ve canlıya geçiş kontrol listesi. [ ] Numaranın Retell'e otomatik içe aktarılması (F2)
- [x] Klinik duraklatma ve yeniden açma; ajanı zorla yeniden gönderme
- [x] Destek görünümü: kişisel veri **gösterilmeden** arama metrikleri, sonuç dağılımı, senkron hatası
- [x] Maliyet görünümü: klinik bazında 30 günlük dakika ve gerçek maliyet (`calls.cost_usd`, Retell `combined_cost`)
- [x] Demo talepleri listesi ve durum takibi (yeni, görüşüldü, müşteri oldu, olumsuz)

**F6 çıkış kriterleri:** Yeni bir klinik, kod veya veritabanına dokunmadan, konsoldan 15 dakikada canlıya alınabiliyor.

---

## F7: KVKK, güvenlik ve veri saklama

- [x] Hasta anonimleştirme ve dışa aktarma ([DATA-RETENTION.md](05-compliance/DATA-RETENTION.md)); anonimleştirme Retell'deki sesi de siler
- [x] Saklama cron'u: `GET /api/cron/retention` (kayıt 30 gün, döküm 90 gün, numara 2 yıl); Retell tarafında 30 gün otomatik silme
- [x] Retell veri saklama ayarlarının klinik tercihine göre ayarlanması (imzalı kayıt bağlantıları; kayıt kapalıysa arama analizden sonra Retell'den silinir)
- [ ] Hassas alanların uygulama seviyesinde şifrelenmesinin değerlendirilmesi (transkript, telefon) — Hukuki görüşle birlikte değerlendirilecek
- [x] Güvenlik başlıkları ve CSP, hız sınırlama (giriş, webhook), Retell IP izin listesi (opsiyonel ek katman) — Başlıklar + CSP + Postgres tabanlı hız sınırları (2026-10-07). Retell IP izin listesi gerekmedi: imza + tekrar koruması
- [ ] Aydınlatma metni şablonu, DPA şablonu, alt işleyenler listesi (Retell, Neon, Vercel, Netgsm, Resend)
- [ ] Avukat incelemesi (ürün ekibi)
- [x] Güvenlik incelemesi (`/security-review`) ve bağımlılık taraması — [SECURITY-REVIEW-2026-10.md](05-compliance/SECURITY-REVIEW-2026-10.md); CI'da `pnpm audit --prod`, Dependabot

---

## Takip (hasta takip ve hatırlatma)

Tasarım ve karar günlüğü: [proposals/TAKIP.md](proposals/TAKIP.md).

- [x] V0: bildirim kaydı (0008), günlük iş, randevu hatırlatması (stub), SMS kilitleri, genel SMS metinleri. Production'da (2026-10-06)
- [x] V1: kurallar, planlar, ziyaretler (0009), eşleştirme, Takip sekmesi, plan detayı, kural editörü, SMS izni, "SMS istemiyor", konsol anahtarı, KVKK. Production'da (2026-10-07), demo klinikte açık
- [ ] V1.1: otomatik plan başlatma, kural değişikliğini mevcut planlara uygulama, kliniğe SMS kullanım görünürlüğü, saatlik iş (Vercel Pro)
- [ ] V2: kademeli protokoller, sesli asistan önerisi, hekim erişimi

---

## F8: Production (Vercel, Neon, izleme)

- [x] GitHub reposu ve push (`recallapp0/recall`)
- [x] Vercel projesi (**RECALL** takımı, `recall25`, proje `recall`), bölge `fra1`, Git bağlantısı; `main` push = production deploy (2026-10-06)
- [x] Neon Frankfurt, `production` dalı (Marketplace yerine mevcut proje; ücretsiz plan, canlıdan önce ücretli). Preview için Neon dalları: ⏳
- [x] Production env değişkenleri (gizliler sensitive). Preview: ⏳ (bilerek boş, bkz. DEPLOYMENT.md)
- [x] Production ajanları `recalltr.company`'ye bağlı (konsoldan oluşturulan demo klinik; gerçek arama → randevu → DB doğrulandı). Inbound URL numara gelince (F2). Preview test ajanları: ⏳
- [x] Alan adı `recalltr.company` (+ `www` yönlendirme), Resend alanı doğrulandı (eu-west-1), güvenlik başlıkları, robots/sitemap/OG
- [ ] Sentry, uptime izleme (`/api/health`), Vercel Cron — Vercel Cron ve kod hazır (Sentry, `/api/health/jobs`); hesaplar ürün ekibinde ([MONITORING.md](06-operations/MONITORING.md))
- [x] CI: entegrasyon testleri (PGlite) ve build; `main` koruması — CI yeşil (testler, build, E2E). `main` koruması ürün ekibinde (GitHub ayarı)

---

## F9: Pilot

- [ ] 3 pilot klinik (en az biri diş, biri estetik)
- [ ] Senaryo eval seti otomasyonu (metin modunda simülasyon) ve haftalık çalıştırma
- [ ] Haftalık metrik raporu ([MONITORING.md](06-operations/MONITORING.md))
- [ ] Geri bildirim döngüsü: prompt ve ayar iyileştirmeleri, sürüm notları
- **Çıkış:** 2 hafta kesintisiz, ≥ %70 insansız tamamlanan arama, < %1 hatalı randevu

---

## F10: V1 ve sonrası

Faturalandırma (iyzico veya Stripe), self-servis kayıt, haftalık rapor e-postası, Google Calendar senkronu, giden webhook'lar, çoklu şube, giden arama (hatırlatma), WhatsApp, çoklu dil. Ayrıntılar [ROADMAP.md](00-product/ROADMAP.md) içinde; F9 sonrası bu belgeye fazlar olarak eklenecek.

---

## Ortak sözleşmeler (backend ↔ frontend uyumu)

| Katman             | Konum                                                                | Kural                                                                                                                                                                                                 |
| ------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paylaşılan şemalar | `src/lib/contracts/*.ts`                                             | Zod. `server-only` içermez; form (client) ve Server Action (server) aynı şemayı kullanır                                                                                                              |
| Domain             | `src/server/domain/*.ts`                                             | İş kuralları; girdi olarak sözleşme tiplerini alır, `clinicId` ilk parametredir                                                                                                                       |
| Server Actions     | `src/app/panel/**/actions.ts`                                        | `requirePermission` → `schema.safeParse` → domain → audit → `revalidatePath` / senkron tetikleme. Dönüş tipi tek biçim: `{ ok: true, data } \| { ok: false, error: { code, message, fieldErrors? } }` |
| Hata kodları       | `src/lib/contracts/errors.ts`                                        | Domain hata kodları (`DomainErrorCode`) UI'da Türkçe mesaja eşlenir; tek liste                                                                                                                        |
| UI                 | `src/components/**`                                                  | Yalnızca DESIGN.md token'ları; veri tipleri sözleşmelerden (`z.infer`)                                                                                                                                |
| Tarih ve saat      | `src/server/domain/time.ts` + client karşılığı `src/lib/datetime.ts` | DB UTC, gösterim klinik saat diliminde, `tr-TR` biçimi                                                                                                                                                |

---

## Açık sorular (ürün ekibine)

Bu sorular cevaplandıkça ilgili göreve işlenir ve buradan kaldırılır.

1. **Kayıt dinleme:** Paneldeki ses kayıtlarını hangi roller dinleyebilir? (F3.2 önerisi: `owner`, `admin`)

## Alınan kararlar

| Tarih      | Karar                                                                                                                          | Etkilenen görevler                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 2026-10-04 | Ses altyapısı Retell AI; Vapi kullanılmayacak; Netgsm ve alternatifler test edilecek                                           | F1, F2, [ADR-004](decisions/ADR-004-retell-voice-platform.md) |
| 2026-10-04 | DESIGN.md tek tasarım kaynağı                                                                                                  | F4, F5, [ADR-005](decisions/ADR-005-design-system.md)         |
| 2026-10-04 | Klinikleri Recall ekibi açar (konsol); self-servis kayıt V1'e kaldı                                                            | F3.1, F6, F10                                                 |
| 2026-10-04 | Giriş: e-posta + parola; herkese açık kayıt kapalı, yalnızca davet                                                             | F3.1                                                          |
| 2026-10-04 | Panel özelleştirme: rol ve yetkiler, modül görünürlüğü, kişisel tercihler. Logo ve renk özelleştirmesi yok                     | F3.2, F3.5, F5                                                |
| 2026-10-04 | Retell hesabı hazır; API anahtarını ürün ekibi `.env.local` dosyasına kendisi girer (sohbete yazılmaz)                         | F1.3                                                          |
| 2026-10-04 | GitHub reposu: `recallapp0/recall`                                                                                             | F8                                                            |
| 2026-10-04 | Panel yalnızca Türkçe; i18n altyapısı kurulmayacak (metinler doğrudan Türkçe)                                                  | F4, F5                                                        |
| 2026-10-04 | Netgsm hesabı en son aşamada birlikte açılacak                                                                                 | F2 (F5–F7'den sonra)                                          |
| 2026-10-04 | Recall logosu ve hero görseli henüz yok; F4.3'te birlikte üretilecek                                                           | F4.3                                                          |
| 2026-10-04 | E-posta: Resend, adaptör arkasında; e-postalar hasta verisi içermez                                                            | F3, [ADR-006](decisions/ADR-006-email-provider.md)            |
| 2026-10-04 | DESIGN.md v2: koyu lacivert + beyaz palet; tanıtım sayfası 13 bölüm, sticky header; başlık "Kliniğinizin yeni nesil sekreteri" | F4, [ADR-007](decisions/ADR-007-navy-palette-and-landing.md)  |
