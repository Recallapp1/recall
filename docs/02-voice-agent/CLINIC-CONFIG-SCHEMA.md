# Klinik Konfigürasyonu

Bir kliniğin asistanı iki kaynaktan beslenir:

1. **İlişkisel veri:** `clinics`, `practitioners`, `services`, `working_hours`, `time_off`. Panelden yönetilir. Bkz. [DATA-MODEL.md](../01-architecture/DATA-MODEL.md).
2. **`clinics.settings` (jsonb):** Asistanın davranış ayarları. Şema: [`src/server/domain/clinic-settings.ts`](../../src/server/domain/clinic-settings.ts) (Zod).

## `settings` şeması

```ts
{
  assistant: {
    name: string                    // "Elif": asistanın kendini tanıttığı ad
    greeting?: string               // Özel karşılama; yoksa varsayılan şablon
    voiceId?: string                // TTS ses ID'si; yoksa platform varsayılanı
    speakPrices: boolean            // Fiyat aralığı söylensin mi? (varsayılan: false)
    recordCalls: boolean            // Ses kaydı + anons (varsayılan: true)
    extraInstructions?: string      // Kliniğe özel ek talimat (max 1000 karakter)
    faq: { q: string; a: string }[] // Sık sorulanlar (max 20)
  },
  booking: {
    slotIntervalMinutes: number     // Slot başlangıç aralığı: 15 → 09:00, 09:15… (varsayılan 15)
    minNoticeMinutes: number        // En erken kaç dk sonrasına randevu (varsayılan 60)
    maxDaysAhead: number            // En fazla kaç gün ileriye (varsayılan 30)
    cancellationMinNoticeHours: number // Bundan az kala iptal asistanla yapılamaz (varsayılan 0 = serbest)
    allowPractitionerChoice: boolean   // Hastaya hekim tercihi sorulsun mu? (varsayılan true)
  },
  notifications: {
    smsConfirmation: boolean        // varsayılan true
    smsReminderHoursBefore: number | null // varsayılan 24, null = kapalı
  }
}
```

Tüm alanların varsayılanı vardır; boş `{}` geçerli bir config'tir.

## Örnek: diş kliniği

```json
{
  "assistant": {
    "name": "Elif",
    "speakPrices": false,
    "recordCalls": true,
    "faq": [
      { "q": "Otopark var mı?", "a": "Binanın arkasında ücretsiz otopark var." },
      { "q": "Kredi kartı geçiyor mu?", "a": "Evet, tüm kartlar ve taksit seçenekleri geçerli." }
    ],
    "extraInstructions": "İmplant soran hastalara önce ücretsiz muayene randevusu öner."
  },
  "booking": {
    "slotIntervalMinutes": 15,
    "minNoticeMinutes": 120,
    "maxDaysAhead": 45,
    "cancellationMinNoticeHours": 24,
    "allowPractitionerChoice": true
  },
  "notifications": { "smsConfirmation": true, "smsReminderHoursBefore": 24 }
}
```

## Örnek: güzellik kliniği

```json
{
  "assistant": {
    "name": "Deniz",
    "greeting": "Bella Estetik'e hoş geldiniz, ben Deniz!",
    "speakPrices": true,
    "recordCalls": true,
    "faq": [{ "q": "Lazer epilasyon kaç seans?", "a": "Genellikle 6 ile 8 seans arası; uzmanımız ilk görüşmede netleştirir." }]
  },
  "booking": { "slotIntervalMinutes": 30, "minNoticeMinutes": 60, "maxDaysAhead": 60, "cancellationMinNoticeHours": 12, "allowPractitionerChoice": false }
}
```

## Doğrulama ve sürümleme

- `settings` her okunduğunda Zod ile parse edilir; eksik alanlar varsayılanla doldurulur.
- Panelden kaydedilirken de aynı şema ile doğrulanır.
- Şemaya alan eklemek geriye dönük uyumludur (varsayılan zorunlu). Alan kaldırmak veya anlamını değiştirmek bir data migration gerektirir.
