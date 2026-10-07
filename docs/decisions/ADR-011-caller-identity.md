# ADR-011: Sesli asistanda arayan kimliği ve randevu sahipliği

|                |                                                         |
| -------------- | ------------------------------------------------------- |
| Durum          | Kabul edildi                                            |
| Tarih          | 2026-10-07                                              |
| Karar verenler | Claude (teknik yetki ürün ekibince verildi), ürün ekibi |

## Bağlam

Dış inceleme (Manus) ve kendi doğrulamamız: `find_appointments`, `cancel_appointment` ve `reschedule_appointment` telefon numarasını `input.phone ?? ctx.callerPhone` ile alıyordu. Model bir numara söylediğinde (ör. arayan "0555 999 88 77'ye kayıtlı randevumu iptal edin" dediğinde) arayan numara bilinse bile o numara kullanılıyordu. Sonuç:

- Başkasının numarasını bilen biri o kişinin randevularını öğrenebiliyor (tarih, saat, hizmet, hekim, maskeli ad), iptal edebiliyor veya erteleyebiliyordu.
- Arayan numara gizliyken (gizli numara, tarayıcı test araması) hiçbir ek kontrol yoktu.
- `book_appointment` aynı numara ve saat için mevcut randevuyu (`alreadyExisted`) ve `PATIENT_BUSY` hatasını döndürerek, söylenen bir numaranın o saatte randevusu olduğunu sızdırıyordu.

Doğrulama: önce 9 kötüye kullanım testi yazıldı; 7'si mevcut kodda başarısız oldu (`handlers.integration.test.ts` → "caller identity (abuse cases)").

## Seçenekler

1. **Söylenen numarayı her zaman reddetmek:** gizli numarayla arayan gerçek hasta randevusunu hiç yönetemez.
2. **Söylenen numara + SMS kodu:** güçlü, ama SMS henüz kapalı (Netgsm, İYS) ve sesli akışı uzatır.
3. **Arayan numara biliniyorsa yalnızca o; gizliyse söylenen numara + hastanın kendisinin söylediği ad soyad, randevu tarihi ve saati, deneme sınırıyla.** Hassas bir bilgi istemez, gerçek hastanın bildiği ve numarayı bilen yabancının bilmediği bilgilere dayanır.

## Karar

Seçenek 3.

- Arayan numara biliniyorsa kimlik odur; modelin gönderdiği `phone` sorgu ve değişikliklerde yok sayılır. Hasta başka bir numara söylerse asistan bunun telefonla yapılamayacağını söyler ve geri arama önerir.
- Arayan numara gizliyse `find_appointments` doğrulama olmadan her numara için **aynı** yanıtı verir (`verificationRequired`). `verification` (ad soyad + tarih + saat) eşleşirse yalnızca tarih, saat ve `appointmentId` döner; hizmet, hekim ve ad dönmez. İptal ve erteleme her çağrıda doğrulamayı sunucuda yeniden yapar (önceki bir aramaya güvenmez).
- Hatalar ayırt edilemez (`VERIFICATION_FAILED`). Başarısız deneme arama başına 3, numara başına günde 5; aşılınca doğru cevap da reddedilir (`TOO_MANY_ATTEMPTS`).
- `book_appointment`: numara arayan numaradan farklıysa (veya arayan numara yoksa) `PATIENT_BUSY` yerine `SLOT_UNAVAILABLE` döner, mevcut randevu ancak ad soyad da eşleşirse döndürülür. Başkası adına randevu almak serbest kalır.
- Prompt aynı kuralları anlatır; ama güvenlik prompta değil sunucuya dayanır.

## Sonuçlar

- Gerçek telefon aramalarında (caller ID var) hasta yalnızca kendi numarasına kayıtlı randevuları yönetebilir; iş telefonundan arayıp cep numarasındaki randevuyu iptal etmek isteyen hasta geri arama ile yönlendirilir.
- Gizli numarayla arayan hasta randevusunu ad, tarih ve saatle yönetebilir. Biri bilerek 5 yanlış denemeyle bir numarayı 24 saat kilitleyebilir; bu durumda o numara yalnızca gizli numarayla aramada etkilenir (caller ID ile arama kilitlenmez) ve geri arama yolu açıktır. Kabul edilebilir.
- Ad eşleştirmesi ASR hatalarına toleranslıdır ama tam kelime eşleşmesi ister; adı farklı duyulan hasta geri arama yoluna düşer.
- SMS açıldığında (F2) gizli numaralı aramalar için tek kullanımlık SMS kodu ek bir seçenek olarak yeniden değerlendirilebilir.
