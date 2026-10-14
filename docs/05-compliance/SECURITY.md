# Güvenlik

## Tehdit modeli (özet)

| Tehdit                                        | Önlem                                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kiracılar arası veri sızıntısı                | Satır seviyesi izolasyon kuralları ve testleri ([MULTI-TENANCY.md](../01-architecture/MULTI-TENANCY.md))                                                      |
| Sahte webhook çağrısı (randevu manipülasyonu) | `X-Retell-Signature` HMAC doğrulaması (ham gövde, 5 dk pencere, SDK `verify`); HTTPS zorunlu; kiracı `agent_id` ve `metadata.clinic_id` ile çapraz doğrulanır |
| Prompt injection ile veri çekme               | Tool'lar arayan ve kiracı ile sınırlı; toplu okuma tool'u yok                                                                                                 |
| Hesap ele geçirme (panel)                     | Better Auth; güçlü parola, oturum süresi; 2FA (`PANEL_TWO_FACTOR` anahtarı, varsayılan kapalı)                                                                |
| Gizli anahtarların sızması                    | Sadece Vercel env; repo'da `.env*` yok (`.env.example` hariç)                                                                                                 |
| Loglarda kişisel veri                         | Log kuralları (aşağıda)                                                                                                                                       |
| Bağımlılık açıkları                           | Dependabot / `pnpm audit`                                                                                                                                     |

## Kimlik doğrulama ve yetkilendirme

- Panel: Better Auth oturumu (httpOnly, secure, SameSite=Lax çerez).
- Yetki: Organizasyon üyeliği ve rol (`owner`, `admin`, `staff`, `practitioner`; tek kaynak `src/lib/permissions.ts`). Her panel sayfası ve Server Action `requireClinic()` veya `requirePermission()` ile başlar; konsol `requirePlatformAdmin()`.
- Webhook'lar: Retell imzası (`RETELL_API_KEY`), `CRON_SECRET` (Vercel Cron).

## Şifreleme

- Aktarımda: TLS (Vercel, Neon, Retell varsayılanı). SIP için TLS tercih edilir (F2).
- Durağan veri: Neon disk şifrelemesi (varsayılan).
- Uygulama seviyesi alan şifrelemesi (transkript): Faz 3'te değerlendirilecek.

## Loglama kuralları

- ❌ Loglanmaz: telefon numarası (maskeli hariç: `+90532***4567`), isim, transkript, tool argümanlarındaki kişisel alanlar.
- ✅ Loglanır: `clinicId`, `callId`, tool adı, süre, hata kodu.
- Yardımcı: `src/lib/phone.ts` → `maskPhone()`.

## Gizli anahtarlar

| Değişken                                                           | Nerede                                    |
| ------------------------------------------------------------------ | ----------------------------------------- |
| `DATABASE_URL`                                                     | Vercel (Neon entegrasyonu otomatik ekler) |
| `RETELL_API_KEY` (webhook rozetli; imza doğrulamada da kullanılır) | Vercel env                                |
| `BETTER_AUTH_SECRET`                                               | Vercel env (32+ byte rastgele)            |
| `NETGSM_*`                                                         | Vercel env                                |
| `CRON_SECRET`                                                      | Vercel env                                |

Rotasyon: Yılda bir veya şüphe anında. Webhook secret rotasyonu sırasında geçiş dönemi için iki değer kabul edilebilir (Faz 2).

## Olay müdahalesi

1. **Tespit:** Sentry alarmı, anormal tool çağrısı oranı, klinik bildirimi.
2. **Sınırlama:** İlgili anahtarları döndür; gerekirse kliniği `paused` yap.
3. **Değerlendirme:** Etkilenen klinikler ve veri kapsamı.
4. **Bildirim:** Etkilenen kliniklere gecikmeksizin (KVKK 72 saat kuralı kliniğin yükümlülüğüdür; Recall bilgiyi en kısa sürede sağlar).
5. **Ders çıkarma:** Postmortem `docs/decisions/` veya `docs/incidents/` altında.

## Güvenlik kontrol listesi (her PR)

- [ ] Yeni sorgu `clinicId` ile filtreleniyor mu?
- [ ] Dış girdi Zod ile doğrulanıyor mu?
- [ ] Loglara kişisel veri yazılıyor mu?
- [ ] Yeni env değişkeni `.env.example` dosyasına eklendi mi?
