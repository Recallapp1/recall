# Bildirimler

## Kanallar

| Kanal                   | Faz | Sağlayıcı             |
| ----------------------- | --- | --------------------- |
| SMS                     | MVP | Netgsm                |
| WhatsApp                | V2  | WhatsApp Business API |
| E-posta (kliniğe rapor) | V1  | Resend                |

## SMS tipleri

| Tip        | Tetikleyici                   | Şablon                                                                                                                                                             |
| ---------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Onay       | Randevu oluşturuldu           | `{{clinic}}: Sayın {{name}}, {{date}} {{time}} tarihli {{service}} randevunuz oluşturuldu. Adres: {{address}}. İptal/değişiklik için bu numarayı arayabilirsiniz.` |
| İptal      | Randevu iptal edildi          | `{{clinic}}: {{date}} {{time}} tarihli randevunuz iptal edilmiştir. Yeni randevu için bizi arayabilirsiniz.`                                                       |
| Erteleme   | Randevu ertelendi             | `{{clinic}}: Randevunuz {{date}} {{time}} olarak güncellenmiştir.`                                                                                                 |
| Hatırlatma | Randevudan N saat önce (cron) | `{{clinic}}: Yarın {{time}}'de randevunuz bulunmaktadır. Gelemeyecekseniz lütfen bizi arayın.`                                                                     |

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
