# İzleme

## Ürün metrikleri (panel ve iç pano)

| Metrik                     | Kaynak                              | Hedef                           |
| -------------------------- | ----------------------------------- | ------------------------------- |
| Arama sayısı (klinik, gün) | `calls`                             | —                               |
| Sonuç dağılımı (`outcome`) | `calls.outcome`                     | booked + info + cancelled ≥ %70 |
| Randevu dönüşüm oranı      | randevu niyetli aramalar → `booked` | ≥ %80                           |
| Devir oranı                | `outcome=transferred`               | < %15                           |
| Geri arama oranı           | `callback_requests` / aramalar      | < %10                           |
| Ortalama arama süresi      | `calls.duration_seconds`            | 1,5–3 dk                        |
| No-show oranı              | `appointments.status=no_show`       | Hatırlatma sonrası düşmeli      |

## Teknik metrikler

| Metrik                                     | Kaynak                    | Alarm eşiği               |
| ------------------------------------------ | ------------------------- | ------------------------- |
| Webhook p95 süresi                         | Vercel Observability      | > 500 ms                  |
| Webhook hata oranı (5xx)                   | Vercel / Sentry           | > %1 (5 dk)               |
| Tool hata oranı (`ok:false`, beklenmeyen)  | Uygulama logu             | > %5                      |
| Tur gecikmesi p95 (konuşma sonu → ilk ses) | Retell `latency` alanları | > 1,8 sn                  |
| `CLINIC_NOT_FOUND`                         | Uygulama logu             | > 0 (yanlış yapılandırma) |
| DB bağlantı hatası                         | `/api/health`             | Herhangi                  |
| Arama başı maliyet                         | `calls.cost_usd`          | Bütçe sapması > %30       |

## Araçlar

| Araç                                       | Faz   | Kullanım                          |
| ------------------------------------------ | ----- | --------------------------------- |
| Vercel Observability ve Logs               | MVP   | İstek süreleri, hatalar           |
| Uptime izleme (Better Stack / UptimeRobot) | MVP   | `/api/health` 1 dk aralıkla       |
| Sentry                                     | Faz 2 | Hata izleme, release takibi       |
| Retell Dashboard                           | MVP   | Arama kayıtları, gecikme, maliyet |

## Log biçimi

Yapılandırılmış JSON, kişisel veri yok ([SECURITY.md](../05-compliance/SECURITY.md#loglama-kuralları)):

```json
{
  "level": "info",
  "msg": "tool.completed",
  "clinicId": "…",
  "callId": "…",
  "tool": "book_appointment",
  "ok": true,
  "ms": 84
}
```

## Nöbet (pilot dönemi)

- Mesai saatlerinde (08:00–20:00) alarmlar ekibe bildirim olarak gider.
- Pilot klinikler için doğrudan WhatsApp destek hattı.

## Kurulu izleme (2026-10-07)

| Ne                | Nasıl                                                                                                                                                                                                         | Durum                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Hata takibi       | Sentry, yalnızca sunucu (`src/instrumentation.ts`, `src/server/observability/sentry.ts`). `SENTRY_DSN` yoksa kapalı. Olaylardan istek gövdesi, sorgu, çerez, başlık, kullanıcı ve breadcrumb silinir (testli) | Kod hazır, hesap bekleniyor           |
| Alarmlar          | `raiseAlarm()` → `{"msg":"ALARM", ...}` logu + Sentry sorunu (etiket `alarm`). Kaynaklar: kritik denetim kaydı yazılamadı, cron başarısız, klinik işi başarısız, iş bitirilemedi                              | Hazır                                 |
| Uygulama sağlığı  | `GET /api/health` → 200 / 503 (veritabanı)                                                                                                                                                                    | Hazır                                 |
| Zamanlanmış işler | `GET /api/health/jobs` → 200 / 503: bir işin son başarılı çalışması 26 saatten eskiyse, son çalışma başarısızsa veya 10 dk'dır kalp atışı yoksa. Yalnızca iş adı, durum ve saat                               | Hazır (ilk kayıtlar 8 Ekim'de oluşur) |
| İş kayıtları      | `job_runs` (gün başına bir satır) ve `job_run_clinics` (klinik bazında ilerleme); 90 gün saklanır                                                                                                             | Hazır                                 |

### Ürün ekibinin yapacakları

**1. Sentry (ücretsiz Developer planı yeterli)**

1. https://sentry.io/signup → hesap aç. Organizasyon oluştururken **Data Storage Location: European Union (Frankfurt)** seç (KVKK; sonradan değiştirilemez).
2. Projects → Create Project → platform **Next.js** → ad `recall` → Create.
3. Gösterilen **DSN**'i kopyala (`https://…@o….ingest.de.sentry.io/…`). Sihirbazın kurulum adımlarını uygulama; kod hazır.
4. Vercel → proje `recall` → Settings → Environment Variables → **Add**: `SENTRY_DSN` = DSN, yalnızca **Production**, Sensitive işaretli → Save.
5. Deployments → son production deploy → ⋯ → **Redeploy**.
6. Sentry → Alerts → Create Alert → Issues → "A new issue is created" → e-posta (varsayılan kural genelde zaten açık).

**2. Uptime izleme (ücretsiz: Better Stack Uptime veya UptimeRobot)**

1. https://betterstack.com/uptime (veya https://uptimerobot.com) → ücretsiz hesap.
2. Monitor 1: URL `https://recalltr.company/api/health`, beklenen durum 200, aralık planın en kısası (3–5 dk), bildirim e-posta (+ istersen telefon uygulaması).
3. Monitor 2: URL `https://recalltr.company/api/health/jobs`, beklenen durum 200, aralık 30–60 dk. **8 Ekim 11:00 (İstanbul) sonrası ekle**: işlerin ilk kaydı o zamana kadar oluşmaz ve uç 503 döner.
4. Alan adı taşınınca iki URL'i de güncelle ([DOMAIN-MIGRATION.md](DOMAIN-MIGRATION.md)).

## Sağlık sözleşmesi (uptime izleyiciler için, 2026-10-09)

| Uç                     | Başarılı                                    | Başarısız                                | Gövde                                                                                                         | Kimlik                  |
| ---------------------- | ------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `GET /api/health`      | 200 `{"status":"ok","db":"ok","version":…}` | 503 `{"status":"degraded","db":"error"}` | Kişisel veri yok                                                                                              | Herkese açık            |
| `GET /api/health/jobs` | 200 `{"status":"ok", …}`                    | 503 `{"status":"late" \| "error", …}`    | `HEALTH_JOBS_TOKEN` tanımlıysa ayrıntı (`jobs`) yalnızca `x-health-token` başlığıyla; durum kodu herkese aynı | Herkese açık durum kodu |

İzleyici yalnızca **HTTP koduna** bakmalı; gövde değişebilir.

## Alarmlar ve log tabanlı uyarılar (2026-10-09)

| Olay                                    | Kaynak               | Anlamı                                                                | Önerilen uyarı                         |
| --------------------------------------- | -------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| `ALARM audit.critical_write_failed`     | `recordAudit()`      | Kritik denetim kaydı yazılamadı, eylem durduruldu                     | Hemen e-posta                          |
| `ALARM cron.*_failed`                   | cron rotaları        | Günlük iş başarısız                                                   | Hemen e-posta                          |
| `ALARM voice.daily_minutes_reached`     | `admitInboundCall()` | Kliniğin günlük ses dakikası doldu, aramalar reddediliyor (günde bir) | Hemen e-posta                          |
| `ALARM voice.provider_deletion_failing` | silme kuyruğu        | Retell kaydı 3+ denemede silinemedi (KVKK)                            | Hemen e-posta                          |
| `metric: audit_write_failed`            | `recordAudit()`      | Olağan denetim kaydı yazılamadı (eylem sürdü)                         | Günde > 0 ise e-posta                  |
| `call.flagged` (warn)                   | `POST_CALL_FLAGS`    | Arama işaretlendi (acil durum, uyuşmayan sonuç)                       | Panel rozeti; isteğe bağlı günlük özet |
| `auth.endpoint_blocked` (warn)          | `/api/auth/*`        | Kapalı bir oturum uç noktası denendi                                  | Saatte > 20 ise e-posta                |

Sentry açıksa `ALARM` olayları Sentry sorunu olur (etiket `alarm`); olay metinlerinde telefon, e-posta ve anahtar maskelenir (`src/lib/redact.ts`, testli).

### İsteğe bağlı: iş ayrıntılarını gizleme

1. Uzun rastgele bir değer üret (ör. `openssl rand -hex 24`).
2. Vercel → `HEALTH_JOBS_TOKEN` = bu değer (Production, Sensitive) → Redeploy.
3. Uptime izleyicide `/api/health/jobs` monitörüne özel başlık ekle: `x-health-token: <değer>` (ücretsiz planda başlık yoksa gerekmez: izleyici durum koduyla çalışır).
