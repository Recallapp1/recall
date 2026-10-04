# Deploy

## Ortamlar

| Ortam      | Tetikleyici         | URL                           | Veritabanı           |
| ---------- | ------------------- | ----------------------------- | -------------------- |
| Preview    | Her PR / dal push'u | `recall-git-<dal>.vercel.app` | Neon dalı (otomatik) |
| Production | `main` dalına merge | Özel alan adı                 | Neon `main`          |

## İlk kurulum (bir kez)

1. **GitHub:** Repo'yu GitHub'a gönder.
2. **Vercel projesi:** Vercel → _Add New Project_ → repo'yu seç. Framework: Next.js (otomatik).
3. **Bölge:** Project Settings → Functions → Region: **Frankfurt (`fra1`)**. `vercel.json` içinde de tanımlıdır.
4. **Neon:** Vercel → Storage / Marketplace → **Neon** → bölge **AWS eu-central-1 (Frankfurt)**. Entegrasyon `DATABASE_URL` değişkenini otomatik ekler ve preview dalları için Neon branch'leri açar.
5. **Ortam değişkenleri:** Aşağıdaki tabloyu Vercel → Settings → Environment Variables'a gir.
6. **Migration:** Build komutu migration'ları çalıştırır (aşağıda).
7. **Alan adı:** Settings → Domains.
8. **Vapi:** Production numaralarının Server URL'ini `https://<alan-adı>/api/voice/vapi` yap.

## Ortam değişkenleri

Kaynak gerçek: [`.env.example`](../../.env.example) ve [`src/lib/env.ts`](../../src/lib/env.ts).

| Değişken                                                                 | Zorunlu      | Açıklama                                                |
| ------------------------------------------------------------------------ | ------------ | ------------------------------------------------------- |
| `DATABASE_URL`                                                           | ✓            | Postgres bağlantısı (Neon: pooled URL)                  |
| `APP_URL`                                                                | ✓            | Uygulamanın public URL'i (Vapi server URL üretimi için) |
| `VAPI_WEBHOOK_SECRET`                                                    | ✓            | Vapi Server URL Secret                                  |
| `VAPI_API_KEY`                                                           |              | Vapi API (Faz 2: kayıt silme, numara yönetimi)          |
| `VOICE_LLM_MODEL`                                                        |              | Varsayılan: ADR-003'teki model                          |
| `VOICE_TRANSCRIBER_PROVIDER`, `VOICE_TTS_PROVIDER`, `VOICE_TTS_VOICE_ID` |              | Ses sağlayıcı seçimleri                                 |
| `SMS_PROVIDER`                                                           |              | `console` (varsayılan) veya `netgsm`                    |
| `NETGSM_USERCODE`, `NETGSM_PASSWORD`, `NETGSM_HEADER`                    | `netgsm` ise |                                                         |
| `CRON_SECRET`                                                            | Prod         | Vercel Cron yetkilendirmesi                             |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`                                  | Faz 2        |                                                         |

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
    { "path": "/api/cron/reminders", "schedule": "0 * * * *" },
    { "path": "/api/cron/retention", "schedule": "30 3 * * *" }
  ]
}
```

Cron rotaları Faz 2'de eklenecek; o zamana kadar `crons` boş kalır.
