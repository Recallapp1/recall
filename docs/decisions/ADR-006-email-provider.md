# ADR-006: E-posta Sağlayıcısı

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| Durum          | Kabul edildi                                         |
| Tarih          | 2026-10-04                                           |
| Karar verenler | Mühendislik (ürün ekibi seçimi mühendisliğe bıraktı) |

## Bağlam

F3 (hesaplar) ile birlikte işlem e-postaları gerekiyor: **ekip daveti**, **parola sıfırlama**, **e-posta doğrulama**; V1'de haftalık rapor. Alıcılar klinik çalışanlarıdır. **Hastalara e-posta gönderilmez** (hasta iletişimi SMS ile, [NOTIFICATIONS.md](../03-telephony/NOTIFICATIONS.md)). Mevcut sistem: Next.js 16 + Vercel, Better Auth (e-posta göndermeyi bizim fonksiyonumuza bırakır), KVKK hassasiyeti, Türkçe şablonlar.

## Seçenekler

| Seçenek                | Artı                                                                                                                                              | Eksi                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Resend**             | Next.js ve Vercel ile en akıcı kurulum; React Email ile tipli şablonlar; Better Auth örnekleri; cömert ücretsiz kota; AB'den (eu-west-1) gönderim | Hesap verisi ve loglar ABD'de tutulur (gönderim bölgesi seçilse bile)    |
| AWS SES (eu-central-1) | En ucuz; veri AB'de                                                                                                                               | Kurulum ve itibar yönetimi (sandbox çıkışı, bounce takibi) daha zahmetli |
| Brevo / Mailjet        | AB şirketi, AB veri yerelliği                                                                                                                     | Geliştirici deneyimi ve Next.js entegrasyonu daha zayıf                  |
| Postmark               | Teslim edilebilirlikte çok iyi                                                                                                                    | ABD; daha pahalı                                                         |

## Karar

**Resend**, bir **adaptör arkasında**:

1. `src/server/notifications/email.ts` → `EmailProvider { send({ to, subject, react|html, text }) }`. Adaptörler: `ResendEmailProvider` (prod), `ConsoleEmailProvider` (lokal; alıcıyı maskeleyip konsola yazar). Seçim `EMAIL_PROVIDER=console|resend`, SMS katmanıyla aynı desen.
2. Şablonlar React Email ile `src/emails/` altında, **Türkçe**, DESIGN.md token'larıyla (Montserrat, lacivert palet, `primary` vurgu).
3. **E-postalar hasta verisi içermez.** Yalnızca klinik adı, davet eden kişinin adı ve tek kullanımlık bağlantılar. Bu kural kod incelemesinde kontrol edilir.
4. Gönderim bölgesi **eu-west-1**; gönderici alan adı Recall'un alan adı (ör. `bildirim@<alan-adı>`), SPF/DKIM/DMARC ile doğrulanır (F8).
5. Env: `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`.

## Sonuçlar

- ✅ F3'te davet ve parola sıfırlama hızlıca devreye girer; lokal geliştirmede gerçek e-posta gitmez.
- ⚠️ Resend bir yurt dışı alt veri işleyendir (çalışan e-posta adresleri). [KVKK.md](../05-compliance/KVKK.md) alt işleyen listesine eklenir.
- 🔁 **Yeniden değerlendirme:** Bir müşteri veya hukuk görüşü AB/TR veri yerelliğini şart koşarsa adaptör AWS SES (eu-central-1) veya Brevo ile değiştirilir; uygulama kodu değişmez.

## Kaynaklar

- Resend bölgeleri: https://www.resend.com/docs/dashboard/domains/regions
- Veri yerelliği notu: https://nuntly.com/blog/email-api-eu-data-residency
