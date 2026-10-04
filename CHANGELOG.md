# Changelog

Bu dosya [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) biçimini, sürümleme ise [SemVer](https://semver.org/lang/tr/) kurallarını izler.

## [Unreleased]

### Added

- Next.js 16 proje iskeleti, araç zinciri (ESLint, Prettier, Vitest, Drizzle).
- Ürün, mimari, sesli asistan, telefon, panel, uyum ve operasyon belgeleri.
- Veri modeli (klinik, personel, hizmet, çalışma saatleri, hasta, randevu, arama).
- Müsaitlik hesaplama motoru ve testleri.
- `/api/health` sağlık kontrolü.
- Retell AI ses katmanı: `/api/voice/retell/{inbound,tools,events}` uç noktaları, imza doğrulama, klinik başına ajan senkronu (`pnpm voice:sync`), ses listeleme (`pnpm voice:voices`), imzalı test istekleri (`pnpm voice:send`).
- `voice_agents` ve `phone_numbers` tabloları (klinik başına ajan, çoklu numara).
- Docker'sız lokal Postgres (`pnpm db:local`).
- Belgeler: fazlı uygulama planı, WORKLOG, Retell kurulum rehberi, ADR-004/005/006.

### Changed

- Prompt, sağlayıcıdan bağımsız bir şablona dönüştü; arama anı değerleri değişkenlerle gelir.
- Arama kaydı olayları yalnızca gelen alanları yazar; arama sonucu öncelik sırasıyla korunur.
- Duraklatılmış kliniklerde sesli randevu oluşturma ve erteleme sunucu tarafında engellenir.

### Removed

- Vapi adaptörü, uç noktası ve `VAPI_*` / `VOICE_*` ortam değişkenleri (ADR-004).
