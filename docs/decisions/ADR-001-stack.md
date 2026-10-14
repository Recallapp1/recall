# ADR-001: Uygulama Stack'i

|       |              |
| ----- | ------------ |
| Durum | Kabul edildi |
| Tarih | 2026-10-04   |

## Bağlam

Recall'un panel ve API katmanı küçük bir ekip tarafından hızla geliştirilecek, önce lokalde çalışacak, sonra Vercel'e deploy edilecek. Randevu verisi ilişkiseldir ve çifte rezervasyon kesinlikle engellenmelidir. Sağlık verisi nedeniyle veri AB bölgesinde tutulmalıdır.

## Seçenekler

1. **Next.js + Postgres (Neon) + Drizzle + Vercel**
2. Next.js + Supabase (Auth + DB + RLS)
3. Ayrı backend (NestJS/Fastify) + React SPA

## Karar

**Seçenek 1.**

- **Next.js 16:** Panel ve webhook'lar tek projede; Vercel'de sıfır konfigürasyon.
- **Postgres:** `tstzrange` ve `EXCLUDE USING gist` ile çifte rezervasyonu **veritabanı seviyesinde** engelleyebiliyoruz.
- **Neon:** Vercel Marketplace entegrasyonu, Frankfurt bölgesi. (2026-10-14 notu: uygulamada önizleme deploy'ları ve PR başına dal kapalı; geliştirme ayrı `dev` dalında.)
- **Drizzle:** SQL'e yakın, hafif, migration'lar okunabilir SQL.
- **`pg` sürücüsü:** Aynı kod hem lokal Docker Postgres hem Neon ile çalışır; satıcı bağımlılığı azalır.
- **Better Auth (Faz 2):** Kendi DB'mizde, organizasyon ve rol desteği hazır.

Supabase güçlü bir alternatifti. Ancak Auth ve RLS'ye derin bağımlılık oluşturur, Vercel ile entegrasyonu da Neon kadar doğal değildir.

## Sonuçlar

- ✅ Tek repo, tek deploy, tek dil.
- ✅ Lokal geliştirme internetsiz yapılabilir (PGlite `pnpm db:local` veya Docker); günlük geliştirme Neon `dev` dalında.
- ⚠️ Gerçek zamanlı ses Vercel'de çalışmaz. Ses katmanı ayrı bir servis olmalı ([ADR-002](ADR-002-voice-platform.md)).
- ⚠️ Kiracı izolasyonu uygulama seviyesinde; disiplin ve test gerektirir ([MULTI-TENANCY.md](../01-architecture/MULTI-TENANCY.md)).
