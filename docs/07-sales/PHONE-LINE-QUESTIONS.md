# Telefon hattı ve SMS: sağlayıcılara soru listesi (Verimor, Netgsm)

_2026-10-17. Ürün sahibinin göndermesi için hazır. Arka plan ve fiyatlar: [PHONE-LINE-OPTIONS.md](PHONE-LINE-OPTIONS.md); Retell'in teknik gereksinimleri oradaki tablodan alındı. Cevaplar en alttaki tabloya işlenir, karar ölçütleri ondan sonra uygulanır._

## Gönderilecek e-posta metni

> **Konu:** Kurumsal SIP trunk ve SMS teklifi: yapay zekâ telefon asistanı (çok klinikli)
>
> Merhaba,
>
> Recall olarak diş kliniklerine gelen telefon aramalarını karşılayan bir yapay zekâ asistanı geliştiriyoruz. Aramalar, kullandığımız ses altyapısına (Retell AI) SIP üzerinden iletilecek. Pilot aşamasında 1–3 klinik, ardından klinik başına ayrı numara planlıyoruz.
>
> Aşağıdaki sorular için yazılı cevap ve fiyat teklifi rica ediyoruz. Mümkünse bir test hesabı veya deneme süresi de görüşmek isteriz.
>
> [Aşağıdaki soru listesi]
>
> Teşekkürler,
> [Ad Soyad, unvan, şirket, telefon]

## Sorular

### A. SIP bağlantısı (Retell'e aktarma)

1. Gelen aramaları harici bir SIP adresine yönlendirebiliyor musunuz? Hedef `sip:sip.retellai.com`, taşıma TCP (tercih) veya TLS.
2. Kimlik doğrulama hangisiyle yapılır: IP izin listesi mi, SIP kullanıcı adı ve parola mı? Retell'in IP aralıklarını (`18.98.16.120/30`, `3.42.144.0/23`, `153.57.128.0/18`) izin listesine ekleyebilir misiniz?
3. Desteklenen kodekler: PCMU (G.711 µ), PCMA (G.711 A), G.722 hangileri?
4. **Arayan numara** (From veya P-Asserted-Identity) Retell'e değiştirilmeden iletilir mi? Numarasını gizleyen arayan nasıl görünür ("anonymous", boş, başka)?
5. **Aranan numara** (To veya Request-URI) iletilir mi? Birden çok kliniği ayırt etmek için buna ihtiyacımız var.
6. Aramanın kliniğe geri aktarılması için **SIP REFER** destekleniyor mu? Desteklenmiyorsa önerdiğiniz yol nedir (ör. giden arama ile köprüleme)?
7. Eşzamanlı çağrı sınırı nedir? Paket veya numara başına mı, hesap başına mı?
8. Ses kalitesi: jitter ve gecikme hedefleriniz; sunucularınız hangi şehirde?
9. Giden arama gerekirse (aktarma, geri arama) ayrı bir "termination" adresi ve ücreti var mı?

### B. Numara

10. 0850 ve coğrafi numara (ör. 0212, 0216, 0312) tahsis süresi ve aylık ücreti.
11. **Numara taşıma:** kliniğin mevcut numarasını size taşımanın süresi, ücreti ve gereken belgeler; taşıma sırasında kesinti olur mu?
12. Kliniğin kendi numarası başka operatörde kalırsa yönlendirme (her zaman, meşgulken, cevapsızda, mesai dışında) için önerdiğiniz yöntem ve maliyeti; yönlendirilen bacak kimden ücretlenir?
13. Birden çok kliniği tek kurumsal hesapta, her birine ayrı numara ve ayrı fatura kalemiyle yönetebilir miyiz?

### C. Ücret

14. SIP trunk modülü / ek dış hat aylık ücreti (KDV dahil mi?).
15. Gelen arama dakika ücreti var mı? SIP trunk'a aktarılan bacak ayrıca ücretlendirilir mi?
16. Dakika paketleri ve paket aşımı; taahhüt süresi ve erken çıkış koşulu.

### D. Kayıt, kişisel veri ve güvenlik (KVKK)

17. Sizin tarafınızda ses kaydı tutuluyor mu? Tutuluyorsa ne kadar süre, kapatılabilir mi?
18. Çağrı kayıtları (CDR: numara, saat, süre) ne kadar süre saklanıyor?
19. Veri işleyen sözleşmesi (DPA) imzalıyor musunuz? Veriler Türkiye'de mi tutuluyor?
20. SIP trafiği şifreli (TLS, SRTP) olabilir mi?
21. Dolandırıcılık ve kötüye kullanım için koruma (giden arama kilidi, harcama tavanı) var mı?

### E. SMS (yalnızca Netgsm; Verimor sunuyorsa ona da)

22. SMS API'si: kimlik doğrulama yöntemi, istek biçimi, teslim raporu (webhook veya sorgu).
23. Gönderici adı (başlık) onayı: süresi, gereken belgeler; başlık Recall adına mı, her klinik adına ayrı mı alınmalı?
24. Türkçe karakterli mesajın uzunluk sınırı ve ücretlendirmesi (bir mesaj kaç karakter, kaç birim sayılır).
25. **İYS:** randevu onayı, iptal, erteleme ve hatırlatma gibi bilgilendirme mesajları için İYS kaydı ve onayı gerekir mi? Takip (tekrar ziyaret) hatırlatması ticari ileti sayılır mı? İYS entegrasyonunu sizin tarafınız mı yapıyor?
26. Fiyat: mesaj başı ücret, paketler, en düşük alım.
27. Gönderim hızı sınırı ve gece saatlerinde gönderim kısıtı var mı?

### F. Sözleşme ve destek

28. Test hesabı veya deneme süresi verebiliyor musunuz? Pilot için kısa süreli sözleşme mümkün mü?
29. Teknik destek kanalı ve çalışma saatleri; arıza bildirimi için hedef yanıt süresi.
30. Planlı bakım ve kesinti bildirimleri nasıl yapılıyor?

## Cevap tablosu

| #   | Konu                              | Verimor | Netgsm |
| --- | --------------------------------- | ------- | ------ |
| 1   | Harici SIP (TCP/TLS)              |         |        |
| 2   | Kimlik doğrulama, IP izin listesi |         |        |
| 3   | Kodekler                          |         |        |
| 4   | Arayan numara iletimi             |         |        |
| 5   | Aranan numara iletimi             |         |        |
| 6   | SIP REFER                         |         |        |
| 7   | Eşzamanlı çağrı                   |         |        |
| 10  | Numara tahsisi                    |         |        |
| 11  | Numara taşıma                     |         |        |
| 12  | Yönlendirme maliyeti              |         |        |
| 14  | Aylık ücret                       |         |        |
| 15  | Gelen dakika ücreti               |         |        |
| 17  | Ses kaydı                         |         |        |
| 19  | DPA, veri yeri                    |         |        |
| 23  | SMS başlığı                       |         |        |
| 25  | İYS                               |         |        |
| 26  | SMS fiyatı                        |         |        |
| 28  | Test hesabı                       |         |        |

## Karar ölçütleri (sırasıyla)

1. **Engelleyici:** 1, 4, 5 "evet" olmalı. Arayan numara iletilmezse arayan kimliği kuralı ([ADR-011](../decisions/ADR-011-caller-identity.md)) çalışmaz; aranan numara iletilmezse klinik ayırt edilemez.
2. **Önemli:** 6 (aktarma) ve 19 (DPA). Aktarma yoksa acil durum ve "insanla görüşmek istiyorum" akışları yalnızca geri arama notuyla kalır.
3. Klinik başına aylık maliyet (14 + 15 + numara).
4. Netgsm hem hat hem SMS için uygunsa tek sağlayıcı tercih edilir (işletme kolaylığı).

## Cevaplar gelince (Claude)

Seçilen sağlayıcıyla, Retell'in **dev** çalışma alanında:

1. Numara Retell'e aktarılır ve dev kliniğine bağlanır.
2. Gerçek bir telefondan test araması yapılır: arayan numaranın geldiği ve gelen arama webhook'unun kliniği bulduğu doğrulanır.
3. Aktarma varsa C6 (insanla görüşme) denenir.

Canlı numara yalnızca bu testler geçtikten ve canlı Retell kredisi yüklendikten sonra.
