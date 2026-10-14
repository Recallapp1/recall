# Bildirimler

## Kanallar

| Kanal                   | Faz | Sağlayıcı             |
| ----------------------- | --- | --------------------- |
| SMS                     | MVP | Netgsm                |
| WhatsApp                | V2  | WhatsApp Business API |
| E-posta (kliniğe rapor) | V1  | Resend                |

## SMS tipleri

Metinler kodda: `smsTemplates` (`src/server/notifications/sms.ts`). Hasta adı, hizmet ve tedavi yazılmaz (sağlık verisi; KVKK).

| Tip                | Tetikleyici                        | Metin (örnek)                                                                                                                                     |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onay               | Randevu oluşturuldu                | `{{clinic}}: 20 Ekim Salı saat 10:00 için randevunuz oluşturuldu. Adres: {{address}}. Değişiklik için bu numarayı arayabilirsiniz.` (adres varsa) |
| İptal              | Randevu iptal edildi               | `{{clinic}}: 20 Ekim Salı saat 10:00 randevunuz iptal edildi. Yeni randevu için bizi arayabilirsiniz.`                                            |
| Erteleme           | Randevu ertelendi                  | `{{clinic}}: Randevunuz 20 Ekim Salı saat 10:00 olarak güncellendi.`                                                                              |
| Hatırlatma         | Randevudan önce (günlük iş)        | `{{clinic}}: 20 Ekim Salı saat 10:00 randevunuzu hatırlatırız. Gelemeyecekseniz lütfen bizi arayın.`                                              |
| Takip hatırlatması | Takip planında vakti gelen ziyaret | `{{clinic}}: Merhaba, takip ziyaretiniz için randevu planlamak üzere sizi bekliyoruz. Uygun bir zaman için bizi arayabilirsiniz.`                 |

- Şablonlar 160 karakterin altında tutulur (Türkçe karakterler UCS-2 kodlamaya geçirir ve limiti 70'e düşürebilir; Netgsm'in Türkçe karakter desteği ile ölçülecek).
- Gönderici adı (başlık): Recall'un onaylı başlığı veya kliniğin kendi başlığı (Faz 3).

## Hukuki not: İYS ve ticari ileti

Randevu onayı ve hatırlatma, hasta ile klinik arasındaki hizmet ilişkisine dair **bilgilendirme** iletileridir ve ticari ileti değildir. Bu iletilere **kampanya veya tanıtım içeriği eklenmez**. Aksi hâlde İYS onayı gerekir. Hukuk danışmanıyla teyit edilecek ([KVKK.md](../05-compliance/KVKK.md)).

## Uygulama

- Arayüz: `src/server/notifications/sms.ts` → `SmsProvider { send(to, body) }`.
- Adaptörler: `NetgsmSmsProvider` (prod), `ConsoleSmsProvider` (lokal; numarayı maskeleyip konsola yazar).
- Seçim: `SMS_PROVIDER=netgsm|console`.
- Gönderim randevu transaction'ından **sonra** yapılır. SMS hatası randevuyu geri almaz, hata loglanır.
- Faz 2: `notifications` tablosu (tip, randevu, durum, sağlayıcı mesaj ID'si) ile idempotency ve hatırlatmaların tekrar gönderilmemesi sağlanır.

## Uygulama (V0, 2026-10-06)

- **Kayıt:** `notifications` tablosu. Her mesaj için bir satır: tür, konu (randevu), `dedupe_key`, şablon anahtarı, durum ve gönderilmeme sebebi. **Mesaj metni ve telefon saklanmaz.**
- **İş:** `/api/cron/notifications`, her gün 07:00 UTC (10:00 İstanbul). Vercel Hobby'de bu saatin içinde herhangi bir dakikada başlar (10:00–10:59 İstanbul); Pro'da tam 10:00. Klinik klinik çalışır; önce planlar, sonra gönderir. Gönderim yalnızca kliniğin yerel 09:00–20:00 aralığında yapılır. **[PLAN: Hobby]**
- **Randevu hatırlatması** bir gün önce gönderilir. İşten sonra alınan yarın sabahki randevular `skipped(too_late)` olarak kaydedilir (saatlik iş Vercel Pro ile).
- **Gerçek SMS kilitleri:** üçü de açık olmadan sağlayıcı çağrılmaz.
  1. `SMS_SENDING_ENABLED=true`: production'da tanımlı değil.
  2. Teslim eden sağlayıcı (`SMS_PROVIDER=netgsm`).
  3. Kliniğin hatırlatma ayarı.
- **Gönderimin güvenceleri:**
  - en fazla bir kez gönderim: takılan gönderim `unknown` olur, yeniden denenmez;
  - en fazla 3 deneme;
  - klinik başına günde 100, hasta başına günde 1 SMS.
- **Şablonlar genel:** hasta adı, hizmet veya tedavi yok (onay, iptal, erteleme ve hatırlatma).
- **Hasta "SMS istemiyor":** `patients.sms_opt_out_at`. Dolu olunca tüm mesajlar `skipped(opted_out)` olur.

## Tek gönderim yolu (2026-10-07)

Hastaya giden **her** SMS bildirim kaydından (`notifications`) geçer; hiçbir kod sağlayıcıyı doğrudan çağırmaz.

- Sesli asistanın onay, iptal ve erteleme SMS'leri artık birer kayıttır (`appointment_confirmation`, `appointment_cancellation`, `appointment_rescheduled`; migration `0011`). Tool kaydı açar, yanıttan sonra kliniğin bekleyen mesajları hemen gönderilir (`dispatchClinicNotifications`). Gönderilemeyen her şeyi günlük iş tamamlar.
- Bu mesajlar da üç kilitten (ana anahtar, sağlayıcı `delivers`, kliniğin "SMS onayı" ayarı), "SMS istemiyor"dan, 09:00–20:00 penceresinden ve sınırlardan geçer; her biri kayıtta durur (gönderildi veya atlanma sebebi).
- Hasta başına günlük sınır kategoriye göre: hatırlatmalar 1, arayanın tetiklediği mesajlar 5 (döngü koruması). Klinik başına günde 100 tümü için ortak.
- Gönderim anında konu hâlâ geçerli olmalı: onay ve erteleme mesajı randevu aktifken, iptal mesajı randevu hâlâ iptalken gider; aksi hâlde `subject_changed`.
- Asistan "SMS gönderdik" demeden önce: kayıt açıldı, hasta "SMS istemiyor" değil ve sağlayıcı gerçekten teslim ediyor olmalı.
- Testli: `production-safety.test.ts` → "single SMS path" (kaynak taraması: sağlayıcının `send`'ini yalnızca dağıtıcı çağırır), `handlers.integration.test.ts` → "SMS from voice tools" (ana anahtar, opt-out, gece, klinik ayarı).
