# Tool'lar

Kaynak: [`src/server/voice/tools/`](../../src/server/voice/tools/). Her tool bir **Zod şeması** (argümanlar) ve bir **handler**'dan oluşur. JSON şeması Zod'dan üretilip asistan yapılandırmasına eklenir.

## Ortak kurallar

- Handler'lar `ToolContext { clinicId, callId, callerPhone, timezone, settings }` alır. Kiracı **asla** argümanlardan gelmez.
- Dönüş her zaman şu biçimdedir:
  ```ts
  { ok: true, ...veri } | { ok: false, error: ErrorCode, message: string }
  ```
  `message` LLM'in hastaya aktarabileceği sade Türkçe bir açıklamadır.
- Tarihler `YYYY-MM-DD`, saatler `HH:mm` biçimindedir ve **kliniğin yerel saatini** ifade eder. UTC dönüşümü sunucudadır.
- Tool'lar **idempotent olmaya çalışır**: aynı hasta, aynı slot ve aynı hizmet için ikinci `book_appointment` çağrısı yeni kayıt açmaz, mevcut randevuyu döner.

## `check_availability`

Uygun randevu saatlerini döner.

| Argüman        | Tip                                         | Zorunlu | Not                                      |
| -------------- | ------------------------------------------- | ------- | ---------------------------------------- |
| serviceId      | uuid                                        | ✓       |                                          |
| date           | `YYYY-MM-DD`                                | ✓       | Aranan gün                               |
| practitionerId | uuid                                        |         | Belirtilmezse hizmeti veren tüm hekimler |
| timeOfDay      | `morning` / `afternoon` / `evening` / `any` |         | Varsayılan `any`                         |

```json
{
  "ok": true,
  "date": "2026-11-05",
  "slots": [
    { "time": "10:00", "practitionerId": "…", "practitionerName": "Dt. Can Demir" },
    { "time": "14:30", "practitionerId": "…", "practitionerName": "Dt. Elif Kaya" }
  ],
  "nextAvailableDates": []
}
```

O gün slot yoksa `slots: []` ve sonraki 3 uygun gün `nextAvailableDates` içinde döner. En fazla 6 slot döner; LLM bunlardan 2–3 tanesini sunar.

## `find_appointments`

Hastanın gelecekteki aktif randevularını bulur.

| Argüman | Tip    | Zorunlu | Not                                    |
| ------- | ------ | ------- | -------------------------------------- |
| phone   | string |         | Belirtilmezse arayan numara kullanılır |

Güvenlik: Dönüşte sadece randevu tarihi, saati, hizmet ve hekim bilgisi bulunur. Hasta adı, "Ayşe Hanım adına mı?" teyidi için ilk harf ve soyadı maskeli olarak verilir (`A*** Y***`).

## `book_appointment`

| Argüman        | Tip          | Zorunlu                  |
| -------------- | ------------ | ------------------------ |
| serviceId      | uuid         | ✓                        |
| practitionerId | uuid         | ✓                        |
| date           | `YYYY-MM-DD` | ✓                        |
| time           | `HH:mm`      | ✓                        |
| patientName    | string       | ✓                        |
| patientPhone   | string       | Arayan numara gizliyse ✓ |
| notes          | string       |                          |

Akış: hasta bul veya oluştur → slotun hâlâ uygun olduğunu doğrula → transaction içinde ekle (exclusion constraint son savunma hattı) → SMS kuyruğa al.

Hatalar: `SLOT_UNAVAILABLE`, `INVALID_SERVICE`, `INVALID_PRACTITIONER`, `OUTSIDE_BOOKING_WINDOW`, `PHONE_REQUIRED`.

## `cancel_appointment`

| Argüman       | Tip  | Zorunlu |
| ------------- | ---- | ------- |
| appointmentId | uuid | ✓       |

Randevu arayan hastaya ait olmalıdır (telefon eşleşmesi). Hatalar: `NOT_FOUND`, `TOO_LATE_TO_CANCEL`.

## `reschedule_appointment`

| Argüman        | Tip  | Zorunlu |
| -------------- | ---- | ------- |
| appointmentId  | uuid | ✓       |
| date, time     |      | ✓       |
| practitionerId | uuid |         | Belirtilmezse aynı hekim |

Atomiktir: yeni slot ayrılamazsa eski randevu korunur.

## `create_callback_request`

| Argüman     | Tip    | Zorunlu |
| ----------- | ------ | ------- |
| reason      | string | ✓       |
| patientName | string |         |
| phone       | string |         | Belirtilmezse arayan numara |

Panelde "Geri aranacaklar" listesine düşer.

## Platform tool'ları (Vapi yerleşik)

| Tool           | Ne zaman eklenir                                               |
| -------------- | -------------------------------------------------------------- |
| `transferCall` | `clinics.transfer_phone_number` tanımlıysa. Hedef bu numaradır |
| `endCall`      | Her zaman. Görüşme doğal olarak bittiğinde                     |

## Yeni tool ekleme

1. `src/server/voice/tools/<isim>.ts` içinde `defineTool({ name, description, input, handler })`.
2. `src/server/voice/tools/index.ts` registry'sine ekle.
3. Bu belgeye ve [SYSTEM-PROMPT.md](SYSTEM-PROMPT.md) akışına ekle.
4. Birim testi ve en az bir senaryo testi yaz.
