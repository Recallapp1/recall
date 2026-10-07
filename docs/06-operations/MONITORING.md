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
