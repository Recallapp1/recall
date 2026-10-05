@AGENTS.md

# Recall: Proje Kuralları

Recall, kliniklere (diş, sağlık, güzellik) gelen telefon aramalarını karşılayan, kliniğe özel yapılandırılmış bir **Türkçe sesli asistan** ve randevuların düştüğü bir **klinik paneli** sunan çok kiracılı (multi-tenant) bir SaaS ürünüdür.

## Her oturumun başında oku

1. [WORKLOG.md](WORKLOG.md): güncel durum, açık dallar, son yapılanlar
2. [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md): fazlar, görev kimlikleri, kabul kriterleri
3. [DESIGN.md](DESIGN.md): **tek tasarım kaynağı.** Arayüzle ilgili her işte zorunlu
4. Ürün bağlamı: [PRD.md](docs/00-product/PRD.md), [ARCHITECTURE.md](docs/01-architecture/ARCHITECTURE.md)

## Her oturumun sonunda

- [WORKLOG.md](WORKLOG.md) dosyasına kayıt ekle (şablon dosyada) ve "Güncel durum" bölümünü güncelle.
- Planda tamamlanan görev kutularını işaretle.

## Stack

| Katman           | Seçim                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | Next.js 16 (App Router, Turbopack), React 19.2, TypeScript strict                                                                               |
| Stil             | Tailwind CSS 4, shadcn/ui, [DESIGN.md](DESIGN.md) (Montserrat, lacivert + beyaz, glassmorphism)                                                 |
| Veritabanı       | PostgreSQL (lokal: Neon `dev` dalı; yedek: PGlite `db:local` veya Docker; prod: Neon ana dal / Vercel)                                          |
| ORM              | Drizzle ORM + drizzle-kit (`pg` sürücüsü)                                                                                                       |
| Kimlik doğrulama | Better Auth (organization plugin = klinik)                                                                                                      |
| Doğrulama        | Zod (env, API girdileri, tool argümanları)                                                                                                      |
| Sesli asistan    | **Retell AI** Voice Agent API, klinik başına senkronize ajan ([ADR-004](docs/decisions/ADR-004-retell-voice-platform.md)). **Vapi kullanılmaz** |
| LLM              | Claude (bkz. [ADR-003](docs/decisions/ADR-003-llm-model.md))                                                                                    |
| Telefon ve SMS   | Netgsm (SIP trunk ve SMS); alternatifler test edilecek (F2)                                                                                     |
| E-posta          | Resend, adaptör arkasında ([ADR-006](docs/decisions/ADR-006-email-provider.md))                                                                 |
| Test             | Vitest                                                                                                                                          |
| Deploy           | Vercel (bölge `fra1`)                                                                                                                           |
| Paket yöneticisi | pnpm (Node 24)                                                                                                                                  |

## Komutlar

```bash
pnpm dev            # lokal geliştirme (http://localhost:3000)
pnpm build          # production build
pnpm lint           # ESLint
pnpm lint:tokens    # DESIGN.md token kuralı: hex/rgb/hazır palet yasak
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest
pnpm format         # Prettier
pnpm db:local       # lokal Postgres (PGlite, Docker gerekmez)
pnpm db:up          # lokal Postgres (Docker)
pnpm db:generate    # şemadan migration üret
pnpm db:migrate     # migration'ları uygula
pnpm db:seed        # demo klinik verisi
pnpm db:studio      # Drizzle Studio
pnpm dev:tunnel     # lokal sesli test: tünel aç, APP_URL yaz, ajanları yeni adrese yönlendir
pnpm voice:voices   # Retell seslerini listele
pnpm voice:sync --clinic <slug>   # kliniğin Retell ajanını oluştur/güncelle (--all, --force)
pnpm voice:send <inbound|function-call|call-ended>   # imzalı örnek webhook isteği
pnpm clinic:member --clinic <slug> --email <e-posta> --name "<ad>" [--role owner]   # kliniğe kişi ekle (parola e-postası gider)
pnpm platform:admin --email <e-posta> --name "<ad>"   # Recall konsolu (/admin) yetkisi ver
```

Bir değişikliği bitmiş saymadan önce `pnpm lint && pnpm lint:tokens && pnpm typecheck && pnpm test` çalıştır. UI değişikliğinde stil rehberine bak: http://localhost:3000/dev/tasarim

## Klasör yapısı

```
src/
├── app/                  # Next.js rotaları (sadece routing + UI kompozisyonu)
│   ├── (marketing)/      # Herkese açık sayfalar
│   ├── panel/            # Klinik paneli (oturum gerekli)
│   └── api/              # Route handler'lar (webhook'lar, health)
├── components/           # design/ (DESIGN.md), ui/ (shadcn, token'larla temalı), panel/ (alan bileşenleri)
├── lib/                  # Framework'ten bağımsız yardımcılar (env, utils)
│   └── contracts/        # Client ve server ortak Zod şemaları
└── server/               # Sadece sunucuda çalışan kod
    ├── db/               # Drizzle client, şema, seed
    ├── domain/           # İş kuralları (müsaitlik, randevu) — saf fonksiyonlar
    ├── voice/            # Sesli asistan: tool'lar, prompt, providers/retell
    └── notifications/    # SMS
docs/                     # Tüm ürün ve teknik belgeler
```

## Kurallar

- **Çok kiracılı tasarım:** Tek kod tabanı, sınırsız klinik. Klinikler arası farklar veriyle (ayarlar, roller, ilişkisel tablolar) ifade edilir; kodda kliniğe özel dal (`if (clinic.slug === …)`) yasaktır.
- **Hesaplar ve yetki:** Herkese açık kayıt kapalı; hesaplar Recall ekibi (`clinic:member`) veya davetle açılır ([ADR-009](docs/decisions/ADR-009-accounts-and-roles.md)). Her panel sayfası ve Server Action `requireClinic()` veya `requirePermission()` ile başlar (`src/server/auth/session.ts`). Roller ve izinler tek yerde: `src/lib/permissions.ts`.
- **Kiracı izolasyonu:** Klinik verisine dokunan her sorgu `clinicId` ile filtrelenir. İstisnasız. Kiracı sunucuda belirlenir (oturum, aranan numara, Retell `agent_id`), asla istemciden veya LLM argümanından gelmez. Bkz. [MULTI-TENANCY.md](docs/01-architecture/MULTI-TENANCY.md).
- **Tasarım:** Sadece [DESIGN.md](DESIGN.md) ve ondan türetilen `globals.css` token'ları. Bileşenlerde sabit hex/px renk yok. DESIGN.md'nin karşılamadığı bir durumda önce ürün ekibine sor ([ADR-005](docs/decisions/ADR-005-design-system.md)).
- **Ortak sözleşmeler:** Form ve Server Action girdileri `src/lib/contracts/` altındaki aynı Zod şemasını kullanır; UI tipleri `z.infer` ile türetilir. Bkz. [IMPLEMENTATION-PLAN.md → Ortak sözleşmeler](docs/IMPLEMENTATION-PLAN.md#ortak-sözleşmeler-backend--frontend-uyumu).
- **Ses sağlayıcısı sınırı:** Retell'e özgü kod yalnızca `src/server/voice/providers/retell/` altında. Tool'lar, prompt ve domain sağlayıcıdan bağımsız.
- **Saat dilimi:** DB'de her zaman `timestamptz` (UTC). Gösterim ve slot hesabı kliniğin saat diliminde (varsayılan `Europe/Istanbul`).
- **Sunucu sınırı:** `src/server/**` dosyaları `import "server-only"` ile başlar. Client component'ler buradan import edemez.
- **Doğrulama:** Dışarıdan gelen her veri (webhook, form, tool argümanı) Zod ile parse edilir.
- **Env:** `process.env` doğrudan okunmaz; `@/lib/env` kullanılır. Yeni değişken eklersen `.env.example` dosyasını ve [DEPLOYMENT.md](docs/06-operations/DEPLOYMENT.md) belgesini güncelle.
- **İş mantığı `src/server/domain/` içinde:** Saf, test edilebilir fonksiyonlar. Route handler'lar ince kalır.
- **Next.js 16:** `middleware` yerine `proxy.ts`; `params`, `cookies()`, `headers()` async. Emin olmadığın API için `node_modules/next/dist/docs/` belgelerine bak.
- **Sağlık verisi (KVKK):** Loglara telefon numarası, isim, transkript yazma. Bkz. [KVKK.md](docs/05-compliance/KVKK.md).
- **Sesli asistan tıbbi tavsiye vermez.** Prompt ve tool değişiklikleri [ESCALATION.md](docs/02-voice-agent/ESCALATION.md) belgesine uymalı.
- **Panel yalnızca Türkçe.** i18n altyapısı yok; kullanıcıya görünen metinler doğrudan Türkçe yazılır.
- Yorumlar sadece *neden*i açıklar. Kod ve tanımlayıcılar İngilizce, kullanıcıya görünen metinler ve belgeler Türkçe.

## Git

- Ana dal `main`. Her iş için dal aç: `feat/F1.4-kisa-ad`, `fix/…`, `docs/…`, `chore/…` (görev kimliği plandan).
- Başka bir oturumun commit'lenmemiş yarım işine dokunma; WORKLOG'a not düş.
- [Conventional Commits](https://www.conventionalcommits.org/), görev kimliğiyle: `feat(voice): add retell inbound webhook (F1.5)`.
- Küçük, tek amaçlı commit'ler. Commit öncesi lint, typecheck ve test temiz olmalı.
- Önemli teknik kararlar için `docs/decisions/` altında yeni bir ADR yaz.
