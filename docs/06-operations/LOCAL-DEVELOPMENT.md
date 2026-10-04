# Lokal Geliştirme

## Gereksinimler

- Node 24 (`.nvmrc`)
- pnpm 12 (`corepack enable` veya `npm i -g pnpm`)
- Docker Desktop (lokal Postgres için)

## İlk kurulum

```bash
pnpm install
cp .env.example .env.local
pnpm db:up         # docker compose ile Postgres 17 (port 5433)
pnpm db:migrate    # tabloları oluştur
pnpm db:seed       # demo klinik: "Gülüş Diş Kliniği"
pnpm dev
```

- Uygulama: http://localhost:3000
- Sağlık: http://localhost:3000/api/health
- DB arayüzü: `pnpm db:studio`

## Veritabanını sıfırlama

```bash
pnpm db:reset      # container + volume siler, yeniden oluşturur, migrate + seed
```

## Sesli asistanı lokalde test etme

Vapi'nin webhook'u lokal makinene ulaşabilmeli. Bunun için bir tünel gerekir.

1. Tünel aç (birini seç):
   ```bash
   cloudflared tunnel --url http://localhost:3000
   # veya
   ngrok http 3000
   ```
2. Vapi panelinde test numarasının **Server URL** alanına `https://<tünel>/api/voice/vapi` yaz; **Server URL Secret** alanına `.env.local` içindeki `VAPI_WEBHOOK_SECRET` değerini gir.
3. Seed'deki demo kliniğin `phone_number` alanını Vapi test numarasıyla güncelle:
   ```bash
   pnpm db:seed --phone +1XXXXXXXXXX
   ```
4. Numarayı ara. Webhook logları `pnpm dev` terminalinde görünür.

### Webhook'u telefonsuz test etme

```bash
curl -X POST http://localhost:3000/api/voice/vapi \
  -H "content-type: application/json" \
  -H "x-vapi-secret: $VAPI_WEBHOOK_SECRET" \
  -d @scripts/fixtures/vapi-tool-calls.json
```

`scripts/fixtures/` altında örnek `assistant-request` ve `tool-calls` payload'ları bulunur.

## Faydalı komutlar

| Komut                           | Ne yapar                            |
| ------------------------------- | ----------------------------------- |
| `pnpm lint`                     | ESLint                              |
| `pnpm typecheck`                | TypeScript kontrolü                 |
| `pnpm test` / `pnpm test:watch` | Vitest                              |
| `pnpm format`                   | Prettier                            |
| `pnpm db:generate`              | Şema değişikliğinden migration üret |
| `pnpm db:studio`                | Drizzle Studio                      |

## Sorun giderme

| Belirti                         | Çözüm                                                               |
| ------------------------------- | ------------------------------------------------------------------- |
| `ECONNREFUSED 5433`             | `pnpm db:up` çalıştır; Docker açık mı?                              |
| `Invalid environment variables` | `.env.local` dosyasını `.env.example` ile karşılaştır               |
| Webhook 401                     | `x-vapi-secret` ile `VAPI_WEBHOOK_SECRET` eşleşmiyor                |
| Webhook 404 `CLINIC_NOT_FOUND`  | Aranan numara `clinics.phone_number` ile eşleşmiyor (E.164 biçimi?) |
