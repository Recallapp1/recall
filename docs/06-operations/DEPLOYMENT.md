# Deploy

## Ortamlar ve veritabanı dalları

Neon projesi `falling-mud-37269187` (AWS eu-central-1). **Neon'da `main` adlı bir dal yoktur**; `main` yalnızca Git dalının adıdır. Production veritabanı Neon'un **`production`** dalıdır.

| Ortam            | Tetikleyici             | URL                               | Neon dalı                               | Dal id                      | Uç nokta (host'un başı)   |
| ---------------- | ----------------------- | --------------------------------- | --------------------------------------- | --------------------------- | ------------------------- |
| Production       | `main`'e birleştirme    | `https://recalltr.company`        | **`production`** (varsayılan dal)       | `br-frosty-union-b1y9qd14`  | `ep-small-bar-b1c058o0`   |
| Lokal geliştirme | `pnpm dev`              | `http://localhost:3000` (+ tünel) | **`dev`**                               | `br-dawn-mountain-b1yqptr1` | `ep-empty-smoke-b163qx6v` |
| Testler, CI, E2E | `pnpm test`, `pnpm e2e` | —                                 | Yok: bellekte PGlite                    | —                           | —                         |
| Preview (Vercel) | —                       | Kapalı (`vercel.json`)            | Ortam değişkeni bilerek yok             | —                           | —                         |
| Yedekler         | Migration'dan önce elle | —                                 | `backup-pre-00NN-<tarih>` (compute'suz) | —                           | —                         |

**Yanlış veritabanına bağlanmamak için:** bir bağlantı dizesinin hangi dala gittiğini host'un başı söyler (`ep-small-bar…` = production). `voice:eval` gibi veri yazan yerel araçlar production uç noktasını görünce çalışmayı reddeder. Production dizesi yalnızca Vercel'de (sensitive) durur; lokale yazılmaz.

## Production (canlı) durumu

_Kurulum: 2026-10-05/06_

| Konu       | Değer                                                                                                                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel     | Takım `RECALL` (`recall25`), proje `recall`, plan **Hobby** (ilk ücretli klinikten önce **Pro**'ya geçilecek: Hobby ticari kullanıma izin vermez)                                                                                                  |
| Git        | `recallapp0/recall` bağlı; `main`'e her push production deploy'u başlatır. `main` korumalı: yalnızca `check` ve `e2e` CI kontrolleri geçmiş commit kabul edilir (2026-10-08)                                                                       |
| Alan adı   | `recalltr.company` (Vercel'den alındı, DNS Vercel'de). `www` → ana alan 308 yönlendirme (`next.config.ts`). Otomatik yenileme ürün ekibince bilerek kapalı: ilk klinikten önce yeni alana taşınılacak ([DOMAIN-MIGRATION.md](DOMAIN-MIGRATION.md)) |
| Veritabanı | Neon `falling-mud-37269187`, **`production` dalı** (`br-frosty-union-b1y9qd14`; Frankfurt, ücretsiz plan; canlıya geçmeden ücretli plana ve auto-suspend kapatmaya). Bağlantı `sslmode=verify-full`                                                |
| E-posta    | Resend, alan `recalltr.company`, bölge **eu-west-1** (İrlanda). DNS: `resend._domainkey` TXT (DKIM), `send` MX ve SPF TXT, `_dmarc` TXT (`p=none`)                                                                                                 |
| SMS        | `console` (Netgsm F2'de). Bu modda asistan "SMS gönderdim" demez, log'a mesaj gövdesi yazılmaz                                                                                                                                                     |
| Preview    | Kapalı: `vercel.json` → `git.deploymentEnabled` yalnızca `main`'i deploy eder; iş dalı push'ları yalnızca CI'ı çalıştırır. Preview gerekirse `DATABASE_URL` **dev** dalına verilmeli, asla production'a değil (build migration çalıştırır)         |

Gizli değerler (`DATABASE_URL`, `RETELL_API_KEY`, `RESEND_API_KEY`, `BETTER_AUTH_SECRET`) Vercel'de **sensitive** olarak durur ve kimse tarafından okunamaz. Oturum anahtarı Vercel'e doğrudan üretilerek yazıldı.

### Production'da ilk konsol yöneticisi

`platform:admin` yerelde production veritabanına karşı çalıştırılır; parola bağlantısı Resend ile e-postaya gider (Resend kapalıysa terminale yazılır):

```powershell
$env:DATABASE_URL="<neon production pooled URL>"
$env:APP_URL="https://recalltr.company"
$env:BETTER_AUTH_URL="https://recalltr.company"
pnpm platform:admin --email <e-posta> --name "<ad>"
```

### Yeni klinik

Konsol (`/admin`) → Yeni klinik → klinik sayfasında **Asistanı oluştur** → klinik panelinden en az bir hekim. Sektör şablonu hekim eklemez; hekimsiz klinikte asistan uygun saat bulamaz.

## İlk kurulum (bir kez)

1. **GitHub:** Repo'yu GitHub'a gönder.
2. **Vercel projesi:** Vercel → _Add New Project_ → repo'yu seç. Framework: Next.js (otomatik).
3. **Bölge:** Project Settings → Functions → Region: **Frankfurt (`fra1`)**. `vercel.json` içinde de tanımlıdır.
4. **Neon:** Vercel → Storage / Marketplace → **Neon** → bölge **AWS eu-central-1 (Frankfurt)**. Entegrasyon `DATABASE_URL` değişkenini otomatik ekler ve preview dalları için Neon branch'leri açar.
5. **Ortam değişkenleri:** Aşağıdaki tabloyu Vercel → Settings → Environment Variables'a gir.
6. **Migration:** Build komutu migration'ları çalıştırır (aşağıda).
7. **Alan adı:** Settings → Domains.
8. **Retell:** `APP_URL` production alan adına ayarlandıktan sonra `pnpm voice:sync --all --force` ile ajanların webhook ve tool URL'lerini güncelle; numaraların inbound webhook URL'ini `https://<alan-adı>/api/voice/retell/inbound` yap.

## Ortam değişkenleri

Kaynak gerçek: [`.env.example`](../../.env.example) ve [`src/lib/env.ts`](../../src/lib/env.ts).

| Değişken                                                   | Zorunlu                        | Açıklama                                                                                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                             | ✓                              | Postgres bağlantısı (Neon: pooled URL, `sslmode=verify-full`; `require` pg sürücüsünde güvenlik uyarısı basar)                                                                            |
| `DATABASE_POOL_MAX`                                        |                                | Bağlantı havuzu (varsayılan 10). Yalnızca lokal PGlite için `1`                                                                                                                           |
| `APP_URL`                                                  | ✓                              | Uygulamanın public URL'i (Retell webhook ve tool URL'leri bundan üretilir)                                                                                                                |
| `RETELL_API_KEY`                                           | ✓ (ses için)                   | Retell API anahtarı (webhook rozetli); imza doğrulama da bununla yapılır                                                                                                                  |
| `RETELL_VOICE_ID`                                          | ✓ (senkron için)               | Varsayılan ses; klinik kendi sesini seçebilir                                                                                                                                             |
| `RETELL_LLM_MODEL`                                         |                                | Varsayılan `claude-4.5-haiku` ([ADR-003](../decisions/ADR-003-llm-model.md)); değişiklik ürün ekibi onayı ister                                                                           |
| `RETELL_VOICE_MODEL`                                       |                                | Seslendirme modeli, sesin sağlayıcısına ait olmalı (ElevenLabs için `eleven_multilingual_v2`)                                                                                             |
| `RETELL_LLM_HIGH_PRIORITY`                                 |                                | `true`: Retell'in öncelikli LLM havuzu (daha hızlı, dakika başı ek ücret). Varsayılan `false`                                                                                             |
| `VOICE_PROMPT_VARIANT`                                     |                                | `full` (varsayılan) veya `compact` (ADR-003 seçenek A). Değişince yeniden deploy ajanları senkronlar                                                                                      |
| `RETELL_RESPONSIVENESS`, `RETELL_INTERRUPTION_SENSITIVITY` |                                | 0–1; tanımsızsa Retell varsayılanı (1). Tanımsız bırakın (ADR-003)                                                                                                                        |
| `RETELL_DYNAMIC_RESPONSIVENESS`                            |                                | `true`: yanıt zamanlaması arayanın hızına uyar (seçenek A). Tanımsızsa kapalı                                                                                                             |
| `POST_CALL_FLAGS`                                          |                                | `true`: aramadan sonra işaretler (kayıtla uyuşmayan sonuç, acil durum, tıbbi risk) panelde rozet olarak görünür. Tanımsızsa kapalı                                                        |
| `VOICE_SHARED_NUMBER_CHECK`                                |                                | `true`: aynı numarada farklı kişiler adına randevu varsa arayan numara görünse de ad, tarih ve saat doğrulaması istenir; randevu kimin adına alındıysa kaydedilir (A2). Tanımsızsa kapalı |
| `SMS_SENDING_ENABLED`                                      | **Production'da tanımlamayın** | Gerçek SMS ana anahtarı. Yalnızca `true` açar; Netgsm ve İYS/hukuk onayı tamamlanana kadar tanımsız kalır                                                                                 |
| `SMS_PROVIDER`                                             |                                | `console` (varsayılan) veya `netgsm`                                                                                                                                                      |
| `NETGSM_USERCODE`, `NETGSM_PASSWORD`, `NETGSM_HEADER`      | `netgsm` ise                   |                                                                                                                                                                                           |
| `CRON_SECRET`                                              | Prod                           | Vercel Cron yetkilendirmesi                                                                                                                                                               |
| `BETTER_AUTH_SECRET`                                       | Prod                           | Oturum çerezlerini imzalar, en az 32 karakter (`openssl rand -base64 32`)                                                                                                                 |
| `BETTER_AUTH_URL`                                          |                                | Panelin adresi (giriş, e-posta bağlantıları); boşsa `APP_URL`                                                                                                                             |
| `EMAIL_PROVIDER`                                           |                                | `console` (varsayılan, bağlantıları loga yazar) veya `resend`                                                                                                                             |
| `RESEND_API_KEY`                                           | `resend` ise                   | Resend API anahtarı ([ADR-006](../decisions/ADR-006-email-provider.md))                                                                                                                   |
| `EMAIL_FROM`                                               | Prod                           | Gönderici, ör. `Recall <bildirim@alan-adi>`; alan adı Resend'de doğrulanmış olmalı                                                                                                        |

## Build ve migration

`package.json`:

```json
"vercel-build": "pnpm db:migrate && next build"
```

Vercel, `vercel-build` script'i varsa onu çalıştırır. Migration'lar **geriye dönük uyumlu** yazılır (önce kolon ekle, kodu deploy et, sonra eski kolonu kaldır), çünkü deploy sırasında eski sürüm hâlâ trafik alıyor olabilir.

## Yayın süreci (2026-10-08'den beri: dal tabanlı)

`main` GitHub'da korumalıdır: bir commit ancak **`check`** ve **`e2e`** kontrolleri o commit'te geçtiyse `main`'e girebilir. Doğrudan `main`'de çalışılmaz.

1. `main`'den iş dalı aç (`feat/…`, `fix/…`, `docs/…`, `chore/…`); lokalde `pnpm lint && pnpm lint:tokens && pnpm typecheck && pnpm format:check && pnpm test` (çıkış kodlarıyla, boru yok).
2. Dalı push et: `git push -u origin <dal>`. CI her dal push'unda çalışır: `pnpm audit --prod`, lint, tokens, typecheck, format, test, production build (`check`); ardından Playwright E2E (`e2e`). Dal push'u deploy etmez (preview kapalı).
3. CI'ı bekle: `pnpm ci:wait` (HEAD için `check` + `e2e` bitene kadar bekler; ikisi de geçerse 0, biri düşerse bağlantısıyla 1 döner). Repo özel olduğundan GitHub API'si kimlik ister: `GITHUB_TOKEN` ya da git'in push için kullandığı kayıtlı kimlik (Git Credential Manager); token yazdırılmaz. Kırmızıysa dalda düzelt, yeniden push et, tekrar bekle.
4. Yeni migration varsa birleştirmeden önce Neon'da production'dan compute'suz yedek dal: `backup-pre-00NN-<tarih>`. Yedek dal production'ın parolasını taşır (Neon'da rol parolaları dal açılırken kopyalanır): compute'suz kalır ve doğrulamadan sonra silinir. Yalnızca ekleme yapan migration'larda 6 saatlik PITR yeterlidir.
5. Birleştir (yalnızca fast-forward): `git switch main && git pull --ff-only && git merge --ff-only <dal> && git push origin main`. `main` bu arada ilerlediyse dalı `main` üzerine al (`git rebase main`), yeniden push et ve 3. adımdan devam et: yeni commit'in de CI'dan geçmesi gerekir.
6. `main`'e push → Vercel production build: `drizzle-kit migrate` → `next build` → `voice:sync --existing --soft` (mevcut ajanlar prompt ve tool değişikliklerini deploy ile alır; ajan oluşturmaz, hata build'i durdurmaz).
7. Deploy sonrası: build READY, `/api/health`, gerekiyorsa `/api/health/jobs` ve migration sayısı kontrol edilir.
8. Dalı sil: `git branch -d <dal> && git push origin --delete <dal>`.

Acil düzeltmede de aynı yol izlenir (CI yaklaşık 10 dakika); daha hızlı geri dönüş gerekiyorsa önce Vercel'de önceki deploy'a dönülür (aşağıda).

## Geri alma

Vercel → Deployments → önceki deploy → **Promote to Production** (anında). DB migration'ı geri almak gerekiyorsa ters migration yazılır; Neon'un point-in-time restore özelliği son çaredir.

## Vercel Cron

`vercel.json`:

```json
{
  "regions": ["fra1"],
  "crons": [
    { "path": "/api/cron/retention", "schedule": "30 3 * * *" },
    { "path": "/api/cron/notifications", "schedule": "0 7 * * *" }
  ]
}
```

Tanımlı işler: `/api/cron/retention` (03:30 UTC) ve `/api/cron/notifications` (07:00 UTC). Hobby planında her iş günde bir kez, **tanımlı saatin içindeki herhangi bir dakikada** çalışır (ör. 07:00–07:59 UTC; ilk çalışma 7 Ekim 07:44 UTC). Pro'da tam dakikasında çalışır. Runtime logları Hobby'de yaklaşık bir saat tutulur; çalışmayı doğrulamak için `notifications` tablosuna bakın. İkisi de `Authorization: Bearer $CRON_SECRET` ister; secret yoksa 503 döner.
