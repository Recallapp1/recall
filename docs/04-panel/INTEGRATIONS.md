# Entegrasyonlar

MVP'de Recall paneli **tek doğru kaynak**tır (source of truth). Entegrasyonlar V1 ve sonrasında gelecek.

## Yol haritası

| Entegrasyon | Faz | Yön | Not |
|---|---|---|---|
| Google Calendar | V1 | İki yönlü | Hekim başına takvim; dış etkinlikler "meşgul" olarak müsaitliği bloke eder |
| Outlook / Microsoft 365 | V2 | İki yönlü | |
| Türk klinik yazılımları (diş klinikleri için yaygın yazılımlar) | V2 | Yazılıma göre | API olup olmadığı yazılım bazında araştırılacak |
| Webhook (genel) | V1 | Giden | `appointment.created`, `appointment.cancelled`, `call.completed`: kliniğin kendi sistemine |
| iyzico / Stripe | V1 | — | Faturalandırma |
| Resend | V1 | Giden | Haftalık rapor e-postası |

## Tasarım ilkeleri

1. **Müsaitlik motoru tek yerde:** Dış takvimlerden gelen meşguliyetler `busy_blocks` olarak normalize edilir ve aynı motor tarafından kullanılır.
2. **Senkronizasyon arka planda:** Arama sırasında dış API'ye gidilmez (gecikme bütçesi). Dış takvim periyodik ve webhook ile senkronlanıp yerel tabloya yazılır.
3. **Çakışma politikası:** Recall'da oluşturulan randevu dış takvime yazılır. Dış takvimde oluşturulan etkinlik Recall'da sadece meşguliyet olarak görünür.
4. **Adaptör deseni:** `src/server/integrations/<sağlayıcı>/`, ortak `CalendarProvider` arayüzü.

## Giden webhook (V1) taslağı

```json
POST <klinik URL'i>
X-Recall-Signature: sha256=<HMAC>

{
  "event": "appointment.created",
  "occurredAt": "2026-11-05T11:30:00Z",
  "data": { "appointmentId": "…", "startsAt": "…", "service": "…", "practitioner": "…", "source": "voice" }
}
```
