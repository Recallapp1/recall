# Lokal Geliştirme

## Gereksinimler

- Node 24 (`.nvmrc`)
- pnpm 12 (`corepack enable` veya `npm i -g pnpm`)
- Lokal Postgres için **ya** Docker Desktop **ya da** hiçbir şey (`pnpm db:local`, aşağıda)

## İlk kurulum

```bash
pnpm install
cp .env.example .env.local
pnpm db:local      # ayrı terminalde: PGlite Postgres (port 5433); Docker varsa: pnpm db:up
pnpm db:migrate    # tabloları oluştur
pnpm db:status     # bu veritabanı canlıyla aynı migration'larda mı (salt okunur)
pnpm db:seed       # demo klinik: "Gülüş Diş Kliniği"
pnpm dev
```

- Uygulama: http://localhost:3000
- Sağlık: http://localhost:3000/api/health
- DB arayüzü: `pnpm db:studio`

### Docker olmadan: `pnpm db:local`

Docker yoksa veya açılmıyorsa `pnpm db:up` yerine ayrı bir terminalde şunu çalıştır:

```bash
pnpm db:local      # PGlite: Postgres uyumlu sunucu, port 5433, veri .pglite/ içinde
```

Aynı `DATABASE_URL` ile çalışır; `db:migrate`, `db:seed` ve `dev` komutları değişmez. Sadece geliştirme içindir. Gerçek Postgres'e yakın davranış gerektiren işler (performans, eşzamanlılık) için Docker veya Neon kullan.

## Veritabanını sıfırlama

```bash
pnpm db:reset      # Docker: container + volume siler, yeniden oluşturur, migrate + seed
```

`db:local` kullanıyorsan: sunucuyu durdur, `.pglite/` klasörünü sil, yeniden başlatıp `pnpm db:migrate && pnpm db:seed` çalıştır.

## Sesli asistanı lokalde test etme

Retell'in webhook'ları lokal makinene ulaşabilmeli; bunun için bir tünel gerekir. Adım adım kurulum (API anahtarı, ses seçimi, tünel, ajanı oluşturma, test araması): **[RETELL-SETUP.md](../02-voice-agent/RETELL-SETUP.md)**.

### Webhook'ları telefonsuz test etme

`pnpm dev` çalışırken, Retell'in imzalama yöntemiyle imzalanmış örnek istekler gönderir (`RETELL_API_KEY` gerekir):

```bash
pnpm voice:send inbound          # gelen arama: numara → klinik → ajan
pnpm voice:send function-call    # find_appointments tool'u
pnpm voice:send call-ended       # arama bitti olayı
```

Örnek gövdeler `scripts/fixtures/retell-*.json` dosyalarındadır. `function-call` ve `call-ended`, demo kliniğin senkronize ajanını kullanır (önce `pnpm voice:sync --clinic gulus-dis`) veya `--agent <id>` alır.

## Faydalı komutlar

| Komut                             | Ne yapar                                 |
| --------------------------------- | ---------------------------------------- |
| `pnpm lint`                       | ESLint                                   |
| `pnpm typecheck`                  | TypeScript kontrolü                      |
| `pnpm test` / `pnpm test:watch`   | Vitest                                   |
| `pnpm format`                     | Prettier                                 |
| `pnpm db:generate`                | Şema değişikliğinden migration üret      |
| `pnpm db:studio`                  | Drizzle Studio                           |
| `pnpm voice:voices`               | Retell seslerini listele                 |
| `pnpm voice:sync --clinic <slug>` | Kliniğin Retell ajanını oluştur/güncelle |
| `pnpm voice:send <fixture>`       | İmzalı örnek webhook isteği gönder       |

## Sorun giderme

| Belirti                             | Çözüm                                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| `ECONNREFUSED 5433`                 | `pnpm db:local` (veya `pnpm db:up`) çalışıyor mu?                                                  |
| `Invalid environment variables`     | `.env.local` dosyasını `.env.example` ile karşılaştır                                              |
| Retell uç noktaları 503             | `.env.local` içinde `RETELL_API_KEY` yok; ekleyip `pnpm dev`'i yeniden başlat                      |
| Retell uç noktaları 401             | İmza geçersiz: anahtar yanlış veya webhook rozetli değil; saat farkı 5 dakikadan büyük             |
| Tool çağrısı 404 `CLINIC_NOT_FOUND` | Çağrıyı yapan ajan bizim senkronladığımız ajan değil (Retell panelinde elle oluşturulmuş olabilir) |
| Inbound `reject: true`              | Aranan numara `phone_numbers` tablosunda yok veya kliniğin ajanı senkronize değil                  |

## Dev veritabanı canlının gerisinde kalırsa

Canlı her deploy'da repodaki tüm migration'ları uygular; Neon `dev` dalı ise yalnızca elle `pnpm db:migrate` çalıştırılınca güncellenir. 2026-10-17'de dev iki migration geride kalmıştı ve fark edilmemişti (A16 provası durdu; C5'teki arama olayları da yazılamazdı). Bu yüzden `pnpm dev:tunnel` ve `pnpm voice:eval` başlamadan `pnpm db:status` ile aynı kontrolü yapar ve bekleyen migration varsa durur. Uygulamak veritabanını değiştirir: önce Recall sahibine sorulur.
