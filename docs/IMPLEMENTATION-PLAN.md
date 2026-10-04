# Uygulama Planı

> Bu belge Recall'un bundan sonraki tüm geliştirme işini fazlara ve görevlere böler.
> **Her agent ve geliştirici işe başlamadan önce bu belgeyi ve [WORKLOG.md](../WORKLOG.md) dosyasını okur.**
> Görev kimlikleri (ör. `F1.4`) commit mesajlarında, dal adlarında ve WORKLOG kayıtlarında kullanılır.

Son güncelleme: 2026-10-04 · Sahip: Ürün + Mühendislik

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

## Faz durum özeti

| Faz | Başlık                                                      | Durum                                                                      | Bağımlılık                            |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------- |
| F0  | Temel (belgeler, iskelet, domain, testler)                  | ✅ Tamamlandı                                                              | —                                     |
| F1  | Retell geçişi ve sesli asistan çekirdeği                    | ⏳ Sırada                                                                  | F0                                    |
| F2  | Telefon (SIP) ve SMS: Netgsm ve alternatiflerin testi       | ⏳                                                                         | F1                                    |
| F3  | Hesaplar, kimlik doğrulama, roller, klinik yönetimi         | 🟡 Başladı (`feat/panel-auth`: better-auth paketi eklendi, commit'lenmedi) | F0                                    |
| F4  | Tasarım sistemi (DESIGN.md) uygulaması                      | ⏳                                                                         | F0                                    |
| F5  | Klinik paneli                                               | ⏳                                                                         | F3, F4 (F1 ile paralel ilerleyebilir) |
| F6  | Recall yönetim konsolu (platform admin)                     | ⏳                                                                         | F3, F1                                |
| F7  | KVKK, güvenlik, veri saklama                                | ⏳                                                                         | F5                                    |
| F8  | Production: Vercel, Neon, izleme                            | ⏳                                                                         | F1, F3 (F2 gerçek numara için)        |
| F9  | Pilot (3 klinik) ve eval                                    | ⏳                                                                         | F1–F8                                 |
| F10 | V1 ve sonrası (faturalandırma, self-servis, entegrasyonlar) | ⏳                                                                         | F9                                    |

**Önerilen sıra:** F1 ile F4 paralel başlar (ses çekirdeği ve tasarım temeli birbirinden bağımsız). Ardından F3 → F5 ve F6, sonra F2 (gerçek numara), F7, F8, F9.

---

## F0: Temel ✅

Tamamlananlar ([WORKLOG.md](../WORKLOG.md) içinde ayrıntılı):

- [x] 38 belge (ürün, mimari, ses, telefon, panel, uyum, operasyon, ADR'ler)
- [x] Next.js 16, TypeScript strict, Tailwind 4, pnpm, ESLint, Prettier, Vitest, CI
- [x] Drizzle şeması (10 tablo), migration'lar, `EXCLUDE USING gist` ile çifte rezervasyon engeli, seed
- [x] Müsaitlik motoru (saf fonksiyon) ve testleri
- [x] Randevu oluşturma, bulma, iptal ve erteleme domain'i (atomik, idempotent, kiracı izolasyonlu)
- [x] Sağlayıcıdan bağımsız 6 tool ve system prompt üretici
- [x] Vapi adaptörü (**F1'de kaldırılacak**)
- [x] PGlite ile Docker'sız entegrasyon testleri (72 test) ve lokal DB (`pnpm db:local`)

---

## F1: Retell geçişi ve sesli asistan çekirdeği

**Hedef:** Bir klinik için Retell üzerinde, veritabanından üretilen ajanın Türkçe konuşarak gerçek takvimden randevu alması. Önce Retell web call (tarayıcı), sonra test numarası.

**Ön koşullar (ürün ekibinden):** Retell hesabı ve webhook yetkili API anahtarı (`RETELL_API_KEY`).

### F1.1 Belgeleri Retell'e taşı

- [ ] [ARCHITECTURE.md](01-architecture/ARCHITECTURE.md): diyagram ve akışlar Retell'e göre (inbound webhook → ajan → custom function → olay webhook'ları)
- [ ] [API.md](01-architecture/API.md): yeni uç noktalar (F1.5), istek ve yanıt örnekleri, imza doğrulama
- [ ] [AGENT-DESIGN.md](02-voice-agent/AGENT-DESIGN.md), [TOOLS.md](02-voice-agent/TOOLS.md), [SYSTEM-PROMPT.md](02-voice-agent/SYSTEM-PROMPT.md): statik prompt ile dinamik değişken ayrımı (F1.6)
- [ ] [TELEPHONY.md](03-telephony/TELEPHONY.md), [CALL-ROUTING.md](03-telephony/CALL-ROUTING.md): Retell SIP (`sip:sip.retellai.com`), IP izin listeleri
- [ ] [TECH-STACK.md](01-architecture/TECH-STACK.md), [COST-MODEL.md](06-operations/COST-MODEL.md), [MONITORING.md](06-operations/MONITORING.md), [LOCAL-DEVELOPMENT.md](06-operations/LOCAL-DEVELOPMENT.md), [DEPLOYMENT.md](06-operations/DEPLOYMENT.md), [KVKK.md](05-compliance/KVKK.md) (alt işleyen: Retell)
- [ ] [ADR-003](decisions/ADR-003-llm-model.md): adaylar Retell'in model listesinden (Claude Sonnet/Haiku sürümleri), ölçüm yöntemi aynı
- **Kabul:** `grep -ri vapi docs/` yalnızca ADR-002 ve tarihsel kayıtlarda sonuç verir.

### F1.2 Veri modeli: ses ajanları ve numaralar

- [ ] Yeni tablo `voice_agents`: `id, clinic_id (unique), provider ('retell'), external_agent_id (unique), external_llm_id, spec_hash, status ('pending' | 'synced' | 'error'), last_error, synced_at, created_at, updated_at`
- [ ] Yeni tablo `phone_numbers`: `id, clinic_id, e164 (unique), provider ('retell'), external_id, carrier ('netgsm' | 'verimor' | 'retell' | …), purpose ('inbound'), status, created_at`. Bir klinik birden fazla numara kullanabilir (çoklu şube veya kampanya hattı)
- [ ] `clinics.phone_number` alanı `phone_numbers` tablosuna taşınır (data migration + kolon kaldırma, iki adımda)
- [ ] `calls` tablosuna: `external_agent_id`, `disconnection_reason`; `provider` değeri `retell`
- [ ] Domain: `findClinicByAgentId`, `findClinicByPhoneNumber` (yeni tablodan)
- [ ] Testler: migration'lar PGlite'ta uygulanıyor, kiracı izolasyonu korunuyor
- **Dosyalar:** `src/server/db/schema.ts`, `drizzle/00xx_*.sql`, `src/server/domain/clinics.ts`

### F1.3 Retell istemcisi ve imza doğrulama

- [ ] `retell-sdk` paketini ekle (resmî Node SDK). Sürümü sabitle
- [ ] Env: `RETELL_API_KEY` (zorunlu), `RETELL_DEFAULT_VOICE_ID`, `RETELL_DEFAULT_LLM_MODEL`, `RETELL_WEBHOOK_TOLERANCE_MS` (varsayılan 300000). `.env.example`, [DEPLOYMENT.md](06-operations/DEPLOYMENT.md), `src/lib/env.ts` güncellenir
- [ ] `providers/retell/signature.ts`: ham gövde ile `X-Retell-Signature` doğrulaması, 5 dakikalık tazelik ve sabit zamanlı karşılaştırma. SDK'daki `Retell.verify` ile birebir aynı sonucu verdiğini gösteren test
- [ ] Route handler'larda gövde **ham metin olarak** okunur (`await request.text()`), doğrulama sonrası parse edilir
- [ ] Testler: geçerli imza, yanlış imza, eski zaman damgası, eksik başlık
- **Dosyalar:** `src/server/voice/providers/retell/{client,signature,schemas}.ts`

### F1.4 Ajan tanımı üretimi (agent spec)

- [ ] `buildRetellAgentSpec(clinic, directory, settings, config)` saf fonksiyonu. Çıktısı:
  - **Retell LLM:** `general_prompt` (klinik bilgisi + kurallar + `{{today_long}}`, `{{now_time}}`, `{{caller_phone}}`, `{{transfer_available}}`, `{{clinic_status}}` değişkenleri), `begin_message`, `model`, `model_temperature`, `general_tools` (6 custom tool + `end_call` + koşullu `transfer_call`), `default_dynamic_variables`
  - **Agent:** `voice_id` (klinik ayarı veya varsayılan), `language: "tr-TR"`, `webhook_url` (olaylar), sessizlik ve kesinti ayarları, kayıt tercihi (`settings.assistant.recordCalls`), veri saklama ayarı
- [ ] Custom tool tanımları mevcut Zod şemalarından üretilir (`toolParameters`). URL: `${APP_URL}/api/voice/retell/tools`. `speak_during_execution` metni tool'un `fillerMessage` alanından gelir
- [ ] `spec_hash` = spec'in kararlı JSON özeti. Değişmediyse senkron atlanır
- [ ] Prompt üretimi ikiye ayrılır: `buildStaticPrompt` (senkronda) ve `buildCallVariables` (arama anında). Mevcut `prompt.ts` buna göre yeniden düzenlenir; testler korunur
- [ ] Testler: snapshot yerine anlamlı iddialar (tool listesi, değişken adları, transfer koşulu, fiyat gizleme)
- **Dosyalar:** `src/server/voice/providers/retell/agent-spec.ts`, `src/server/voice/prompt.ts`

### F1.5 Webhook uç noktaları

| Uç nokta                         | Olay                                          | Davranış                                                                                                                                                                                                                                                   |
| -------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/voice/retell/inbound` | `call_inbound`                                | `to_number` → klinik. Bilinmeyen numara: `reject: true`. Klinik bulunursa: `override_agent_id`, `dynamic_variables` (tarih, saat, arayan, aktarım, durum), `metadata: { clinic_id }`. `calls` satırı açılır. **Hedef < 300 ms** (Retell zaman aşımı 10 sn) |
| `POST /api/voice/retell/tools`   | custom function                               | İmza → `call.agent_id` ile klinik bulunur, `call.metadata.clinic_id` ile çapraz doğrulanır → `runTool(name, args, ctx)` → JSON yanıt (≤ 15.000 karakter)                                                                                                   |
| `POST /api/voice/retell/events`  | `call_started`, `call_ended`, `call_analyzed` | `calls` güncellenir: süre, bitiş nedeni, transkript, kayıt URL'i, özet, maliyet. Olaylar idempotent işlenir (tekrar gelebilir)                                                                                                                             |

- [ ] Ortak işleyici deseni: `verify → parse (Zod, gevşek) → resolve tenant → domain → respond`. Route dosyaları ince kalır
- [ ] Retell'in tekrar denemelerine karşı idempotency (`call_id` bazlı upsert)
- [ ] Entegrasyon testleri (PGlite): inbound → tools (müsaitlik, randevu, iptal, erteleme, geri arama) → events; kiracılar arası erişim denemesi
- **Dosyalar:** `src/app/api/voice/retell/{inbound,tools,events}/route.ts`, `src/server/voice/providers/retell/handlers.ts`

### F1.6 Ajan senkronizasyonu

- [ ] `syncClinicVoiceAgent(db, clinicId)`: spec üret → hash karşılaştır → Retell LLM ve Agent oluştur veya güncelle → `voice_agents` güncelle. Hata olursa `status=error`, `last_error` (kişisel veri içermez)
- [ ] CLI: `pnpm voice:sync --clinic <slug>` ve `pnpm voice:sync --all`
- [ ] Tetikleyici sözleşmesi: panelde klinik, hizmet, hekim, saat veya asistan ayarı değiştiğinde `after()` ile senkron kuyruğa alınır (F5'te bağlanacak)
- [ ] Retell kotası ve hız sınırına karşı yeniden deneme (üstel geri çekilme)
- [ ] Testler: Retell istemcisi sahte (fake) ile; hash değişmezse API çağrısı yapılmadığını doğrula

### F1.7 Vapi kodunun kaldırılması

- [ ] `src/server/voice/providers/vapi/`, `src/app/api/voice/vapi/`, Vapi fixture'ları ve `VAPI_*` env değişkenleri silinir
- [ ] `scripts/fixtures/` Retell örnekleriyle değiştirilir: `retell-inbound.json`, `retell-tool-call.json`, `retell-call-ended.json` ve imzalı istek gönderen `scripts/retell-sign.ts` yardımcı betiği

### F1.8 Uçtan uca POC

- [ ] Tünel (cloudflared) ile lokal → Retell'de demo klinik ajanı senkronize edilir
- [ ] Retell **web call** ile 20 senaryodan ([CONVERSATION-SCENARIOS.md](02-voice-agent/CONVERSATION-SCENARIOS.md)) en az 10'u elle denenir
- [ ] Model karşılaştırması: Retell'in desteklediği 2–3 Claude modeli. Ölçülenler: başarı, tur gecikmesi, maliyet. Sonuç [ADR-003](decisions/ADR-003-llm-model.md)'e işlenir
- [ ] ASR ve TTS karşılaştırması (Türkçe): Deepgram, Azure, Soniox × ElevenLabs, Cartesia. Sonuç [VOICE-AND-LANGUAGE.md](02-voice-agent/VOICE-AND-LANGUAGE.md)'ye işlenir
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
- [ ] `phone_numbers` kaydı ve panel/CLI ile numara–klinik eşlemesi (`pnpm voice:attach-number --clinic <slug> --number +90…`)
- [ ] Testler: gelen arama, caller ID, gizli numara, transfer (SIP REFER) ve ses kalitesi
- [ ] Yönlendirme senaryoları ([CALL-ROUTING.md](03-telephony/CALL-ROUTING.md)): her zaman, meşgul/cevapsız, mesai dışı; devir döngüsü kontrolü

### F2.3 SMS: Netgsm

- [ ] Netgsm SMS API'sinin güncel dokümana göre doğrulanması (mevcut adaptör varsayıma dayanıyor)
- [ ] `notifications` tablosu: `id, clinic_id, appointment_id, type, channel, to (maskeli değil, şifreleme F7), status, provider_message_id, error, sent_at`. Tekil kısıt `(appointment_id, type)` ile idempotency
- [ ] Türkçe karakter ve uzunluk ölçümü; şablonlar [NOTIFICATIONS.md](03-telephony/NOTIFICATIONS.md) ile uyumlu
- [ ] Klinik başına gönderici başlığı (varsayılan: Recall başlığı)
- [ ] Hatırlatma cron'u: `GET /api/cron/reminders` (saatlik, `CRON_SECRET`), idempotent
- [ ] İYS ve ticari ileti ayrımı için hukuki teyit (ürün ekibi)

**F2 çıkış kriterleri:** En az bir Türk numarası Retell'e bağlı ve 20 test aramasında sorunsuz; SMS onay ve hatırlatma gönderiliyor; değerlendirme belgesi en az iki sağlayıcıyla dolu.

---

## F3: Hesaplar, kimlik doğrulama, roller ve klinik yönetimi

**Hedef:** Her kliniğin kendi hesabı, kendi ekip üyeleri ve rolleri; Recall ekibinin klinik oluşturup yönetebilmesi. Paneli besleyecek güvenli kiracı bağlamı.

> 🟡 `feat/panel-auth` dalında `better-auth` bağımlılığı eklenmiş ama commit'lenmemiş. Bu faz o dalda devam eder.

### F3.1 Better Auth kurulumu

- [ ] Better Auth + Drizzle adaptörü; tablolar: `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`
- [ ] Giriş yöntemi (ürün ekibi kararı, bkz. Açık sorular): e-posta + parola ve/veya e-posta ile sihirli bağlantı
- [ ] `organization` ↔ `clinics` 1:1: `clinics.organization_id` (unique). Klinik oluşturma işlemi ikisini tek transaction'da yaratır
- [ ] Env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`; e-posta için `RESEND_API_KEY`, `EMAIL_FROM`
- [ ] Route handler: `src/app/api/auth/[...all]/route.ts`

### F3.2 Roller ve izinler (klinik içi)

- [ ] Varsayılan roller: `owner`, `admin`, `staff` (sekreter), `practitioner` (hekim)
- [ ] İzin modeli (Better Auth access control): kaynak × eylem matrisi. Örnek: `appointments: [read, create, update, cancel]`, `calls: [read, listen_recording]`, `patients: [read, update, anonymize]`, `settings.clinic`, `settings.assistant`, `settings.team`, `billing`
- [ ] **Klinik başına özel roller:** Owner, varsayılan rolleri kopyalayıp düzenleyebilir veya yeni rol tanımlayabilir (ör. "Ön büro (sadece okuma)")
- [ ] `practitioner` rolü bir `practitioners` kaydına bağlanabilir (`member.practitioner_id`): kendi takvimini görür
- [ ] Sunucu yardımcıları: `requireSession()`, `requireClinic()` (aktif organizasyon → `ClinicContext`), `requirePermission(resource, action)`. Her Server Action ve sayfa bunlardan biriyle başlar
- [ ] `proxy.ts` (Next 16): `/panel/**` ve `/admin/**` için oturum yoksa `/giris`'e yönlendirme. Yetki kontrolü proxy'de değil sunucu yardımcılarındadır (derinlemesine savunma)

### F3.3 Davet ve ekip yönetimi

- [ ] Owner veya admin e-posta ile davet gönderir, rol seçer
- [ ] Davet kabul ekranı; süresi dolan davetler
- [ ] Üye çıkarma ve rol değiştirme. Son owner çıkarılamaz
- [ ] Bir kullanıcı birden fazla kliniğe üye olabilir (ör. çok şubeli hekim). Panelde klinik değiştirici

### F3.4 Denetim kaydı (audit log)

- [ ] `audit_events`: `id, clinic_id, actor_user_id, action, target_type, target_id, metadata (kişisel veri yok), created_at`
- [ ] Kaydedilenler: giriş, rol değişikliği, davet, ayar değişikliği, hasta anonimleştirme, kayıt dinleme

### F3.5 Panel kişiselleştirme altyapısı

- [ ] `clinics.settings.panel` (klinik geneli): görünür modüller (ör. Aramalar sekmesi kapatılabilir), varsayılan takvim görünümü (gün/hafta), haftanın başlangıcı, takvim saat aralığı, klinik logosu
- [ ] `member_preferences` (kişi bazında): varsayılan sayfa, takvimde gösterilen hekimler, yoğunluk (rahat/sıkı), bildirim tercihleri
- [ ] Şemalar `src/lib/contracts/panel-settings.ts` içinde (client ve server ortak)
- [ ] Not: Renk ve font DESIGN.md'ye bağlı olduğundan klinik bazında değiştirilemez. Klinik markası logo ve ad ile yansıtılır (ürün ekibi onayı bekleniyor, bkz. Açık sorular)

### F3.6 Testler

- [ ] Yetki matrisi testleri: her rol × her eylem
- [ ] Kiracı izolasyonu: A kliniğinin üyesi B kliniğinin verisine hiçbir Server Action ile erişemez
- [ ] Davet akışı entegrasyon testi

**F3 çıkış kriterleri:** Klinik oluşturma, owner daveti, üye ekleme ve rol atama çalışıyor; tüm panel rotaları korumalı; yetki matrisi testli.

---

## F4: Tasarım sistemi (DESIGN.md) uygulaması

**Hedef:** DESIGN.md'nin kod karşılığının (token'lar, bileşenler, motion) kurulması; panel için türetmelerin belgelenmesi.

### F4.1 Token'lar ve temel

- [ ] Font: Inter (`next/font/google`, `latin` + `latin-ext`, Türkçe karakterler için). Geist kaldırılır
- [ ] `globals.css` `@theme`: `--color-ink: #000`, `--color-surface-dark: #18181B`, `--color-surface-light: #F4F4F5`, `--color-accent: #34D399`, `--color-body: #71717A`, `--color-glass-border: rgb(255 255 255 / 0.1)`; radius: `--radius-section: 2.5rem`, `--radius-bento: 2rem`, `--radius-card: 1rem…1.5rem`; blur: 12px ve 20px; easing: `cubic-bezier(0.16, 1, 0.3, 1)`
- [ ] Yardımcılar: `.glass`, `.glass-nav`, `.grain` (sabit SVG gürültü, %15 opaklık), `.bg-dark-gradient` (alttan ağırlıklı), `animate-fade-in-up`, `prefers-reduced-motion` desteği
- [ ] Tipografi ölçeği: başlık (500–700, `-0.05em`, `1.05`), gövde (300–400, Zinc-500), etiket (700, 10px, `0.2em`, büyük harf)
- [ ] **Erişilebilirlik kuralları** ([DESIGN-SYSTEM.md](04-panel/DESIGN-SYSTEM.md)): Zinc-500 metin Zinc-100 zeminde kontrast ≈ 4,4:1 (AA'nın 4,5:1 eşiğinin altında). Küçük gövde metni beyaz zeminde veya daha koyu tonda kullanılır. Emerald-400 yalnızca koyu zeminde metin, açık zeminde sadece dolgu/aksan olarak kullanılır. **Bu kurallar ürün ekibine onaylatılır**
- [ ] DESIGN-SYSTEM.md'nin DESIGN.md türetmesi olarak yeniden yazılması: panel kabuğu, tablo, form, takvim, durum rozetleri, boş durum, iskelet yükleme, toast

### F4.2 Bileşen kütüphanesi

- [ ] shadcn/ui kurulumu, DESIGN.md token'larıyla yeniden temalanması
- [ ] DESIGN.md özel bileşenleri: `ActionButton` (iç içe ikonlu hap buton), `GlassCard`, `GlassStatCard`, `Label` (etiket tipografisi), `StatusTag` (bounce), `SectionShell` (2.5rem radius, koyu gradyan + grain)
- [ ] Panel bileşenleri: `Button` varyantları, `Input`, `Select`, `Textarea`, `Switch`, `Checkbox`, `Dialog`, `Sheet`, `Tabs`, `Table` (sıralama, sayfalama), `Badge` (randevu durumu, kaynak), `Toast`, `Skeleton`, `EmptyState`, `Avatar`, `DropdownMenu`, `Tooltip`, `Calendar` (gün/hafta, hekim kolonları)
- [ ] Yaşayan stil rehberi: `/dev/design` (yalnızca development'ta açık), tüm bileşenler ve durumları

### F4.3 Tanıtım sitesi (DESIGN.md bölümleri)

- [ ] Yüzen cam navigasyon
- [ ] Hero: 92vh, 2.5rem, soyut görsel %60, gradyan katmanı, 22vw dekoratif metin, sağda cam kartlar (örnek arama ve randevu metrikleri)
- [ ] Açık özellik ızgarası: yapışkan başlık ve 2×3 ikon-etiket, görsel kart ve cam ilerleme paneli
- [ ] Koyu "nasıl çalışır" bloğu: numaralı adımlar ve 3° döndürülmüş mock pencere (arama transkripti ve tool çağrısı), bounce durum etiketi
- [ ] Bento fiyat ızgarası ([PRICING.md](00-product/PRICING.md) paketleri)
- [ ] Görsel varlıklar (bkz. Açık sorular: hero görseli, logo)

### F4.4 Kontroller

- [ ] Lighthouse (performans ve erişilebilirlik ≥ 90), mobil 375 px, klavye ile gezinme, `prefers-reduced-motion`

**F4 çıkış kriterleri:** Tüm token'lar tek yerde; stil rehberi sayfası eksiksiz; tanıtım sitesi DESIGN.md'deki 4 bölümü uyguluyor; kod içinde sabit hex veya px renk yok (lint kuralı veya grep kontrolü).

---

## F5: Klinik paneli

**Hedef:** Kliniğin ekibinin günlük işini yaptığı, kliniğe ve kişiye göre özelleşen panel. Tüm ekranlar F4 bileşenleriyle, tüm veriler F3 yetki katmanından.

### F5.1 Panel kabuğu

- [ ] Düzen: koyu cam kenar çubuğu (gradyan + grain), açık içerik alanı (Zinc-100), üst bar (klinik adı/logosu, klinik değiştirici, kullanıcı menüsü)
- [ ] Mobil: alt sekme çubuğu
- [ ] Modül görünürlüğü `settings.panel` ve izinlerden hesaplanır (yetkisi olmayan menüyü görmez)

### F5.2 Ekranlar

| Ekran            | Rota                | İçerik                                                                                                         | Gerekli izin                                      |
| ---------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Bugün            | `/panel`            | Özet kartları (cam stat kartları), günün zaman çizelgesi, asistanın yeni aldığı randevular, açık geri aramalar | `appointments.read`                               |
| Takvim           | `/panel/takvim`     | Gün/hafta, hekim kolonları, boş slota tıklayarak randevu, randevu detay paneli                                 | `appointments.read` / `create`                    |
| Randevular       | `/panel/randevular` | Filtreli tablo, durum değiştirme (onayla, iptal, gelmedi, tamamlandı)                                          | `appointments.*`                                  |
| Aramalar         | `/panel/aramalar`   | Liste (maskeli numara), detay: özet, transkript, kayıt oynatıcı, bağlı randevu                                 | `calls.read`, kayıt için `calls.listen_recording` |
| Hastalar         | `/panel/hastalar`   | Arama, detay, geçmiş, not; anonimleştirme                                                                      | `patients.*`                                      |
| Geri aranacaklar | `/panel/geri-arama` | Açık talepler, tamamlandı işareti                                                                              | `callbacks.*`                                     |
| Ayarlar          | `/panel/ayarlar/*`  | Aşağıda                                                                                                        | `settings.*`                                      |

### F5.3 Ayarlar (kliniğe özelleştirme)

- [ ] Klinik: ad, adres, saat dilimi, logo, devir numarası
- [ ] Çalışma saatleri ve tatiller (resmî tatil şablonu)
- [ ] Hekimler: liste, hizmet eşleme, haftalık program, izinler
- [ ] Hizmetler: ad, eş anlamlılar, süre, fiyat aralığı, aktif/pasif
- [ ] Asistan: ad, karşılama, ses seçimi (örnek dinleme), fiyat söylensin mi, SSS, ek talimatlar, **prompt önizleme**, **tarayıcıdan test araması** (Retell web call), son senkron durumu ve hatası
- [ ] Randevu kuralları: slot aralığı, minimum ön süre, ileri gün sınırı, iptal kuralı, hekim tercihi sorulsun mu
- [ ] Bildirimler: SMS onayı ve hatırlatma saati
- [ ] Ekip ve roller (F3.2/F3.3 arayüzü)
- [ ] Panel tercihleri: klinik geneli (`settings.panel`) ve kişisel (`member_preferences`)
- [ ] Her kayıt: Zod (ortak sözleşme) → Server Action → domain → audit → **asistan senkronu tetiklenir** (`after()`)

### F5.4 Veri tazeliği

- [ ] MVP: ilgili ekranlarda 30 sn polling (Bugün, Takvim)
- [ ] V1: SSE ile "yeni randevu" bildirimi

### F5.5 Testler

- [ ] Server Action entegrasyon testleri (PGlite): yetki, doğrulama, kiracı izolasyonu
- [ ] Playwright: giriş → takvimde randevu oluştur → iptal; ayar değiştir → senkron tetiklendi; yetkisiz rol menüyü görmüyor
- [ ] Görsel kontrol: her ekran 375 px ve 1440 px

**F5 çıkış kriterleri:** Bir sekreter, panelden bir günü baştan sona yönetebiliyor; ayar değişiklikleri asistana yansıyor; iki farklı klinik farklı ayarlarla aynı anda sorunsuz çalışıyor.

---

## F6: Recall yönetim konsolu (platform admin)

**Hedef:** Recall ekibinin klinikleri oluşturması, numara bağlaması ve sorunları izlemesi.

- [ ] Platform rolü: `user.role = 'platform_admin'` (Better Auth admin plugin). Klinik rollerinden tamamen ayrı
- [ ] `/admin` rotası (F3 korumasıyla): klinik listesi, durum (aktif/duraklatılmış), son arama, ajan senkron durumu
- [ ] Klinik oluşturma sihirbazı: klinik bilgileri → sektör şablonu (diş, estetik, fizyoterapi; [ONBOARDING.md](04-panel/ONBOARDING.md)) → owner daveti → numara bağlama → ajan senkronu → test araması
- [ ] Klinik duraklatma ve yeniden açma; ajanı zorla yeniden senkronize etme
- [ ] Destek görünümü: kişisel veri **gösterilmeden** arama metrikleri ve hatalar. Hasta verisine erişim yalnızca klinik izniyle ve audit kaydıyla (F7)
- [ ] Maliyet görünümü: klinik bazında aylık dakika ve tahmini maliyet ([COST-MODEL.md](06-operations/COST-MODEL.md))

**F6 çıkış kriterleri:** Yeni bir klinik, kod veya veritabanına dokunmadan, konsoldan 15 dakikada canlıya alınabiliyor.

---

## F7: KVKK, güvenlik ve veri saklama

- [ ] Hasta anonimleştirme ve dışa aktarma ([DATA-RETENTION.md](05-compliance/DATA-RETENTION.md))
- [ ] Saklama cron'u: `GET /api/cron/retention` (transkript 90 gün, kayıt 30 gün; Retell tarafında kayıt silme)
- [ ] Retell veri saklama ayarlarının klinik tercihine göre ayarlanması
- [ ] Hassas alanların uygulama seviyesinde şifrelenmesinin değerlendirilmesi (transkript, telefon)
- [ ] Güvenlik başlıkları ve CSP, hız sınırlama (giriş, webhook), Retell IP izin listesi (opsiyonel ek katman)
- [ ] Aydınlatma metni şablonu, DPA şablonu, alt işleyenler listesi (Retell, Neon, Vercel, Netgsm, Resend)
- [ ] Avukat incelemesi (ürün ekibi)
- [ ] Güvenlik incelemesi (`/security-review`) ve bağımlılık taraması

---

## F8: Production (Vercel, Neon, izleme)

- [ ] GitHub reposu ve push (ürün ekibi repoyu açar)
- [ ] Vercel projesi (**RECALL** takımı, `recall25`), bölge `fra1`, Git bağlantısı
- [ ] Neon (Vercel Marketplace, Frankfurt): koşulları ürün ekibi onaylar; preview dalları için Neon branch'leri
- [ ] Env değişkenleri (production ve preview ayrı Retell anahtarı veya ajan öneki ile)
- [ ] Retell webhook ve inbound URL'lerinin production alan adına yönlendirilmesi; preview ortamları için ayrı test ajanları
- [ ] Alan adı, Sentry, uptime izleme (`/api/health`), Vercel Cron
- [ ] CI: entegrasyon testleri (PGlite) ve build; `main` koruması

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

1. **Retell hesabı:** Hesap açıldı mı? API anahtarı ne zaman paylaşılabilir? Hangi plan?
2. **Klinik oluşturma:** Klinikler sadece Recall ekibi tarafından mı açılacak (konsol), yoksa klinikler kendi kendine kayıt olabilecek mi?
3. **Panel özelleştirme kapsamı:** Hangi seviyede olmalı? Modül gizleme, özel roller, kişisel tercihler, klinik logosu? Klinik bazında renk değişimi DESIGN.md ile çelişir; istenmiyor varsayıyoruz.
4. **Giriş yöntemi:** E-posta + parola mı, sihirli bağlantı mı, ikisi birden mi? Telefon/SMS ile giriş isteniyor mu?
5. **Panel dili:** Yalnızca Türkçe mi? İleride İngilizce gerekecek mi (i18n altyapısı şimdi kurulmalı mı)?
6. **Netgsm:** Hesap var mı? SIP trunk ve SMS başlığı (originator) onaylı mı? Karşılaştırmaya alınacak diğer sağlayıcılar (Verimor vb.)?
7. **Görsel varlıklar:** Logo, hero görseli ve marka kılavuzu var mı? DESIGN.md'de "yüksek çözünürlüklü soyut görsel" isteniyor.
8. **E-posta gönderimi:** Davetler için Resend uygun mu, alan adı hazır mı?
9. **Erişilebilirlik:** DESIGN.md'deki Zinc-500 gövde metni Zinc-100 zeminde AA kontrast eşiğinin biraz altında. Önerilen kullanım kurallarını (F4.1) onaylıyor musunuz?
10. **Kayıt dinleme:** Paneldeki ses kayıtlarını hangi roller dinleyebilir?
