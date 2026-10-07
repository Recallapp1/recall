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

## Arayan kimliği (find / cancel / reschedule), [ADR-011](../decisions/ADR-011-caller-identity.md)

| Durum                                                              | Kimlik                                                                                     | Ne açıklanır / değiştirilir                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Arayan numara biliniyor (gerçek telefon araması)                   | Operatörün verdiği numara. Modelin gönderdiği `phone` **yok sayılır**                      | Yalnızca o numaraya kayıtlı randevular                                         |
| Arayan numara gizli veya yok (gizli numara, tarayıcı test araması) | Söylenen numara + `verification` (ad soyad, randevu tarihi ve saati; hasta kendisi söyler) | Doğrulama geçmeden hiçbir şey; geçince yalnızca tarih, saat ve `appointmentId` |

- Doğrulama sonucu her hatada aynıdır (`VERIFICATION_FAILED`); numara, ad veya tarihten hangisinin yanlış olduğu söylenmez.
- Başarısız doğrulama sayılır: arama başına 3, numara başına günde 5 (Postgres `rate_limits`). Sonra doğru cevap da reddedilir (`TOO_MANY_ATTEMPTS`) ve geri arama önerilir.
- Ad karşılaştırması büyük/küçük harf, Türkçe harf (ş→s, ı→i), noktalama ve kelime sırasından bağımsızdır; her kelime eşleşmelidir.

## `find_appointments`

Hastanın gelecekteki aktif randevularını bulur.

| Argüman      | Tip    | Zorunlu                  | Not                                                 |
| ------------ | ------ | ------------------------ | --------------------------------------------------- |
| phone        | string | Arayan numara gizliyse ✓ | Arayan numara biliniyorsa yok sayılır               |
| verification | object | Arayan numara gizliyse ✓ | `{ patientName, appointmentDate, appointmentTime }` |

Arayan numara gizliyse ve `verification` yoksa yanıt her numara için aynıdır: `{ ok: true, verificationRequired: true }`. Randevu olup olmadığı söylenmez.

Güvenlik: Arayan numara biliniyorsa dönüşte tarih, saat, hizmet, hekim ve maskeli ad (`A*** Y***`) bulunur. Doğrulamayla bulunan randevularda yalnızca tarih, saat ve `appointmentId` döner.

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

Hatalar: `SLOT_UNAVAILABLE`, `INVALID_SERVICE`, `INVALID_PRACTITIONER`, `OUTSIDE_BOOKING_WINDOW`, `PHONE_REQUIRED`, `INVALID_PHONE`, `PATIENT_BUSY`.

**Doğrulanmamış numara (2026-10-07):** `patientPhone` arayan numaradan farklıysa (başkası adına veya gizli numarayla randevu) asistan o numaranın mevcut randevuları hakkında hiçbir şey öğrenmez: `PATIENT_BUSY` yerine `SLOT_UNAVAILABLE` döner ve aynı saatteki mevcut randevu yalnızca ad soyad da eşleşirse "zaten var" olarak döndürülür.

**`PATIENT_BUSY` (2026-10-06):** Sesli asistanla alınan randevu, aynı telefon numarasının çakışan aktif randevusuyla örtüşemez. Canlı testte yanlış duyulan ikinci bir hizmet ("sekiz Ekim" → "çekim") arayanın kendi saatine yazılmaya çalışıldı; bunu sunucu tarafında kapatır. Aynı randevunun tekrarlanan çağrısı (idempotency) ve panelden personel kayıtları etkilenmez.

> **Bilinen sınırlama:** Hasta kimliği telefon numarasıdır. Aynı numaradan bir aile üyesi için **aynı saate** randevu istenirse de reddedilir; asistan başka saat önerir veya personel panelden kaydeder. Olası sonraki adım: "başkası adına randevu" akışı. Asistan randevunun kimin için olduğunu sorar ve ikinci kişiyi ayrı hasta olarak kaydeder. Bu, hasta kimliğinin yalnızca telefona bağlı olmamasını gerektirir (şema değişikliği).

## `cancel_appointment`

| Argüman             | Tip  | Zorunlu                  |
| ------------------- | ---- | ------------------------ |
| appointmentId       | uuid | ✓                        |
| phone, verification |      | Arayan numara gizliyse ✓ |

Randevu arayan numaraya ait olmalıdır; arayan numara gizliyse `verification` da eşleşmelidir. Hatalar: `NOT_FOUND`, `TOO_LATE_TO_CANCEL`, `VERIFICATION_REQUIRED`, `VERIFICATION_FAILED`, `TOO_MANY_ATTEMPTS`.

## `reschedule_appointment`

| Argüman             | Tip  | Zorunlu                  |
| ------------------- | ---- | ------------------------ |
| appointmentId       | uuid | ✓                        |
| date, time          |      | ✓                        |
| practitionerId      | uuid |                          | Belirtilmezse aynı hekim |
| phone, verification |      | Arayan numara gizliyse ✓ |

Kimlik kuralları `cancel_appointment` ile aynıdır. Atomiktir: yeni slot ayrılamazsa eski randevu korunur.

## `create_callback_request`

| Argüman     | Tip    | Zorunlu |
| ----------- | ------ | ------- |
| reason      | string | ✓       |
| patientName | string |         |
| phone       | string |         | Belirtilmezse arayan numara |

Panelde "Geri aranacaklar" listesine düşer.

## Platform tool'ları (Retell yerleşik)

| Tool            | Retell tipi     | Ne zaman eklenir                                                                                                                        |
| --------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `transfer_call` | `transfer_call` | `clinics.transfer_phone_number` tanımlıysa (cold transfer). Prompt, yalnızca `{{transfer_available}}` "evet" iken kullanılmasını söyler |
| `end_call`      | `end_call`      | Her zaman. Görüşme doğal olarak bittiğinde                                                                                              |

## Retell'e nasıl aktarılır

Her tool, senkron sırasında Retell LLM'ine **custom function** olarak eklenir ([agent-spec.ts](../../src/server/voice/providers/retell/agent-spec.ts)):

| Alan                     | Değer                                                           |
| ------------------------ | --------------------------------------------------------------- |
| `url`                    | `${APP_URL}/api/voice/retell/tools` (tüm tool'lar tek uç nokta) |
| `method`                 | `POST`, gövde `{ name, args, call }`                            |
| `parameters`             | Zod şemasından üretilen JSON Schema                             |
| `speak_during_execution` | `fillerMessage` varsa açık ("Hemen takvime bakıyorum.")         |
| `timeout_ms`             | 10 sn                                                           |

Duraklatılmış (`paused`) kliniklerde `book_appointment` ve `reschedule_appointment` sunucu tarafında `CLINIC_PAUSED` döner; prompt kuralına ek bir savunma katmanıdır.

## Yeni tool ekleme

1. `src/server/voice/tools/<isim>.ts` içinde `defineTool({ name, description, input, handler })`.
2. `src/server/voice/tools/index.ts` registry'sine ekle.
3. Bu belgeye ve [SYSTEM-PROMPT.md](SYSTEM-PROMPT.md) akışına ekle.
4. Birim testi ve en az bir senaryo testi yaz.
