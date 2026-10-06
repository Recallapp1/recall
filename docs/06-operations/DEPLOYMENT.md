# Deploy

## Ortamlar

| Ortam      | Tetikleyici         | URL                           | Veritabanı           |
| ---------- | ------------------- | ----------------------------- | -------------------- |
| Preview    | Her PR / dal push'u | `recall-git-<dal>.vercel.app` | Neon dalı (otomatik) |
| Production | `main` dalına merge | Özel alan adı                 | Neon `main`          |

## Production (canlı) durumu

_Kurulum: 2026-10-05/06_

| Konu       | Değer                                                                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel     | Takım `RECALL` (`recall25`), proje `recall`, plan **Hobby** (ilk ücretli klinikten önce **Pro**'ya geçilecek: Hobby ticari kullanıma izin vermez)                                              |
| Git        | `recallapp0/recall` bağlı; `main`'e her push production deploy'u başlatır                                                                                                                      |
| Alan adı   | `recalltr.company` (Vercel'den alındı, DNS Vercel'de). `www` → ana alan 308 yönlendirme (`next.config.ts`). **Otomatik yenileme açık olmalı**                                                  |
| Veritabanı | Neon `falling-mud-37269187`, **`production` dalı** (Frankfurt, ücretsiz plan; canlıya geçmeden ücretli plana ve auto-suspend kapatmaya)                                                        |
| E-posta    | Resend, alan `recalltr.company`, bölge **eu-west-1** (İrlanda). DNS: `resend._domainkey` TXT (DKIM), `send` MX ve SPF TXT, `_dmarc` TXT (`p=none`)                                             |
| SMS        | `console` (Netgsm F2'de). Bu modda asistan "SMS gönderdim" demez, log'a mesaj gövdesi yazılmaz                                                                                                 |
| Preview    | Ortam değişkeni yok: dal push'u yapılmıyor (dallar lokalde `main`'e ff-merge). Preview gerekirse `DATABASE_URL` **dev** dalına verilmeli, asla production'a değil (build migration çalıştırır) |

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

| Değişken                                              | Zorunlu                        | Açıklama                                                                                                  |
| ----------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                        | ✓                              | Postgres bağlantısı (Neon: pooled URL)                                                                    |
| `DATABASE_POOL_MAX`                                   |                                | Bağlantı havuzu (varsayılan 10). Yalnızca lokal PGlite için `1`                                           |
| `APP_URL`                                             | ✓                              | Uygulamanın public URL'i (Retell webhook ve tool URL'leri bundan üretilir)                                |
| `RETELL_API_KEY`                                      | ✓ (ses için)                   | Retell API anahtarı (webhook rozetli); imza doğrulama da bununla yapılır                                  |
| `RETELL_VOICE_ID`                                     | ✓ (senkron için)               | Varsayılan ses; klinik kendi sesini seçebilir                                                             |
| `RETELL_LLM_MODEL`                                    |                                | Varsayılan `claude-5-sonnet` ([ADR-003](../decisions/ADR-003-llm-model.md))                               |
| `RETELL_VOICE_MODEL`                                  |                                | Seslendirme modeli, sesin sağlayıcısına ait olmalı (ElevenLabs için `eleven_multilingual_v2`)             |
| `RETELL_LLM_HIGH_PRIORITY`                            |                                | `true`: Retell'in öncelikli LLM havuzu (daha hızlı, dakika başı ek ücret). Varsayılan `false`             |
| `SMS_SENDING_ENABLED`                                 | **Production'da tanımlamayın** | Gerçek SMS ana anahtarı. Yalnızca `true` açar; Netgsm ve İYS/hukuk onayı tamamlanana kadar tanımsız kalır |
| `SMS_PROVIDER`                                        |                                | `console` (varsayılan) veya `netgsm`                                                                      |
| `NETGSM_USERCODE`, `NETGSM_PASSWORD`, `NETGSM_HEADER` | `netgsm` ise                   |                                                                                                           |
| `CRON_SECRET`                                         | Prod                           | Vercel Cron yetkilendirmesi                                                                               |
| `BETTER_AUTH_SECRET`                                  | Prod                           | Oturum çerezlerini imzalar, en az 32 karakter (`openssl rand -base64 32`)                                 |
| `BETTER_AUTH_URL`                                     |                                | Panelin adresi (giriş, e-posta bağlantıları); boşsa `APP_URL`                                             |
| `EMAIL_PROVIDER`                                      |                                | `console` (varsayılan, bağlantıları loga yazar) veya `resend`                                             |
| `RESEND_API_KEY`                                      | `resend` ise                   | Resend API anahtarı ([ADR-006](../decisions/ADR-006-email-provider.md))                                   |
| `EMAIL_FROM`                                          | Prod                           | Gönderici, ör. `Recall <bildirim@alan-adi>`; alan adı Resend'de doğrulanmış olmalı                        |

## Build ve migration

`package.json`:

```json
"vercel-build": "pnpm db:migrate && next build"
```

Vercel, `vercel-build` script'i varsa onu çalıştırır. Migration'lar **geriye dönük uyumlu** yazılır (önce kolon ekle, kodu deploy et, sonra eski kolonu kaldır), çünkü deploy sırasında eski sürüm hâlâ trafik alıyor olabilir.

## Yayın süreci

1. Dal aç → PR → Vercel Preview otomatik oluşur.
2. CI: lint, typecheck, test (GitHub Actions, `.github/workflows/ci.yml`).
3. Preview'da kontrol (gerekirse test numarasını preview URL'ine yönlendir).
4. `main`'e squash merge → Production deploy.
5. `CHANGELOG.md` güncellenir.

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

Tanımlı işler: `/api/cron/retention` (03:30 UTC) ve `/api/cron/notifications` (07:00 UTC). Hobby planında her iş günde bir kez çalışır. İkisi de `Authorization: Bearer $CRON_SECRET` ister; secret yoksa 503 döner.
