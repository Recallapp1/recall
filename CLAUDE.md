@AGENTS.md

# Recall: Proje Kuralları

Recall, kliniklere (diş, sağlık, güzellik) gelen telefon aramalarını karşılayan, kliniğe özel yapılandırılmış bir **Türkçe sesli asistan** ve randevuların düştüğü bir **klinik paneli** sunan çok kiracılı (multi-tenant) bir SaaS ürünüdür.

Ürün bağlamı için önce şunları oku: [docs/00-product/PRD.md](docs/00-product/PRD.md), [docs/01-architecture/ARCHITECTURE.md](docs/01-architecture/ARCHITECTURE.md).

## Stack

| Katman           | Seçim                                                             |
| ---------------- | ----------------------------------------------------------------- |
| Framework        | Next.js 16 (App Router, Turbopack), React 19.2, TypeScript strict |
| Stil             | Tailwind CSS 4, shadcn/ui                                         |
| Veritabanı       | PostgreSQL (lokal: Docker, prod: Neon / Vercel Marketplace)       |
| ORM              | Drizzle ORM + drizzle-kit (`pg` sürücüsü)                         |
| Kimlik doğrulama | Better Auth (organization plugin = klinik)                        |
| Doğrulama        | Zod (env, API girdileri, tool argümanları)                        |
| Sesli asistan    | Vapi (Türk operatöründen BYO SIP trunk)                           |
| LLM              | Claude (bkz. [ADR-003](docs/decisions/ADR-003-llm-model.md))      |
| SMS              | Netgsm                                                            |
| Test             | Vitest                                                            |
| Deploy           | Vercel (bölge `fra1`)                                             |
| Paket yöneticisi | pnpm (Node 24)                                                    |

## Komutlar

```bash
pnpm dev            # lokal geliştirme (http://localhost:3000)
pnpm build          # production build
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest
pnpm format         # Prettier
pnpm db:up          # lokal Postgres (Docker)
pnpm db:generate    # şemadan migration üret
pnpm db:migrate     # migration'ları uygula
pnpm db:seed        # demo klinik verisi
pnpm db:studio      # Drizzle Studio
```

Bir değişikliği bitmiş saymadan önce `pnpm lint && pnpm typecheck && pnpm test` çalıştır.

## Klasör yapısı

```
src/
├── app/                  # Next.js rotaları (sadece routing + UI kompozisyonu)
│   ├── (marketing)/      # Herkese açık sayfalar
│   ├── panel/            # Klinik paneli (oturum gerekli)
│   └── api/              # Route handler'lar (webhook'lar, health)
├── components/           # Paylaşılan UI bileşenleri (ui/ = shadcn)
├── lib/                  # Framework'ten bağımsız yardımcılar (env, utils)
└── server/               # Sadece sunucuda çalışan kod
    ├── db/               # Drizzle client, şema, seed
    ├── domain/           # İş kuralları (müsaitlik, randevu) — saf fonksiyonlar
    ├── voice/            # Sesli asistan: provider adaptörleri, tool'lar, prompt
    └── notifications/    # SMS
docs/                     # Tüm ürün ve teknik belgeler
```

## Kurallar

- **Kiracı izolasyonu:** Klinik verisine dokunan her sorgu `clinicId` ile filtrelenir. İstisnasız. Bkz. [MULTI-TENANCY.md](docs/01-architecture/MULTI-TENANCY.md).
- **Saat dilimi:** DB'de her zaman `timestamptz` (UTC). Gösterim ve slot hesabı kliniğin saat diliminde (varsayılan `Europe/Istanbul`).
- **Sunucu sınırı:** `src/server/**` dosyaları `import "server-only"` ile başlar. Client component'ler buradan import edemez.
- **Doğrulama:** Dışarıdan gelen her veri (webhook, form, tool argümanı) Zod ile parse edilir.
- **Env:** `process.env` doğrudan okunmaz; `@/lib/env` kullanılır. Yeni değişken eklersen `.env.example` dosyasını ve [DEPLOYMENT.md](docs/06-operations/DEPLOYMENT.md) belgesini güncelle.
- **İş mantığı `src/server/domain/` içinde:** Saf, test edilebilir fonksiyonlar. Route handler'lar ince kalır.
- **Next.js 16:** `middleware` yerine `proxy.ts`; `params`, `cookies()`, `headers()` async. Emin olmadığın API için `node_modules/next/dist/docs/` belgelerine bak.
- **Sağlık verisi (KVKK):** Loglara telefon numarası, isim, transkript yazma. Bkz. [KVKK.md](docs/05-compliance/KVKK.md).
- **Sesli asistan tıbbi tavsiye vermez.** Prompt ve tool değişiklikleri [ESCALATION.md](docs/02-voice-agent/ESCALATION.md) belgesine uymalı.
- Yorumlar sadece *neden*i açıklar. Kod ve tanımlayıcılar İngilizce, kullanıcıya görünen metinler ve belgeler Türkçe.

## Git

- Ana dal `main`. Her iş için dal aç: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- [Conventional Commits](https://www.conventionalcommits.org/): `feat(voice): add cancel_appointment tool`.
- Küçük, tek amaçlı commit'ler. Commit öncesi lint, typecheck ve test temiz olmalı.
- Önemli teknik kararlar için `docs/decisions/` altında yeni bir ADR yaz.
