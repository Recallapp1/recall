# İzleme

## Ürün metrikleri (panel ve iç pano)

| Metrik | Kaynak | Hedef |
|---|---|---|
| Arama sayısı (klinik, gün) | `calls` | — |
| Sonuç dağılımı (`outcome`) | `calls.outcome` | booked + info + cancelled ≥ %70 |
| Randevu dönüşüm oranı | randevu niyetli aramalar → `booked` | ≥ %80 |
| Devir oranı | `outcome=transferred` | < %15 |
| Geri arama oranı | `callback_requests` / aramalar | < %10 |
| Ortalama arama süresi | `calls.duration_seconds` | 1,5–3 dk |
| No-show oranı | `appointments.status=no_show` | Hatırlatma sonrası düşmeli |

## Teknik metrikler

| Metrik | Kaynak | Alarm eşiği |
|---|---|---|
| Webhook p95 süresi | Vercel Observability | > 500 ms |
| Webhook hata oranı (5xx) | Vercel / Sentry | > %1 (5 dk) |
| Tool hata oranı (`ok:false`, beklenmeyen) | Uygulama logu | > %5 |
| Tur gecikmesi p95 (konuşma sonu → ilk ses) | Vapi arama raporu | > 1,8 sn |
| `CLINIC_NOT_FOUND` | Uygulama logu | > 0 (yanlış yapılandırma) |
| DB bağlantı hatası | `/api/health` | Herhangi |
| Arama başı maliyet | `calls.cost_usd` | Bütçe sapması > %30 |

## Araçlar

| Araç | Faz | Kullanım |
|---|---|---|
| Vercel Observability ve Logs | MVP | İstek süreleri, hatalar |
| Uptime izleme (Better Stack / UptimeRobot) | MVP | `/api/health` 1 dk aralıkla |
| Sentry | Faz 2 | Hata izleme, release takibi |
| Vapi Dashboard | MVP | Arama kayıtları, gecikme, maliyet |

## Log biçimi

Yapılandırılmış JSON, kişisel veri yok ([SECURITY.md](../05-compliance/SECURITY.md#loglama-kuralları)):

```json
{ "level": "info", "msg": "tool.completed", "clinicId": "…", "callId": "…", "tool": "book_appointment", "ok": true, "ms": 84 }
```

## Nöbet (pilot dönemi)

- Mesai saatlerinde (08:00–20:00) alarmlar ekibe bildirim olarak gider.
- Pilot klinikler için doğrudan WhatsApp destek hattı.
