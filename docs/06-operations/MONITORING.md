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

| Araç                         | Faz | Kullanım                          |
| ---------------------------- | --- | --------------------------------- |
| Vercel Observability ve Logs | MVP | İstek süreleri, hatalar           |
| Uptime izleme (UptimeRobot)  | MVP | Üç monitör, 5 dk aralıkla         |
| Sentry                       | MVP | Hata izleme (canlıda açık)        |
| Retell Dashboard             | MVP | Arama kayıtları, gecikme, maliyet |

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

## Kurulu izleme (2026-10-07, hesaplar 2026-10-19)

| Ne                | Nasıl                                                                                                                                                                                                                                              | Durum                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Hata takibi       | Sentry, yalnızca sunucu (`src/instrumentation.ts`, `src/server/observability/sentry.ts`). `SENTRY_DSN` yoksa kapalı. Olaylardan istek gövdesi, sorgu, çerez, başlık, kullanıcı ve breadcrumb silinir (testli)                                      | **Canlıda açık** (2026-10-19)         |
| Alarmlar          | `raiseAlarm()` → `{"msg":"ALARM", ...}` logu + Sentry sorunu (etiket `alarm`). Kaynaklar: kritik denetim kaydı yazılamadı, cron başarısız, klinik işi başarısız, iş bitirilemedi                                                                   | Hazır                                 |
| Uygulama sağlığı  | `GET /api/health` → 200 / 503 (veritabanı)                                                                                                                                                                                                         | Hazır                                 |
| Zamanlanmış işler | `GET /api/health/jobs` → 200 / 503: bir işin son başarılı çalışması 26 saatten eskiyse (`HOURLY_REMINDERS` açıkken saatlik `reminders` işi için 2,5 saat), son çalışma başarısızsa veya 10 dk'dır kalp atışı yoksa. Yalnızca iş adı, durum ve saat | Hazır (ilk kayıtlar 8 Ekim'de oluşur) |
| İş kayıtları      | `job_runs` (gün başına bir satır) ve `job_run_clinics` (klinik bazında ilerleme); 90 gün saklanır                                                                                                                                                  | Hazır                                 |

### Kurulum adımları (2026-10-19'da yapıldı; yeniden kurulum veya alan adı taşıma için)

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

## Alarmlar ve log tabanlı uyarılar (2026-10-09, tam liste 2026-10-17)

| Olay                                      | Kaynak                                                   | Anlamı                                                                                                  | Önerilen uyarı                         |
| ----------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `ALARM audit.critical_write_failed`       | `recordAudit()`                                          | Kritik denetim kaydı yazılamadı, eylem durduruldu                                                       | Hemen e-posta                          |
| `ALARM cron.retention_failed`             | `/api/cron/retention`                                    | Günlük saklama işi (döküm, kayıt, silme kuyruğu) başarısız                                              | Hemen e-posta                          |
| `ALARM cron.notifications_failed`         | `/api/cron/notifications`                                | Günlük bildirim işi başarısız                                                                           | Hemen e-posta                          |
| `ALARM cron.notifications_clinics_failed` | `/api/cron/notifications`                                | İş çalıştı ama bazı kliniklerde bildirim planlanamadı                                                   | Hemen e-posta                          |
| `ALARM cron.notifications_unfinished`     | `/api/cron/notifications`                                | İş süre sınırında bitmedi; kalan bildirimler ertesi güne kaldı                                          | Günlük özet                            |
| `ALARM cron.reminders_failed`             | `/api/cron/reminders` (`HOURLY_REMINDERS`)               | Saatlik hatırlatma işi başarısız (Vercel Pro ile zamanlanır)                                            | Hemen e-posta                          |
| `ALARM cron.reminders_clinics_failed`     | `/api/cron/reminders`                                    | Saatlik iş çalıştı ama bazı kliniklerde başarısız                                                       | Hemen e-posta                          |
| `ALARM cron.provider_deletions_failed`    | `/api/cron/provider-deletions` (`DELETION_QUEUE_HOURLY`) | Saatlik Retell silme işi başarısız (Vercel Pro ile zamanlanır)                                          | Hemen e-posta                          |
| `ALARM callbacks.check_failed`            | günlük `retention` işi                                   | Silinmeye yakın açık geri arama notları kontrol edilemedi (iş yine de tamamlanır)                       | Günlük özet                            |
| `ALARM email.console_in_production`       | `emailProvider()`                                        | Canlıda `EMAIL_PROVIDER=console`: davet ve parola e-postaları gönderilmiyor (FA-30)                     | Hemen e-posta                          |
| `ALARM voice.daily_minutes_reached`       | `admitInboundCall()`                                     | Kliniğin günlük ses dakikası doldu, aramalar reddediliyor (günde bir)                                   | Hemen e-posta                          |
| `ALARM voice.sync_failed`                 | ayar değişikliği sonrası senkron                         | Asistan yeni ayarları alamadı; eski saat ve hizmetlerle konuşuyor (FA-14)                               | Hemen e-posta                          |
| `ALARM voice.inbound_unknown_number`      | gelen arama                                              | Retell'e yönlenen bir numara hiçbir kliniğe bağlı değil; arayan reddediliyor (günde bir)                | Hemen e-posta                          |
| `ALARM voice.inbound_agent_not_synced`    | gelen arama                                              | Kliniğin numarası var ama asistanı senkronize değil; arayan reddediliyor (klinik başına günde bir)      | Hemen e-posta                          |
| `ALARM callbacks.open_near_deletion`      | günlük `retention` işi                                   | Kliniğin 80 günden eski açık geri arama notları var; 90. günde silinecekler (klinik başına sayı, FA-18) | Hemen e-posta; kliniğe haber verin     |
| `ALARM voice.provider_deletion_failing`   | silme kuyruğu                                            | Retell kaydı 3+ denemede silinemedi (KVKK)                                                              | Hemen e-posta                          |
| `metric: audit_write_failed`              | `recordAudit()`                                          | Olağan denetim kaydı yazılamadı (eylem sürdü)                                                           | Günde > 0 ise e-posta                  |
| `call.flagged` (warn)                     | `POST_CALL_FLAGS`                                        | Arama işaretlendi (acil durum, uyuşmayan sonuç)                                                         | Panel rozeti; isteğe bağlı günlük özet |
| `auth.endpoint_blocked` (warn)            | `/api/auth/*`                                            | Kapalı bir oturum uç noktası denendi                                                                    | Saatte > 20 ise e-posta                |
| `tool.failed` (error)                     | `runTool()`                                              | Bir sesli tool hata verdi; asistana dürüst `INTERNAL_ERROR` gitti                                       | Saatte > 3 ise e-posta                 |
| `retell.tool.unavailable` (error)         | `VOICE_TOOL_FAILSAFE`                                    | Tool başlamadan veritabanı hatası (G-03)                                                                | Hemen e-posta                          |
| `retell.event.erased_call_ignored` (warn) | silme sonrası olay                                       | Silinmiş hastanın aramasına geç gelen olay yok sayıldı (G-01)                                           | Yok (beklenen, nadir)                  |
| `panel.patient_identity.failed` (error)   | `PANEL_PATIENT_EDIT`                                     | Hasta bilgisi düzeltme kaydedilemedi (G-02)                                                             | Günde > 0 ise e-posta                  |

Koddaki her `ALARM` adı bu tabloda tam adıyla yer alır; `production-safety.test.ts` farkı CI'da yakalar.

> **2026-10-19'dan beri:** Sentry açık, `ALARM` satırları Sentry sorunu olarak gelir (bildirimi Sentry'deki uyarı kuralı belirler). UptimeRobot üç monitörle 5 dakikada bir bakar: `https://recalltr.company`, `/api/health`, `/api/health/jobs`; e-posta bildirimi denendi. Vercel Hobby'de runtime logu yaklaşık 1 saat tutulur; log tabanlı uyarılar (aşağıdaki `metric:` ve `warn` satırları) için ayrı bir log uyarısı henüz kurulmadı.

Sentry açıksa `ALARM` olayları Sentry sorunu olur (etiket `alarm`); olay metinlerinde telefon, e-posta ve anahtar maskelenir (`src/lib/redact.ts`, testli).

### İsteğe bağlı: iş ayrıntılarını gizleme

1. Uzun rastgele bir değer üret (ör. `openssl rand -hex 24`).
2. Vercel → `HEALTH_JOBS_TOKEN` = bu değer (Production, Sensitive) → Redeploy.
3. Uptime izleyicide `/api/health/jobs` monitörüne özel başlık ekle: `x-health-token: <değer>` (ücretsiz planda başlık yoksa gerekmez: izleyici durum koduyla çalışır).
