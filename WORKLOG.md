# WORKLOG: Recall Çalışma Günlüğü

> **Agent'lar ve geliştiriciler için:** Bu dosya projede yapılan her işin kronolojik kaydıdır.
> İşe başlamadan önce **"Güncel durum"** bölümünü ve [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) belgesini oku.
> İşini bitirdiğinde **en üste** yeni bir kayıt ekle ve "Güncel durum" bölümünü güncelle. Kayıt eklemeden oturum bitmiş sayılmaz.

---

## Güncel durum

> **Projenin güncel durumunun tek yetkili kaynağı bu tablodur.** Planın faz tablosu ve eski raporlar tarihli özetlerdir. _Son güncelleme: 2026-10-08._

| Konu                | Durum (2026-10-08)                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aşama               | Geliştirme. Hiçbir klinik kullanmıyor; production'da yalnızca demo klinik ve test verisi                                                                                                                                                                                                                                                                                                                                                        |
| Production          | https://recalltr.company (Vercel Hobby, `fra1`), Neon **`production`** dalı (`sslmode=verify-full`), 16 migration (`0000`–`0015`). GitHub reposu **özel**; `main` korumalı (CI `check` + `e2e` zorunlu); iş dalı → `pnpm ci:wait` → `main`'e fast-forward = deploy; build ajanları senkronlar                                                                                                                                                   |
| Sesli asistan       | Retell, `claude-4.5-haiku` + `eleven_flash_v2_5`. Arayan kimliği kuralları ([ADR-011](docs/decisions/ADR-011-caller-identity.md)), istenen saat sözlü (`requestedTime`), sonuç iddiası kuralı. **Retell kredisi bitti (2026-10-08): yüklenene kadar production asistanı arama alamaz**                                                                                                                                                          |
| Ses değerlendirmesi | `pnpm voice:eval`, 26 senaryo, profiller (`baseline`, `option-a`, `option-c-gemini`, `option-c-gpt`); ilk koşu 12/24 (kredi bitti). Gecikme hedefin üstünde; A onaylandı (env arkasında, kapalı), ölçüm ve model kararı kredi yüklenince ([ADR-003](docs/decisions/ADR-003-llm-model.md), [VOICE-EVAL.md](docs/02-voice-agent/VOICE-EVAL.md))                                                                                                   |
| SMS                 | Gönderim her ortamda kapalı (`SMS_SENDING_ENABLED` yok, Netgsm yok). Tüm SMS'ler bildirim kaydından geçer (tek yol, testli)                                                                                                                                                                                                                                                                                                                     |
| Takip               | V0 + V1 production'da; demo klinikte açık                                                                                                                                                                                                                                                                                                                                                                                                       |
| Güvenlik            | Hız sınırları (Postgres), webhook tekrar koruması, CSP, kritik denetim kaydı, bileşik kiracı FK'leri, `pnpm audit` CI'da. 2026-10-08 denetimi ([PRELAUNCH-AUDIT-2026-10-08.md](docs/reviews/PRELAUNCH-AUDIT-2026-10-08.md)) sonrası: Better Auth HTTP uç noktaları kapalı (organizasyon silme kilitlenmesi giderildi), iptal/erteleme tekrar güvenli, arama ve randevu sınırları (`limits`), KVKK silmesi tüm numaralarda, Retell silme kuyruğu |
| Gizli değerler      | **Rotasyon yapıldı (2026-10-09):** Neon production parolası yenilendi, dev dalı ayrı parolada, Retell anahtarı yenilendi ve eskisi silindi; hepsi doğrulandı. Kalan: yedek dalların silinmesi, ayrı dev Retell çalışma alanı, lokal sırlar ([SECRET-ROTATION-2026-10.md](docs/06-operations/SECRET-ROTATION-2026-10.md))                                                                                                                        |
| Testler             | 453 Vitest testi (action testleri dahil) + 22 Playwright testi (9 akış, 13 sayfada erişilebilirlik). CI yeşil (check + E2E)                                                                                                                                                                                                                                                                                                                     |
| İzleme              | `/api/health`, `/api/health/jobs` (iş kalp atışı), `ALARM` logları; Sentry kodu hazır (DSN yok), uptime hesabı yok                                                                                                                                                                                                                                                                                                                              |
| Lokal               | Neon **`dev`** dalı (ayrı parola); Retell **Recall Dev** çalışma alanı (ayrı anahtar ve kredi; production anahtarı lokalde yok); `pnpm dev` + `pnpm dev:tunnel`; E2E kendi bellek içi veritabanıyla                                                                                                                                                                                                                                             |
| Karar günlüğü       | [HARDENING-2026-10.md](docs/HARDENING-2026-10.md) (Ekim 2026 sağlamlaştırma), [IMPLEMENTATION-PLAN.md → Alınan kararlar](docs/IMPLEMENTATION-PLAN.md#alınan-kararlar)                                                                                                                                                                                                                                                                           |

### Ürün ekibinden beklenenler

1. Retell kredisi yükle (production asistanı ve ses değerlendirmesi buna bağlı).
2. Gizli değer rotasyonunu onayla (Neon production parolası, Retell anahtarı).
3. Sentry ve uptime hesapları ([MONITORING.md](docs/06-operations/MONITORING.md)); isteğe bağlı `DEMO_REQUEST_NOTIFY_EMAIL`.
4. Retell kredisi yüklenince A/C ölçümünün sonucuna göre model kararı (ADR-003), logo ve hero görseli, alan adı taşıma tarihi ([DOMAIN-MIGRATION.md](docs/06-operations/DOMAIN-MIGRATION.md)).
5. Daha sonra: şirket bilgileri, yasal metinler ve avukat/İYS incelemesi, Netgsm (F2), Vercel Pro ve ücretli Neon.

### Dallar

Yalnızca `main` (birleşmiş tüm dallar silindi, 2026-10-08). Neon'da yalnızca `production` ve `dev` dalları var; 6 eski yedek dal (eski parolayı taşıyorlardı) ürün ekibi onayıyla 2026-10-09'da silindi.

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

### 2026-10-09 · Otonom yayın öncesi sağlamlaştırma (Tier A–C) · F7, F8

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** parti başına ayrı dal · **Commit'ler:** aşağıda, parti parti

Kurallar: her yeni davranış kapalı (env/variant), canlı ayarlara dokunulmaz, arama veya kredi yok. Kararlar: [DECISIONS-TO-REVIEW.md](docs/DECISIONS-TO-REVIEW.md); sahibe kalanlar: [NEXT-STEPS-FOR-OWNER.md](docs/NEXT-STEPS-FOR-OWNER.md).

**Partiler**

- A1 · aramadan sonra işaretler (`POST_CALL_FLAGS`, kapalı): kayıtla uyuşmayan randevu/iptal/taşıma iddiası, acil durum ve tıbbi risk (Türkçe kalıplar, yanlış pozitif örnekleri), `calls.flags` (migration 0016, yalnızca ekleme), panelde rozet, `call.flagged` denetim kaydı.
- A2 · ortak numara (`VOICE_SHARED_NUMBER_CHECK`, kapalı): sesli randevunun kimin adına alındığı `appointments.booked_for_name` (migration 0017, yalnızca ekleme); farklı adlar taşıyan numarada iptal/erteleme/bulma ad, tarih ve saat ister, diğer kişilerin adı veya saati söylenmez. Testler: aile, gizli numara, yanlış ad, aynı ada birden çok randevu, kapalıyken değişmeyen davranış.
- A3 · istek anahtarlı tekillik (`VOICE_TOOL_IDEMPOTENCY`, kapalı): `tool_requests` tablosu (migration 0018, yalnızca ekleme), Retell `tool_call_id` veya tool adı + argüman özeti; atomik sahiplenme, tekrar ilk sonucu döndürür, eşzamanlı ikinci istek "işleniyor", başarısız sonuç saklanmaz, 30 günlük saklama. "Zaten iptal/taşındı" yanıtları korunur.
- A4 · kayıt bağlantısı sahipliği (her zaman açık, meşru dinlemeyi değiştirmez): istekten önce satırın klinik, sağlayıcı ve sağlayıcı arama kimliği doğrulanır; Retell'in yanıtındaki arama kimliği eşleşmezse bağlantı verilmez.
- A5 · F-01/F-02 yeniden doğrulandı: yerleşik hekim rolü aramalara, kayıtlara, geri aramalara ve dışa aktarmaya erişemiyor; hekimin panel sorguları kendi takvimine daralıyor. Eksik testler eklendi (açık bulunamadı, kod değişikliği yok).
- A6 · `/api/health/jobs` için isteğe bağlı `HEALTH_JOBS_TOKEN` (tanımsızken değişiklik yok): anonim istek yalnızca durumu alır, ayrıntı için `x-health-token`; sabit zamanlı karşılaştırma `secretMatches()`; `cache-control: no-store`.
- A7 · denetim politikası: [AUDIT-POLICY.md](docs/05-compliance/AUDIT-POLICY.md); `AUDIT_STRICT` (kapalı) hasta, randevu, onay ve ayar kayıtlarını kritik yapar; olağan başarısızlıklar `metric: audit_write_failed` ile işaretli.
- A8 · salt okunur "Kullanım ve sınırlar" sayfası (`PANEL_LIMITS_VIEW`, kapalı): sınırlar ve bugünkü kullanım (ses dakikası, aramalar, asistan randevuları); yalnızca `billing.read` (sahip, yönetici); düzenleme Recall ekibinde.
- A9 · prompt güçlendirme (`VOICE_PROMPT_HARDENING`, hiçbir yerde açık değil): değişmez güvenlik bölümü başta, tam "yüz on ikiyi arayın" ifadesi, kayıt itirazı ve sistem hatası kuralları, klinik metni uzunluk ve karakter denetimiyle çitlenmiş güvenilmeyen veri, örnek ad/numara yok. Yeniden düzenleme sonrası bugünkü prompt bayt bayt aynı (8 kombinasyon); testler iki temel varyantta güçlendirilmiş hâli de koşuyor; `option-hardening` değerlendirme profili (çalıştırılmadı).
- A10 · eksik testler: tam izin matrisi (her kaynak ve eylem × 4 rol, 148 durum), panel sorgu aileleri için kiracı izolasyonu (randevu, hasta, dışa aktarma, arama, geri arama, sesli arama, kullanım), her Retell rotasında imza gövdeden önce (imzasız bozuk JSON 401, imzalı 400), bilinmeyen/uyuşmayan ajan 404, aynı slot için eşzamanlı iki randevudan biri, geçmiş ve çok ileri tarih, saat dilimi (İstanbul sabit, Berlin yaz saati, gece yarısı), Türkçe ad ve telefon biçimleri. KVKK silmesi uçtan uca ve cron yetkisi önceki partilerde testli.
- B1 · CI tedarik zinciri: tüm action'lar commit SHA'sına sabitlendi (sürüm yorumuyla), iş akışı izni `contents: read`, `pull_request_target`/secret kullanımı yok; bunları denetleyen test.
- B2 · CI açıklamalarında kişisel görünümlü veri maskelenir (`scripts/redact-log.mjs`: telefon, e-posta, anahtar, bağlantı dizesi, yetki başlığı); Playwright raporu 3 gün saklanır.
- B3 · güvenlik başlıkları canlıda doğrulandı (CSP, frame-ancestors, DENY, referrer, HSTS, nosniff, oturum ve dinamik sayfalarda no-store); hata sayfaları ayrıntı göstermiyor; CSV dışa aktarma yok. Değişiklik gerekmedi; başlıkları sabitleyen test eklendi.
- B4 · bağımlılıklar: `pnpm audit --prod` (1 orta: esbuild, yalnızca geliştirme sunucusu); kütüphaneler güncellendi (dotenv 18.0.6, lucide-react 1.53.0, retell-sdk 6.2.4, @sentry/nextjs 11.5.0); çatı güncellemesi ayrı partide; büyük sürümler (TypeScript 7, ESLint 10, @types/node 26) yalnızca listelendi.
- B5 · `pnpm lint:secrets` (CI adımı: HEAD'deki izlenen dosyalarda gizli değer benzeri dize varsa başarısız; değerler maskelenir) ve `pnpm review:package` (git archive + tarama raporu, `outputs/`, hiçbir yere gönderilmez); `NEXT_PUBLIC_` değişkeni yok.
- B6 · belgeler koda göre: `DEMO_REQUEST_NOTIFY_EMAIL` DEPLOYMENT'ta, ADR-003'e güçlendirme profili ve kademeli ölçüm, eskimiş plan maddeleri tarihli notla işaretlendi (F1.8 elle 20 senaryo, ASR/TTS karşılaştırması, `voice:attach-number`); her env değişkeninin belgelendiğini denetleyen test. COST-MODEL C7'de.
- C1 · izleme: Sentry olay metinlerinde telefon/e-posta/anahtar maskeleme (CI ile aynı kurallar, eşlik testi); MONITORING.md'ye sağlık sözleşmesi, alarm ve log uyarı listesi, isteğe bağlı `HEALTH_JOBS_TOKEN` adımları. Sentry `SENTRY_DSN` olmadan kapalı.
- C2 · [BACKUP-RESTORE.md](docs/06-operations/BACKUP-RESTORE.md): bugünkü durum (Free, 6 saat), Launch önerisi ve maliyet tahmini (kaynaklı), RPO/RTO, geri yükleme provası ve gerçek geri yükleme adımları; `pnpm db:export` (yalnızca dev, veri yazdırmaz); `outputs/` .gitignore'da; dev veritabanı güncel migration'lara getirildi.
- C3 · [INCIDENT-RESPONSE.md](docs/06-operations/INCIDENT-RESPONSE.md) (dereceler, roller, Retell/LLM/ElevenLabs/Neon/Vercel senaryoları, KVKK 72 saat akışı, Türkçe bildirim şablonları, olay kaydı şablonu) ve [SUPPORT-PROCESS.md](docs/06-operations/SUPPORT-PROCESS.md) (kanallar, yanıt hedefleri, sık talepler, KVKK talepleri, triage).
- C4 · [CLINIC-ONBOARDING.md](docs/07-sales/CLINIC-ONBOARDING.md): ön koşullar, keşif bilgileri, konsol ve panel adımları (bugünkü ekranlara göre), numara ve asistan, 8 test senaryosu, yönlendirme, canlıya geçiş, ilk hafta, pilot anahtar önerisi, ayrılma.
- C5 · [PHONE-LINE-OPTIONS.md](docs/07-sales/PHONE-LINE-OPTIONS.md): Retell'in özel SIP gereksinimleri (resmî belge), Verimor ve Netgsm seçenekleri ve kaynaklı fiyatlar, doğrulanmamış noktalar işaretli, maliyet varsayımları, öneri ve ilk görüşme için 10 soru.
- C6 · [docs/legal-drafts/](docs/legal-drafts/README.md) (hepsi TASLAK, yayınlanmadı): avukat brifi (19 soru), Mermaid veri akışı ve alt işleyen tablosu, KVKK aydınlatma metni (klinik adına), Recall gizlilik politikası, klinik hizmet koşulları, DPA iskeleti, görüşme başı anons metni; taslak işaretini ve yayınlanmadığını denetleyen test.
- C7 · [COST-MODEL.md](docs/06-operations/COST-MODEL.md) ölçülen değerlerle yeniden yazıldı: dakika başı 0,120 $ liste / 0,153 $ faturalanan, ADR-003 seçenekleri, SIP/SMS/e-posta/Sentry/Neon/Vercel kalemleri, klinik başı 3 senaryo ve hassasiyet (hepsi varsayım); PRICING.md'ye taban fiyat notu.
- C8 · değerlendirme kademeli: `--stage 1` (baseline + Gemini Flash ≈ 9,65 $), `--stage 2` (≈ 14,53 $), `--profiles`, `--budget`; bütçe, kredi bitti (402) ve Ctrl+C durumunda temiz durur, dev ajanı her durumda env ayarlarına döner. `--plan` maliyetleri VOICE-EVAL.md'de. Arama yapılmadı, kredi harcanmadı.

### 2026-10-09 · Gizli değer rotasyonu · F8

**Agent/kişi:** Claude (Opus 5.5) + ürün ekibi · **Dal:** `docs/rotation-done` · **Commit'ler:** bu kayıt

**Ne yapıldı** (değerleri ürün ekibi girdi; hiçbiri yazdırılmadı)

- Neon production parolası yenilendi, Vercel güncellendi, yeniden deploy. Eski parola production'da reddediliyor (`28P01`); `/api/health` → `db: ok`; imzalı webhook veritabanı yolu çalışıyor.
- Neon dev dalı parolası ayrıldı; yeni lokal parola dev'i açıyor, production'da reddediliyor.
- Retell: yeni anahtar oluşturuldu, webhook anahtarı yapıldı, Vercel güncellendi, yeniden deploy, eski anahtar silindi. Yeni anahtarla imzalı istek doğrulamayı geçiyor, yanlış anahtar 401.
- `.env.local` 14. satırda eksik `=` düzeltildi (değer gösterilmeden).

**Açık kalanlar / dikkat**

- Retell'in webhook'ları yeni anahtarla imzaladığı ilk gerçek test aramasında görülecek (kredi gerekiyor).
- Yedek dallar (eski parola, uç noktası yok) duruyor; silme onay bekliyor. Ayrı dev Retell çalışma alanı açılana kadar lokal dosya production anahtarını taşır.

### 2026-10-08 · Yayın öncesi denetim ve düzeltme partileri · F7, F8

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** parti başına ayrı dal · **Commit'ler:** bu kayıt ve sonrakiler

**Ne yapıldı**

- Salt okunur yayın öncesi denetim: [PRELAUNCH-AUDIT-2026-10-08.md](docs/reviews/PRELAUNCH-AUDIT-2026-10-08.md) (Manus bulgularının doğrulanması, bağımsız bulgular, canlı yapılandırma, proje durumu).
- Ürün ekibi repoyu özel yaptı; `pnpm ci:wait` artık kimlikli istek atar (`GITHUB_TOKEN` veya git'in kayıtlı kimliği).
- Onaylanan düzeltmeler, her biri ayrı dal ve yeşil CI ile `main`'e:
  - P-04 (`9803fdb`): Better Auth'un herkese açık uç noktaları kapatıldı (yalnızca `ok`, `get-session`), engellenen istekler loglanır ve oturum varsa denetime yazılır. Test, API ile organizasyon silmenin tüm üyeleri silip kliniği kilitlediğini gösterdi; adaptör artık transaction kullanır ve organizasyon silme her zaman reddedilir. Production'da doğrulandı (yazma uç noktaları 404).
  - P-11 (`c111f74`): başarılı iptal/erteleme isteğinin tekrarı "bulunamadı" yerine yapılan değişikliği döndürür.
  - P-08 (`990dc10`): klinik ayarlarında `limits` (yalnızca Recall ekibi): numara/gizli numara/klinik başına arama, günlük ses dakikası (ret + alarm), arama süresi, arama ve numara başına randevu.
  - P-09, P-10: KVKK silmesi `call_patients` bağlarıyla tüm numaralardaki aramaları siler; Retell silmesi kalıcı kuyrukta (migration 0015).
- Gizli değer rotasyonu planı genişletildi (dev ayrımı, yedek dallar, ayrı Retell çalışma alanı, IP kısıtı için gereken ücretli katmanlar). "Başla" onayı bekleniyor.

**Açık kalanlar / dikkat**

- Migration 0015 yalnızca ekleme yaptığı için yedek dal açılmadı (Neon 6 saatlik PITR; 10 dalın 8'i dolu).
- Konsolda `limits` düzenleme ekranı yok; şimdilik varsayılanlar geçerli, değişiklik veritabanından.

### 2026-10-08 · Dış inceleme paketi temizliği · F8

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `chore/review-package-cleanup` · **Commit'ler:** bu kayıt

**Ne yapıldı**

- Dış inceleme paketi (`git archive HEAD`) tarandı: gerçek anahtar, token, parola veya bağlantı dizesi yok; `.env*` dosyalarından yalnızca `.env.example` izleniyor.
- Seed, testler, test fixture'ları ve E2E veritabanındaki gerçek görünümlü cep numaraları açıkça sahte `0532 000 00 NN` aralığına taşındı. Prompt'taki okuma örneği ("0532 123 45 67") canlı asistanın metni olduğu için değişmedi.
- VOICE-AND-LANGUAGE.md'de test aramasından alıntılanan ad uydurma bir adla değiştirildi.

### 2026-10-08 · ADR-003 seçenek A hazırlığı ve C test profilleri · F1.8

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `feat/F1.8-latency-option-a` · **Commit'ler:** bu kayıt

**Ne yapıldı**

- Ürün ekibi seçenek A'yı onayladı. Kısa prompt (`VOICE_PROMPT_VARIANT=compact`, aynı kurallar, demo klinikte −%24) ve Retell sıra alma ayarları (`RETELL_DYNAMIC_RESPONSIVENESS`, `RETELL_RESPONSIVENESS`, `RETELL_INTERRUPTION_SENSITIVITY`) env arkasında; varsayılanı kapalı, tanımsız ayar Retell'e gönderilmez (deploy aramaları değiştirmez, testli).
- Prompt testlerinin tamamı iki varyantta da koşuyor.
- `pnpm voice:eval --profile <id>` ve `--plan`: `baseline`, `option-a`, `option-c-gemini`, `option-c-gpt`; profil yalnızca dev ajanını koşu süresince değiştirir. İki yeni sıra alma senaryosu (yavaş konuşan, tereddütlü arayan): toplam 26.
- ADR-003'e karar, ayar tablosu, ölçüm ve geri alma planı.

**Açık kalanlar / dikkat**

- Ölçüm yapılmadı (Retell kredisi bekleniyor). Production'da A ayarları kapalı; açmak ölçümden sonra.
- Retell `responsiveness` zaten en hızlı değerinde (1); A'nın kazancı büyük ölçüde prompt kısalmasından gelecek ve muhtemelen küçük. Hedef için C'nin ölçümü belirleyici.

### 2026-10-08 · Dal tabanlı yayın akışı · F8

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `chore/branch-flow` · **Commit'ler:** bu kayıt

**Ne yapıldı**

- Ürün ekibi `main` korumasını açtı (`check` + `e2e` zorunlu). CI artık her dal push'unda çalışıyor; `pnpm ci:wait` bir commit'in kontrollerini bekleyip sonucu çıkış koduyla veriyor.
- Vercel preview deploy'ları kapatıldı (`vercel.json` → `git.deploymentEnabled`): dal push'ları yalnızca CI'ı çalıştırır, yalnızca `main` deploy edilir.
- Yayın süreci [DEPLOYMENT.md](docs/06-operations/DEPLOYMENT.md#yayın-süreci-2026-10-08den-beri-dal-tabanlı) ve CLAUDE.md'de dal tabanlı akışa göre yeniden yazıldı; karar günlüğüne 33. madde.

**Açık kalanlar / dikkat**

- Koruma "pull request zorunlu" olarak ayarlanırsa doğrudan fast-forward push reddedilir; o durumda PR üzerinden birleştirilir (bu dal ilk denemedir).

### 2026-10-08 · Sağlamlaştırma: arayan kimliği, CI, SMS tek yol, güvenlik, izleme, testler, ses değerlendirmesi · F1.8, F3.6, F5.5, F7, F8

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `main` (iş dalları fast-forward, sonra silindi) · **Commit'ler:** `e54449c` … `a4602a2`

**Ne yapıldı** (ayrıntı ve gerekçeler: [HARDENING-2026-10.md](docs/HARDENING-2026-10.md))

- Arayan kimliği: söylenen numarayla başkasının randevusuna erişim kapandı; production'da saldırgan ve gerçek hasta aramalarıyla doğrulandı ([ADR-011](docs/decisions/ADR-011-caller-identity.md)).
- CI ilk kez yeşil (typecheck `next typegen` ister); build ve E2E job eklendi.
- Tüm SMS'ler bildirim kaydından geçer; doğrudan gönderim yolu kaldırıldı.
- Güvenlik: Postgres hız sınırları, webhook tekrar koruması, geri arama tekilliği ve saklama, CSP, kritik denetim kaydı, klinik metni temizliği, bileşik kiracı FK'leri (0013), açık yönlendirme, `pnpm audit` + Dependabot, güvenlik incelemesi.
- İzleme: iş kayıtları ve kalp atışı (0014), alarmlar, Sentry kodu.
- Testler: action testleri (rol × eylem × kiracı), Playwright E2E ve erişilebilirlik.
- Ses: 24 senaryoluk değerlendirme, `requestedTime`, sonuç iddiası kuralı, ad normalizasyonu.
- Panel: sütun sıralama, demo talebi e-postası (isteğe bağlı).
- Belgeler: Neon dal adları, yayın süreci, alan adı taşıma, gizli değer rotasyon planı, plan kutuları, ADR-003.

**Açık kalanlar / dikkat**

- Retell kredisi bitti; production asistanı ve kalan 12 senaryo bekliyor.
- Gizli değer rotasyonu onay bekliyor.
- CI E2E: testler geçiyordu, Linux'ta test veritabanı sunucusu kapanmadığı için iş asılı kalıyordu; durdurma düzeltildi, hata özetini annotation olarak yayınlayan adım duruyor.

### 2026-10-07 · Production DATABASE_URL `sslmode=verify-full` · F8

**Agent/kişi:** Claude (Opus 5.5) + ürün ekibi · **Dal:** `docs/db-sslmode` · **Commit'ler:** bu kayıt

**Ne yapıldı**

- Önce test: pg sürücüsü `verify-full` ile aynı Neon proxy'sine (`c-5.eu-central-1.aws.neon.tech`) pooled ve direct bağlandı, sertifika ve ana makine doğrulandı; lokal uygulama sağlıklı.
- Ürün ekibi Production `DATABASE_URL`'i Neon'dan alıp `sslmode=verify-full` ile Vercel'e yazdı ve yeniden deploy etti (`recall-6rzhihhas`).
- Doğrulama: READY; `/api/health` ok; imzalı `check_availability` 200 (6 slot); cron sırsız 401, konsoldan elle çalıştırma 200 (`planned 0`, gönderim 0); SSL uyarısı kayboldu, hata yok.

**Geri alma:** `recall-hhxcah0ry`'yi promote et, sonra `DATABASE_URL`'i `sslmode=require` ile geri yaz.

### 2026-10-07 · İlk günlük bildirim çalışması doğrulandı · Takip V0

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `docs/cron-hobby-window` · **Commit'ler:** bu kayıt

**Ne yapıldı**

- `/api/cron/notifications` 07:44:27 UTC'de çalıştı, 200 döndü, klinik hatası yok.
- `notifications`: yarınki 3 randevu için 3 satır planlandı ve `skipped(sending_disabled)` oldu; bugünkü 09:00 randevusu `skipped(too_late)`. Gönderilen yok (provider, sent_at, mesaj id boş). Takip hatırlatması yok (onay ve klinik ayarı kapalı).
- Belgeler: Hobby'de cron tanımlı saatin içinde herhangi bir dakikada başlar (DEPLOYMENT, NOTIFICATIONS).
- Ürün ekibi production'da demo klinikte Takip'i konsoldan açtı (denetim kaydında `platform.feature_changed`).

**Açık kalanlar / dikkat**

- ~~`pg` SSL-mode uyarısı~~ giderildi (aşağıdaki kayıt).
- Yedek dal `backup-pre-0009-2026-10-07` silinebilir (ürün ekibi kararı).

### 2026-10-07 · Takip V1 production'a çıktı; belirsiz kelime gerçek aramayla doğrulandı · Takip V1, F1.8

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `main` (ff `feat/V1-takip`) · **Commit'ler:** `160e205`, bu kayıt

**Ne yapıldı**

- Birleştirilmiş `main` üzerinde lint, lint:tokens, typecheck, test (326/326) çıkış koduyla 0.
- Migration'dan önce production yedeği: Neon dalı `backup-pre-0009-2026-10-07` (`br-tiny-king-b16e6let`, compute yok, 9 migration'lı hâl).
- Deploy `160e205` READY. `/api/health` ok; 10 migration; Takip tabloları boş; Takip açık klinik sayısı 0; `SMS_SENDING_ENABLED` ve `NETGSM_*` hiçbir ortamda yok; cron sırsız 401.
- "Şimdi güncelle" sonrası gerçek arama ("Diş beyazlatma için çekim Perşembe…"): asistan "yalnızca diş beyazlatma mı, diş çekimi de mi?" diye sordu; hangi Perşembe olduğunu sordu; müsaitlikten sonra saat verdi. DB'de yalnızca bir yeni randevu (8 Ekim 14:00 beyazlatma), hasta tekrarı yok.

**Açık kalanlar / dikkat**

- Yedek dal, 0009 bir süre sorunsuz çalıştıktan sonra silinebilir (ürün ekibi kararı).
- Asistan adı küçük harfle tool'a geçirdi ("deneme test"); mevcut hasta telefonla eşleştiği için kayıt değişmedi. İzlenecek.

### 2026-10-07 · Takip V1 (yerel dal, production'a çıkmadı) ve sesli asistan düzeltmeleri · Takip V1, F1.8

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `feat/V1-takip` (yerel, push edilmedi) · **Commit'ler:** `b14f6ad` … `8dac7b8`, bu kayıt

**Ne yapıldı**

- **Sesli asistan** (önceki adımlarda production'a çıktı: `8e0ab07`, `b24075f`):
  - hizmeti tahmin etmez, belirsiz kelimede sorar;
  - hasta açıkça istemedikçe tek randevu alır;
  - availability kontrolünden önce saat söylemez;
  - sunucu tarafında `PATIENT_BUSY` koruması var.
  - Production'da iki gerçek aramayla doğrulandı: yalnızca istenen randevu kaydedildi.
  - "çekim" kelimesini sormak yerine yok saydığı görüldü; kural güçlendirildi (`b14f6ad`, V1 ile çıkacak).
- **Test altyapısı:** `accounts.test.ts` kararsızlığının kökü bulundu ve giderildi (`2d74425`):
  - üç dosya kurulum zaman aşımını 30 sn'ye düşürüyordu;
  - her dosya tüm migration'ları paralel uyguluyordu.
  - Artık bir kez migrate edilip snapshot'tan yükleniyor; çalışma süresi 20–36 sn'den 13–15 sn'ye indi.
- **Takip V1** ([TAKIP.md](docs/proposals/TAKIP.md), karar günlüğü 24 madde):
  - migration 0009 (bileşik FK'ler);
  - alan mantığı ve eşleştirme;
  - günlük işte stub takip hatırlatmaları;
  - KVKK genişlemeleri;
  - izinler ve denetim;
  - Takip sekmesi, plan detayı, kural editörü, randevu ve hasta sayfasından takibe alma, "SMS istemiyor", konsol modül anahtarı.

**Doğrulama**

- `pnpm test`: 326/326; lint, tokens, typecheck temiz.
- Tarayıcı (dev, `claude@gulus.test`): örnek kurallar, kural editörü önizlemesi, randevudan takibe alma, "otomatik sayıldı" + "Gelmedi", randevusuz ziyaret, liste ve ön doldurmalı randevu. Bulunan sayfa yenilenmeme hatası düzeltildi.

**Açık kalanlar / dikkat**

- V1 production'a çıkmadı. Push = deploy; 0009 yalnızca ekleme yapar (testli).
- İlk günlük bildirim işi 7 Ekim 07:00 UTC'de; kontrol 10:30 İstanbul'a zamanlandı.
- Dev'de Takip açık (`gulus-dis`); test planı ve örnek kurallar dev verisinde.

### 2026-10-06 · Takip V0: bildirim kaydı, randevu hatırlatma (stub), SMS kilitleri · Takip V0

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `feat/V0-bildirimler` (yerel, **push edilmedi**; ürün ekibi onayı bekleniyor) · **Commit'ler:** bu kayıt

**Ne yapıldı**

- Tasarım: [docs/proposals/TAKIP.md](docs/proposals/TAKIP.md), V0 onayı ve ek kararlar.
- **Migration 0008** (yalnızca ekleme):
  - `notifications` tablosu ve 3 enum;
  - `patients.sms_opt_out_at`;
  - `patients (clinic_id, id)` tekil indeksi;
  - bileşik FK `notifications (clinic_id, patient_id)`, `ON DELETE SET NULL (patient_id)`, elle yazıldı. Dev dalına uygulandı.
- **`domain/notifications.ts`:**
  - planlama: ertesi günün aktif randevuları; bugünün planlanmamış randevuları `skipped(too_late)`;
  - gönderim: klinik başına, 09–20 penceresi, `SKIP LOCKED`, en fazla bir kez, takılan gönderim `unknown`, 3 deneme;
  - sınırlar: klinik başına günde 100, hasta başına günde 1;
  - günlük iş klinikleri birbirinden yalıtır.
- **SMS kilitleri:**
  - `SMS_SENDING_ENABLED` (yalnızca `"true"` açar; production'da tanımsız);
  - `smsProvider()` anahtar kapalıyken Netgsm'i hiç kurmaz;
  - sağlayıcı `delivers`;
  - kliniğin hatırlatma ayarı.
- **Cron:** `/api/cron/notifications` (07:00 UTC). İki cron ortak `rejectUnauthorizedCron` kullanıyor (sabit zamanlı karşılaştırma, secret yoksa 503).
- **KVKK:**
  - SMS metinlerinden hasta adı ve hizmet çıkarıldı;
  - anonimleştirme bildirimleri ayırır, bekleyenleri atlar;
  - dışa aktarmada `bildirimler`;
  - saklama: bildirim kaydı 1 yıl (hukuki inceleme bekliyor).
- Randevu kuralları ayarında saat alanı yerine dürüst açıklama: bir gün önce, 10:00; SMS henüz etkin değil.

**Doğrulama**

- `pnpm test`: 289/289 (24 dosya). İlk çalıştırmada `accounts.test.ts` dosya düzeyinde bir kez düştü, tekrar çalıştırmada geçti; paralel PGlite yükünde hook zaman aşımı olabilir, izlenecek.
- Yeni testler:
  - `notifications.test.ts` (18): idempotency, too_late, kilitler, tek gönderim, yeniden deneme, unknown, pencere, sınırlar, kiracı izolasyonu (bileşik FK reddi dahil), iş yalıtımı, anonimleştirme;
  - `production-safety.test.ts` (30): migration yalnızca ekleme, ana anahtar, şablonlarda ad ve hizmet yok, cron 401/503.
- Vercel: `SMS_SENDING_ENABLED` hiçbir ortamda tanımlı değil; production `SMS_PROVIDER=console`.

**Açık kalanlar / dikkat**

- `main`'e push = production deploy. Ürün ekibi onaylayınca birleştirilecek.
- İlk production çalıştırmasında tüm hatırlatmalar `skipped(sending_disabled)` kaydedilir; bu beklenen davranış.

### 2026-10-06 · Ses seçimi, KVKK veri saklama, özel roller · F5.3, F7, F3.5

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `feat/F5.3-ses-secimi`, `feat/F7-veri-saklama`, `feat/F3.5-ozel-roller` · **Commit'ler:** `27f3098`, `935ad2d`, `1cfd7ef`, bu kayıt

**Ne yapıldı**

- **Ses seçimi** (Ayarlar → Asistan → Ses):
  - kadın ve erkek sesleri, örnek dinleme, Recall varsayılanı;
  - kaydedince asistan yeniden senkronlanır;
  - yalnızca paylaşılan TTS modelinin sağlayıcısındaki (ElevenLabs) sesler listelenir, sunucu da seçimi kontrol eder;
  - yerel ad etiketleri ve tekrarlar temizlendi; liste 1 saat önbellekte.
- **KVKK veri saklama:**
  - Günlük cron (`/api/cron/retention`, `CRON_SECRET` Vercel'e doğrudan üretildi): kayıt bağlantısı 30 gün, döküm 90 gün, arayan numarası 2 yıl.
  - Retell ajanları 30 günde kendi verisini siler. Kayıt bağlantıları imzalı ve süreli; panel her dinlemede yeni bağlantı alır.
  - "Kayıt kapalı" seçiliyse arama, analiz bize ulaşınca Retell'den silinir.
  - Anonimleştirme Retell'deki sesi de siler.
  - Hasta "Verileri indir" (JSON), yeni `patients.export` yetkisiyle (sahip, yönetici); her indirme denetim kaydına yazılır.
  - Production ajanına saklama ayarları doğrudan uygulandı.
- **Özel roller** (Ayarlar → Ekip → Özel roller):
  - yalnızca klinik verisi yetkileri; her işlem "görüntüle"yi de açar;
  - ad oluşturulduktan sonra sabit; kullanımdaki rol silinemez;
  - davet ve rol değiştirmede seçilebilir;
  - e-posta ve davet sayfasında rol adı düzgün görünür;
  - "Bugün" sayfası arama yetkisi olmayana arama sayısını göstermez.

**Neden**

- Retell'in `basic_attributes_only` ayarı gerçek aramayla denendi: Retell'de hiçbir şey saklamıyor ama webhook'tan da döküm, özet ve süreyi siliyor. Paneldeki özetler kaybolacağı için kullanılmadı; yerine analizden sonra silme.
- Özel rollerin ekip veya faturalandırma yetkisi içerememesi, bir özel rolün kendi başına erişim dağıtamaması için.

**Doğrulama**

- `pnpm test`: 241/241; lint, tokens, typecheck temiz.
- Tarayıcıda (yerel, kendi test hesabım `claude@gulus.test`):
  - ses kaydetme → DB → Retell ajanı `11labs-Grace`, sonra varsayılana geri alındı;
  - dışa aktarma 200 ve JSON;
  - cron 401 ve 200;
  - "Diş asistanı" rolüyle davet → kabul → Takvim, Randevular, Hastalar açık; Aramalar, Geri arama, Ayarlar, Ekip, Denetim, konsol 403.
- Production: cron yetkisiz isteğe 401; production ajanında saklama 30 gün ve imzalı bağlantı açık.

**Açık kalanlar / dikkat**

- Yerel test hesapları (`claude@gulus.test`, `asistan@gulus.test`) ve "diş asistanı" rolü dev DB'de; parolalar `.env.local` yorumunda.
- Dev ajanı `.env.local`'deki son tünele bakıyor; tünel kapanınca test araması ön kontrolü durumu söyler.
- Sırada: otomatik testler (Playwright E2E, server action testleri), güvenlik (hız sınırlama, CSP), izleme. En son F2 Netgsm, yasal sayfalar ve şirket bilgileri.

### 2026-10-06 · Production canlı: Vercel, Neon, alan adı, Resend, web temeli · F8, F1.8

**Agent/kişi:** Claude (Opus 5.5) + ürün ekibi · **Dal:** `fix/F1.8-sms-iddiasi`, `feat/F8-web-yayin`, `docs/F8-production` · **Commit'ler:** `1a8b916`, `81ca048`, bu kayıt

**Ne yapıldı**

- **Vercel:** proje `recall` (takım `recall25`), GitHub bağlı, `main` = production. Gizli olmayan env değişkenleri CLI ile girildi. `BETTER_AUTH_SECRET` doğrudan Vercel'e üretildi (değer kimse tarafından görülmedi). `DATABASE_URL` (Neon `production` dalı), `RETELL_API_KEY` ve `RESEND_API_KEY` ürün ekibince sensitive girildi. İlk build migration'ları uyguladı (8/8).
- **Alan adı** `recalltr.company` (Vercel'den alınmış, DNS Vercel'de) projeye bağlandı.
- **Resend** (eu-west-1): alan iki kez eklenmişti (Tokyo + İrlanda), çakışan DKIM/MX kayıtları yüzünden "invalid" idi. Eski Tokyo kayıtları silindi, DMARC eklendi, doğrulandı. Parola e-postası teslim edildi ama **spam'e düştü** (yeni alan, itibar yok).
- **Production uçtan uca:** ürün ekibi konsoldan "Recall Demo Diş Kliniği"ni açtı, asistanı oluşturdu, hekim ekledi. Gerçek Retell web araması (sentezlenmiş hasta sesi): müsaitlik → randevu `ok: true` → production DB'de randevu `scheduled`/`voice`, arama `booked`. Doğrulama Neon üzerinden salt okuma sorgusuyla.
- **Bulunan hata:** SMS `console` modundayken asistan "SMS ile bilgilendirme gönderdik" diyordu. SMS sağlayıcıları artık gerçekten teslim edip etmediklerini bildiriyor (`delivers`), handler tool'lara `smsDelivers` geçiriyor. Console sağlayıcı production'da mesaj gövdesini (hasta bilgisi) loglamıyor.
- **Web temeli:**
  - robots.txt (panel, konsol, API hariç) ve sitemap;
  - canonical, OG ve Twitter kartı;
  - DESIGN.md token'larıyla üretilmiş paylaşım görseli ve marka ikonları (Next varsayılan favicon kaldırıldı);
  - Türkçe 404;
  - güvenlik başlıkları (HSTS, frame deny, mikrofon yalnızca kendi alanımızda);
  - `www` → ana alan 308;
  - menü bağlantıları her sayfadan çalışıyor.
- Belgeler: [DEPLOYMENT.md](docs/06-operations/DEPLOYMENT.md) "Production durumu" bölümü, plan F8 kutuları.

**Neden**

- Ürün ekibi kararı: Vercel Hobby ve Neon ücretsiz şimdilik, ilk ücretli klinikten önce Pro ve ücretli Neon.
- Preview ortamına env verilmedi: preview build'leri migration çalıştırır; yanlışlıkla production DB'ye bağlanmasın.
- Bu oturumdaki Vercel MCP bağlantısı salt okunur (403); işlemler ürün ekibinin zaten oturum açık olan Vercel CLI'ı ile yapıldı. `npx vercel` bozuk, CLI global kuruldu (`npm i -g vercel@62`).

**Doğrulama**

- `pnpm test`: 230/230, lint, tokens, typecheck temiz, lokal `pnpm build` başarılı.
- Production: `/api/health` ok, robots, sitemap, `www` 308, güvenlik başlıkları ve OG etiketleri `curl` ile doğrulandı. Production gerçek arama testi geçti.

**Açık kalanlar / dikkat**

- **Yasal sayfalar** (KVKK aydınlatma metni, gizlilik/çerez politikası) için şirket bilgileri bekleniyor: ünvan, adres, KVKK başvuru e-postası.
- E-posta spam'e düşüyor: Resend'de açılma/tıklama takibini kapatmak, "Spam değil" işaretlemek, zamanla itibar.
- Alan adı otomatik yenileme kapalıydı; ürün ekibine açması söylendi.
- Vercel `link` komutu `.gitignore`'a `.env*` ekledi (`.env.example`'ı gizlerdi); geri alındı.
- Production'da test verisi: "Deneme Test" randevusu, 7 Ekim 09:00 (demo klinik).
- Asistan adı demo klinikte "Asistan" (varsayılan). Ayarlar → Asistan'dan bir isim verilmeli.

### 2026-10-05 · Test aramasında "bağlantı sorunu": kök neden ve uçtan uca randevu · F5.3, F1.8

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `fix/F5.3-test-aramasi-baglanti` · **Commit'ler:** bu kaydı içeren commit

**Ne yapıldı**

- **Kök neden 1, ölü tünel:** Ajanın tool ve olay webhook adresleri, kapanmış bir cloudflared hızlı tüneline (`…trycloudflare.com`) bakıyordu. Retell'deki iki test aramasında her `check_availability` çağrısı `ENOTFOUND` aldı, asistan "bağlantı sorunu" dedi. Çözüm:
  - [`pnpm dev:tunnel`](scripts/dev-tunnel.ts): tüneli açar, erişilebilir olunca `APP_URL`'i yazar ve ajanı olan tüm klinikleri yeni adrese senkronlar.
  - [Test araması](src/server/voice/providers/retell/test-call.ts) artık önce ajanı senkronlar (adres değiştiyse gönderir), sonra `APP_URL/api/health` ile sunucuya ulaşılabildiğini kontrol eder; ulaşılamıyorsa arama açılmaz ve panel nedenini söyler.
  - `env()` geliştirmede önbelleklenmiyor, ki `next dev` `.env.local` değişikliğini (yeni `APP_URL`) yeniden başlatmadan görsün.
- **Kök neden 2, web aramasında arayan numara:** Prompt Retell'in `{{user_number}}` değişkenini kullanıyordu; bu web aramalarında hiç dolmaz ve LLM'e ham yer tutucu olarak gider. Yerine bizim `caller_number` değişkenimiz geldi: inbound webhook doldurur, test araması boş geçer, LLM varsayılanı boş.
- **Canlı aramada bulunan iki hata:**
  - Model, numarayı doğru geri okuduğu hâlde bitişik yazarken bir rakam düşürüyordu (`0532000002`). Artık numarayı söylendiği gruplarla gönderiyor (`"0532 000 00 22"`). Geçersiz numara yeni `INVALID_PHONE` hatasını döndürüyor ve asistan numarayı tekrar istiyor (`requirePhone`).
  - Model "Randevunuz oluşturuldu" cümlesini tool çağrısıyla aynı anda söylüyordu; sonuç başarısızdı. Prompt kuralı eklendi: işlem yapan tool'un sonucu yalnızca tool döndükten sonra söylenir.
  - Ayrıca: daha önce söylenen saat tekrar sorulmuyor, onaydan sonra hemen kayıt yapılıyor, vedalaşmada ısrar edilmiyor.
- Reddedilen Retell isteği artık yalnızca anahtar adları ve hatalı yollarla loglanıyor (`retell.payload_rejected`, değer yok).

**Neden**

- Hızlı tünel adresi her açılışta değişiyor ve kapanan adres bir süre sonra hiç çözülmüyor. Ajanın adresi bizim verimizden türediği için düzeltme senkron akışında olmalıydı, elle adres güncellemede değil.
- Retell simülasyon testleri (`tests` API) çağrıda `agent_id` göndermiyor; kiracı her zaman ajandan belirlendiği için bu yol bilerek desteklenmedi (kiracı kuralını değiştirmek mimari karar).

**Doğrulama**

- **Gerçek Retell web araması**, mikrofonsuz: Windows Türkçe TTS (Tolga) ile sentezlenen hasta konuşması, headless Chrome'a sahte mikrofon olarak verildi; düzenek repoda değil. Son aramada:
  - `check_availability` → gerçek slotlar;
  - telefon geri okuma → onay;
  - `book_appointment` `ok: true`;
  - DB'de randevu `scheduled`, kaynak `voice`, aramaya bağlı; arama kaydı `outcome = booked`.
  - Önceki 3 deneme yukarıdaki hataları ortaya çıkardı.
- İmzalı tool isteği tünelin public adresi üzerinden de tekrarlandı (müsaitlik → randevu → DB).
- `pnpm test`: 229/229. lint, lint:tokens, typecheck temiz.

**Açık kalanlar / dikkat**

- Panel düğmesiyle aramayı ben tetikleyemedim: test hesabı parolasının okunması engellendi. Ön kontrol birim testli; ürün ekibi kendi tarayıcısında denemeli.
- Dün kalan iki eski `cloudflared` süreci (4 Ekim) hâlâ çalışıyor; zararsız, kapatılabilir.
- Dev verisinde "Deneme Test" adına iki test randevusu var (7 Ekim 09:00).
- Prod'da tünel yok: `APP_URL` Vercel adresi olacak (F8).

### 2026-10-05 · Test araması, tatiller, kişisel tercihler ve Recall konsolu · F5.3, F3.5, F6, ADR-010

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `feat/F5-kalanlar` · **Commit'ler:** bu kaydı içeren commit'ler

- **Retell öncelikli LLM havuzu:** fiyat sayfasında Claude modelleri için "Fast Tier" yok (yalnızca bazı GPT'lerde, fiyatı 2 katı). `RETELL_LLM_HIGH_PRIORITY=false` yapıldı, ajan senkronlandı. Flash ses ek ücretsiz. Güncel maliyet ~0,12 $/dk (ADR-003).
- **Tarayıcıdan test araması** (Ayarlar → Asistan): sunucu tek kullanımlık Retell web call token'ı üretir (`gateway` transport, ICE sunucuları); önce mikrofon izni istenir. `retell-client-js-sdk` 3.0.2'nin token tabanlı `RetellWebClient`'ı kullanılıyor (SDK 4.0'da kalkacak, geçiş gerekecek). Claude'un tarayıcı panelinde mikrofon engelli; token ve bağlantı doğrulandı, ses kısmı ürün ekibinin tarayıcısında denenecek.
- **Tatil ve izinler:** `time_off` arayüzü; tüm klinik veya hekim; tam gün veya saat aralığı; 2026–2027 resmî tatil şablonu (dini bayramlar Diyanet takvimi, arife ve 28 Ekim yarım gün); çakışan aktif randevu sayısıyla uyarı; takvimde kapalı gün notu. Müsaitlik motoru `time_off`'u zaten okuyordu (testli).
- **Kişisel tercihler** (`member_preferences`, `/panel/tercihler`): girişte açılan sayfa, takvim görünümü, varsayılan hekim filtresi. Girişten sonra `/panel/baslangic` yönlendirir.
- **F6 konsol** (`/admin`, [ADR-010](docs/decisions/ADR-010-platform-console.md)): Better Auth admin eklentisi, `platform_admin` rolü (impersonation yok), `pnpm platform:admin`. Klinik listesi ve toplamlar, yeni klinik (sektör şablonu, owner, numara; tek transaction), klinik detayı (kontrol listesi, asistan oluştur/senkronize et, numara bağla/kaldır, duraklat/aç, 30 gün metrik, ekip ekle), demo talepleri durum takibi. Hasta verisi gösterilmez. Migration `0006`, `0007` Neon dev dalına uygulandı.
- Lokal test hesapları: `sahip@gulus.test` (klinik), `konsol@recall.test` (konsol); parola `.env.local` yorumunda. Konsoldan "Deneme Fizik Tedavi" test kliniği açıldı (Retell'de gereksiz ajan açmamak için asistanı oluşturulmadı).
- Vitest `hookTimeout` 60 sn (PGlite her dosyada tüm migration'ları uyguluyor). 223 test; lint, tokens, typecheck temiz.

### 2026-10-04 · Neon geliştirme dalı ve asistan hız ayarları · F8 (hazırlık), F1.8, ADR-003

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `chore/neon-ve-hiz` · **Commit'ler:** bu kaydı içeren commit

- Ürün ekibi lokal geliştirme için Neon'u onayladı. Mevcut Neon projesinde (`falling-mud-37269187`, aws-eu-central-1) **`dev` dalı** açıldı; `.env.local` `DATABASE_URL` buna çevrildi (eski PGlite adresi yorum satırında, `DATABASE_POOL_MAX` kaldırıldı). Migrate, seed, Retell ajan bağlantısı (`voice:sync` → `updated`, yeni ajan açılmadı) ve test hesabı yeniden kuruldu. PGlite sunucusu durduruldu.
- Asistan hızı: ürün ekibi haiku'yu "bir tık daha hızlı" istedi. `RETELL_VOICE_MODEL=eleven_flash_v2_5` (ek ücret yok) ve yeni `RETELL_LLM_HIGH_PRIORITY=true` (Retell `model_high_priority`, dakika başı ek ücret) açıldı; canlı ajana senkronlandı. Ayrıntı ADR-003.
- `git stash drop` ürün ekibine bırakıldı (komut iletildi).

### 2026-10-04 · Klinik paneli ekranları, ayarlar ve ekip yönetimi · F5.2, F5.3, F5.4, F3.3, F3.5

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `feat/F5.2-randevular` · **Commit'ler:** bu kaydı içeren commit'ler

- **Randevular:** gün/hafta takvimi (hekim kolonları, hekim filtresi, ileri/geri, "şimdi" çizgisi), filtreli ve sayfalı liste (dönem, durum, hekim, kaynak, ad/telefon araması; filtreler URL'de, JS'siz çalışır), detay (durum geçişleri, iptal onayı, not), "Yeni randevu" (hizmet → hekim/fark etmez → tarih → yalnızca boş slotlar → hasta). Paneldeki randevu asistanla aynı `bookAppointment` kurallarından geçer (`source: panel`).
- **Aramalar:** liste (maskeli numara, sonuç rozeti, süre, özet), detay (özet, döküm, oluşan randevular, geri ara). Kayıt yalnızca `calls.listen_recording` ile, istek üzerine yüklenir ve her dinleme denetim kaydına yazılır.
- **Geri aranacaklar:** bekleyen/tamamlanan, tel: bağlantısı, "Arandı"/"Yeniden aç".
- **Hastalar:** arama, randevu sayısı, son/sıradaki randevu, kart, not; **KVKK anonimleştirme** (ad, telefon, notlar, o numaradan gelen aramaların numarası/dökümü/özeti/kaydı ve geri arama talepleri silinir; geri alınamaz, "ANONİMLEŞTİR" yazılarak onaylanır). Hekim yalnızca kendi hastalarını görür.
- **Ayarlar (F5.3):** klinik bilgileri, çalışma saatleri (gün başına birden çok aralık), hekimler (unvan, hizmetler, kendi saatleri), hizmetler (eş anlamlılar, süre, ₺ fiyat aralığı), asistan (ad, karşılama, fiyat/kayıt, SSS, ek talimat, talimat önizlemesi, senkron durumu, "Şimdi güncelle"), randevu kuralları ve SMS tercihleri, panel modülleri ve varsayılan takvim görünümü. Her kayıt: ortak Zod sözleşmesi → Server Action → domain → audit → yanıt sonrası asistan senkronu (`src/server/voice/sync.ts`; Retell'e özgü kod providers altında).
- **Ekip (F3.3):** davet, bekleyen davet iptali, rol değiştirme, hekim bağlama, ekipten çıkarma; yalnızca owner owner atar, son owner korunur. Better Auth hata kodları Türkçeye çevrildi. **Denetim kaydı** sayfası.
- **F5.4:** Bugün ve Takvim 30 saniyede bir yenileniyor (sekme görünürken).
- Ortak sözleşmeler: `panel-appointment.ts`, `settings.ts`, `call.ts` (çağrı sonuçları DB enum'uyla aynı kaynak).
- Testler: panel (liste/filtre/kapsam/kiracı izolasyonu/durum geçişi/hasta/anonimleştirme/aramalar), ayarlar (saat çakışması, hekim/hizmet kiracı kontrolü, asistan ayarları birleştirme). 216 test; lint, tokens, typecheck temiz. Tarayıcıda: randevu oluşturma, onaylama, ayar kaydetme ve senkron doğrulandı.

### 2026-10-04 · Denetim kaydı, Bugün ekranı ve lokal veritabanı olayı · F3.4, F5.2

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `feat/F5.2-bugun` · **Commit'ler:** bu kaydı içeren commit'ler

- **F3.4:** `audit_events` tablosu ve `recordAudit()`. Giriş (Better Auth `session.create.after`), Recall ekibinin üye eklemesi ve davet kabulü kaydediliyor; metadata'da kişisel veri yok (testli).
- **Panel veri katmanı** `src/server/domain/panel.ts`: randevu listesi (tarih, durum, kaynak, hekim, arama filtresi), günlük özet, asistanın son randevuları, geri arama listesi/durumu, durum geçişleri (`STATUS_TRANSITIONS`, iptal geri alınamaz), not güncelleme, takvim saat aralığı. Hekim rolü yalnızca kendi takvimini görür (`requirePanelScope`). Testler: kiracı izolasyonu, hekim kapsamı, geçişler.
- **Bugün ekranı** (`/panel`): lacivert özet bandı (bugünkü randevu, asistanın bugün aldığı, bugünkü arama, açık geri arama; izinlere göre), hekim kolonlu gün takvimi ve "şimdi" çizgisi, asistanın son aldığı randevular, geri aranacaklar. Tarayıcıda doğrulandı.
- **Seed:** klinik yeniden oluşturulurken organizasyon bağı korunuyor; bir haftalık örnek randevu (14), arama (4) ve geri arama (2) eklendi (hayali hastalar).
- **Lokal DB olayı:** PGlite soket sunucusu, arka plan görev süresi dolup kabuk kapanınca ve ardından dev sunucusunun eşzamanlı bağlantılarıyla bozuldu (ECONNRESET, sonra WASM `Aborted()`). Yedek de bozuktu. Sıfırdan kuruldu. Önlemler: `DATABASE_POOL_MAX=1` (`.env.local`), `db:local` 5 dakikada bir anlık görüntü alıp açılmayan dizini otomatik geri yüklüyor. Bozuk dizinler `.pglite.corrupt-*` (gitignore).
- **Kurtarma adımları (yeniden gerekirse):** `pnpm db:local` → `pnpm db:migrate` → `pnpm db:seed` → `voice_agents` satırını elle ekle (`agent_d0b8d67285431ede3db2c75201`, `llm_9a1ea885e8b399803b5f448102b4`, sürüm 0; yoksa `voice:sync` ikinci ajan açar) → `pnpm voice:sync --clinic gulus-dis` (`updated` görülmeli) → `pnpm clinic:member --clinic gulus-dis --email sahip@gulus.test --name "Deneme Sahip" --role owner` ve terminaldeki bağlantıyla parola.
- Uzun vadede lokal geliştirme için Docker veya Neon geliştirme dalı önerilir (ürün ekibine soruldu).

### 2026-10-04 · Hesaplar, giriş, davet, roller ve panel kabuğu · F3.1, F3.2, F5.1, ADR-009

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `feat/F3.1-better-auth` · **Commit'ler:** bu kaydı içeren commit'ler

- Ürün ekibi panel tasarımını onayladı; F5'e geçiş için önce F3 yapıldı. `stash@{0}` silinemedi (otomatik güvenlik kontrolü engelledi); ürün ekibi silecek, içerik yalnızca bağımlılıktı, temiz kurulum yapıldı.
- **Better Auth 1.7.7** + Drizzle: 8 tablo, migration `0004_accounts`; `clinics.organization_id` (1:1). Kayıt kapalı (sunucu çağrısı da). Hesap açma: `pnpm clinic:member` (Recall ekibi; "parolanızı belirleyin" e-postası, Better Auth sıfırlama akışı) veya davet (`acceptInvitationAsNewUser`, tek transaction). Ayrıntı: [ADR-009](docs/decisions/ADR-009-accounts-and-roles.md).
- **Roller:** owner/admin/staff/practitioner, izin matrisi `src/lib/permissions.ts` (63 testli hücre). Özel roller için dinamik erişim kontrolü açık. `requireClinic()`, `can()`, `requirePermission()` (`forbidden()` → 403; `experimental.authInterrupts`).
- **E-posta:** `EMAIL_PROVIDER=console|resend` adaptörü; Türkçe davet ve parola şablonları (hasta verisi yok). Lokalde bağlantılar terminale yazılır.
- **Ekranlar:** `/giris` (açık yönlendirme korumalı `?sonra=`), `/sifremi-unuttum` (hesap var/yok aynı yanıt), `/sifre-belirle`, `/davet/[id]`; ortak sözleşmeler `src/lib/contracts/auth.ts`. `src/proxy.ts` `/panel/**` için çerez kontrolü.
- **Panel kabuğu (F5.1):** lacivert kenar çubuğu, klinik değiştirici, kullanıcı menüsü, mobil alt sekme çubuğu; menü izinlere göre. `/panel` şimdilik karşılama ekranı. Logo `src/components/design/logo.tsx`'e taşındı.
- `.env.local`: rastgele `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3000`, `EMAIL_PROVIDER=console` eklendi. Lokal test hesabı `sahip@gulus.test` (Gülüş Diş, owner); parolası `.env.local` içinde yorum satırında.
- Doğrulama: tarayıcıda parola belirleme → giriş → panel (1280 ve 766 px); entegrasyon testi (PGlite + gerçek Better Auth): hesap açma, parola, kayıt kapalı, davet, tekrar kullanılan davet, staff davet edemez, üye olmadığı kliniğe geçemez. 197 test, lint, tokens, typecheck, build temiz.

### 2026-10-04 · "Dt." kısaltmasının telaffuzu · F1.8

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `fix/F1.8-unvan-telaffuz` · **Commit'ler:** bu kaydı içeren commit

- Ürün ekibi isteği: asistan "Dt."/"DT" kısaltmasını harf harf okumasın, "diş hekimi" desin. Prompt kuralı vardı ama model hekim adlarını "Dt. Elif Kaya" olarak aldığı için aynen tekrarlıyordu.
- Çözüm: [`spokenTitles()`](src/server/domain/speech.ts) unvan kısaltmalarını açar (Dt./DT → Diş Hekimi, Dr. → Doktor, Uzm., Prof., Doç., Op., Öğr., Fzt., Psk., Dyt., Vet.). Prompt'taki hekim listesi, tool sonuçları (müsaitlik, randevu bulma/oluşturma/erteleme) ve ASR anahtar kelimeleri artık açık hâli kullanıyor; model kısaltmayı hiç görmüyor. Panel gösterimi (`practitionerDisplayName`) değişmedi.
- Prompt kuralı güçlendirildi ("asla harf harf okuma"; hasta "de te" derse diş hekimini kastediyor).
- `pnpm voice:sync --clinic gulus-dis` → `updated`. 123 test geçiyor.

### 2026-10-04 · Panel bileşen kütüphanesi · F4.2, ADR-008

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `feat/F4.2-panel-bilesenleri` · **Commit'ler:** bu kaydı içeren commit'ler

- **shadcn/ui** (Radix, `radix-nova`) kuruldu: 20 bileşen `src/components/ui/`. Takma ad katmanı kurulmadı; sınıflar DESIGN.md token'larına çevrildi ([ADR-008](docs/decisions/ADR-008-shadcn-theming.md)). shadcn'in eklediği Geist fontu, `cn` paketi, `next-themes`, `dark:` sınıfları ve CLI bağımlılığı kaldırıldı; gereken Radix durum varyantları `globals.css`'e kopyalandı.
- **Yeni token'lar:** `danger`, `danger-hover`, `danger-soft`, `success-soft` (kontrastlar ölçüldü). Odak halkası açık zeminde `primary`, koyu zeminde `accent` (eski `accent` halka beyazda 2,5:1 idi, WCAG 1.4.11'i karşılamıyordu). Tailwind 4'ün `currentColor` kenarlık varsayılanı `hairline` yapıldı (tanıtım sayfasında etkilenen öğe yok, tarayıcıda doğrulandı).
- **Panel bileşenleri** (`src/components/panel/`): `AppointmentStatusBadge`, `AppointmentSourceBadge`, `ScheduleGrid` (hekim/gün kolonları, çakışan randevular yan yana, "şimdi" çizgisi; `layoutColumn` testli), `FormField` (aria bağlantıları), `EmptyState`.
- **Ortak sözleşme:** randevu durum/kaynak değerleri ve Türkçe etiketleri `src/lib/contracts/appointment.ts`'e taşındı; Drizzle enum'ları buradan türetiliyor (`db:generate`: şema değişikliği yok).
- **Koruma:** `pnpm lint:tokens` artık shadcn tema adlarını (`bg-background`, `text-muted-foreground`…) yakalıyor; `cn.test.ts` `globals.css`'teki her renk token'ının `cn()` listesinde olduğunu doğruluyor.
- Stil rehberi `/dev/tasarim` → "Panel bileşenleri": butonlar, rozetler, form alanları, tarih seçici, sekmeler, menü, dialog, sheet, toast, tablo, gün takvimi, boş durum, iskelet. 1280 ve 375 px'te taşma yok.
- Açık: tablo sıralama/sayfalama F5'te veriyle; panel türetmeleri ve `danger` token'ı ürün ekibi onayı bekliyor.

### 2026-10-04 · Yazı tipi Montserrat, navbar %25 daha dar · F4.3

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `feat/F4.3-montserrat` · **Commit'ler:** bu kaydı içeren commit

- Ürün ekibi isteği: tüm üründe yazı tipi **Montserrat**. `@fontsource-variable/inter` kaldırıldı, `@fontsource-variable/montserrat` eklendi (yerel, `latin-ext`); `--font-sans` güncellendi. Tanıtım sayfası, panel, stil rehberi ve form alanları aynı token'ı kullandığı için hepsi değişti. DESIGN.md §1, DESIGN-SYSTEM.md, CLAUDE.md, ADR-006 ve ADR-007 (ek) güncellendi.
- Navbar her iki yandan eşit olarak %25 kısaltıldı: `max-w-5xl` (1024 px) → `max-w-3xl` (768 px), ortalı.
- Montserrat daha geniş olduğu için: header linkleri `whitespace-nowrap` ve `px-3` ("Nasıl çalışır" iki satıra kırılıyordu); mobilde menü düğmesi header dışına 22 px taşıyordu, mobil iç boşluklar azaltıldı (`gap-2`, `pl-3`, CTA `px-4`; `sm` ve üstü değişmedi).
- Tarayıcı: 375, 1024 ve 1280 px'te header içi taşma yok, linkler tek satır, sayfada yatay taşma yok.

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
