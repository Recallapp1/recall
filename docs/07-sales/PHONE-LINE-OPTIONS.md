# Telefon hattı seçenekleri (Türk numarası → Retell)

_2026-10-09 (denetim C5, plan F2). Fiyatlar sağlayıcıların sitelerinden 2026-10-09'da alındı, KDV dahil olduğu belirtilenler işaretli; **satın almadan önce satış ekibiyle teyit edilmeli.** "Doğrulanmadı" yazan her bilgi ilk görüşmede sorulacak._

## Retell'in istedikleri (resmî belge)

Kaynak: [docs.retellai.com/deploy/custom-telephony](https://docs.retellai.com/deploy/custom-telephony)

| Konu                                  | Retell                                                                                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gelen aramanın gideceği adres         | `sip:sip.retellai.com` (ör. `sip:sip.retellai.com;transport=tcp`)                                                                                                          |
| Taşıma                                | TCP (önerilen), UDP, TLS, mTLS                                                                                                                                             |
| Kimlik doğrulama                      | IP izin listesi **veya** SIP kullanıcı adı ve parolası                                                                                                                     |
| Retell IP aralıkları                  | `18.98.16.120/30` (yalnızca sinyal), `3.42.144.0/23`, `153.57.128.0/18` (+ ABD'ye özel iki aralık)                                                                         |
| Kodekler                              | PCMU, PCMA, G.722                                                                                                                                                          |
| Giden arama / aktarma                 | Sağlayıcının "termination URI"si; aktarma için sağlayıcının **SIP REFER** desteklemesi gerekir                                                                             |
| Arayan numaranın iletilmesi           | Belgede açıkça yazmıyor → **doğrulanmadı**; arayan kimliği kuralımız (ADR-011) buna dayanır, ilk testte doğrulanmalı                                                       |
| Retell'in özel hat için dakika ücreti | Belgede yok; Retell fiyat sayfasında telefon ücreti kendi numaraları için → **doğrulanmadı** (bugünkü maliyet modeli özel hatta Retell telefon ücreti olmadığını varsayar) |

Uygulama tarafı hazır: numara konsolda kliniğe bağlanır, `call_inbound` webhook'u numaradan kliniği ve ajanı bulur, arama sınırları gelen aramada uygulanır.

## Seçenekler

|                       | **Verimor** Bulut Santral + SIP Trunk modülü                                              | **Netgsm** Netsipp (bulut santral)                                           | Uluslararası SIP sağlayıcı (Twilio, Telnyx vb.)                        |
| --------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Kaynak                | [verimor.com.tr/bulut-santral-sistemi](https://www.verimor.com.tr/bulut-santral-sistemi/) | [netgsm.com.tr/fiyatlar/netsipp](https://www.netgsm.com.tr/fiyatlar/netsipp) | —                                                                      |
| Dış sisteme SIP trunk | **Var:** "Sip Trunk modülü" **1.299 ₺/ay**                                                | "Ek dış hat (SIP trunk)": fiyat **sorulmalı**                                | Var (genel)                                                            |
| Santral paketi        | 478 ₺/ay'dan (MINI, 2 kullanıcı + 2 dış hat)                                              | Cep 403 ₺/ay (1 dış hat) … Pro 998 ₺/ay (10 dış hat), KDV dahil              | —                                                                      |
| Dakika                | "Her yöne" paketleri: 250 dk 219 ₺ … 25.000 dk 6.599 ₺                                    | Sayfada yok → **sorulmalı**                                                  | Türkiye için **doğrulanmadı**                                          |
| Numara tipleri        | 0850, coğrafi (0212, 0312…), numara taşıma                                                | 0850, coğrafi, 0800                                                          | Türk numarası verilmesi düzenleme nedeniyle sınırlı → **doğrulanmadı** |
| Eşzamanlı çağrı       | "Sınırsız" (sitede)                                                                       | Paket başına dış hat sayısı (1–10, üstü kurumsal)                            | —                                                                      |
| Arayan numara iletimi | Sitede var (santral içinde); SIP trunk üzerinden Retell'e → **doğrulanmadı**              | **Doğrulanmadı**                                                             | —                                                                      |
| Mevcut ilişki         | Yok                                                                                       | Var (SMS sağlayıcısı olarak planlı, F2.3)                                    | Yok                                                                    |
| BTK / yerel düzenleme | Yetkili işletmeci (numara tahsisi yapıyor)                                                | Yetkili işletmeci                                                            | Türk numarası için yerel işletmeci gerekir → **doğrulanmadı**          |

## Maliyet tahmini (varsayım)

- **Gelen aramalar:** arayan öder; numara sahibine gelen arama genelde ücretsizdir → **doğrulanmalı** (SIP trunk'a aktarılan arama ayrıca ücretlendirilebilir).
- **Kliniğin kendi hattından yönlendirme:** klinik mevcut numarasını Recall numarasına yönlendirirse, yönlendirme bacağı **kliniğin operatöründe giden arama** olarak ücretlenebilir. Pilotta klinikle konuşulmalı; alternatif: yeni 0850/coğrafi numara veya numara taşıma.
- **Verimor ile kaba aylık sabit:** santral 478 ₺ + SIP Trunk modülü 1.299 ₺ ≈ **1.800 ₺/ay** (+ dakika paketi gerekiyorsa); klinik başına mı yoksa tüm klinikler için tek mi olduğu **sorulmalı**.

## Öneri

1. **İlk görüşme Verimor ile:** dış sisteme SIP trunk ürünü yayınlanmış, fiyatı belli, eşzamanlı çağrı sınırsız. Tek bir hesapta birden çok klinik numarası ve Retell'e TCP/TLS ile bağlanma sorulur.
2. **İkinci görüşme Netgsm ile:** SMS için zaten planlanan sağlayıcı; tek sağlayıcıda toplamak işletmeyi kolaylaştırır. Netsipp'in Retell'e SIP trunk verip vermediği ve dakika fiyatları sorulur.
3. Karar ölçütleri: Retell'e bağlantının çalışması (test araması), arayan numaranın iletilmesi, SIP REFER, klinik başına maliyet, destek.

## İlk görüşmede sorulacaklar (her iki sağlayıcıya)

> Gönderilmeye hazır, genişletilmiş liste (e-posta metni, SMS ve İYS, cevap tablosu, karar ölçütleri): [PHONE-LINE-QUESTIONS.md](PHONE-LINE-QUESTIONS.md).

1. Gelen aramaları **harici bir SIP adresine** (`sip:sip.retellai.com`, TCP veya TLS) yönlendirebiliyor musunuz? Kimlik doğrulama: IP izin listesi mi, kullanıcı/parola mı?
2. **Arayan numara** (From / P-Asserted-Identity) Retell'e değiştirilmeden iletilir mi? Gizli numaralı aramalar nasıl görünür?
3. **SIP REFER** (aktarma) destekleniyor mu? Desteklenmiyorsa aktarma nasıl yapılır?
4. Kodekler: PCMU/PCMA/G.722 hangileri?
5. Eşzamanlı çağrı sınırı ve klinik başına numara ücreti; birden çok kliniği tek hesapta yönetebilir miyiz (her kliniğe ayrı numara)?
6. Gelen arama dakika ücreti var mı? SIP trunk'a aktarılan bacak ücretlendirilir mi?
7. 0850 ve coğrafi numara tahsisi süresi; **numara taşıma** süresi ve ücreti.
8. Kliniğin mevcut numarasından yönlendirme (meşgul, cevapsız, mesai dışı) önerdiğiniz yöntem ve maliyeti.
9. Ses kaydı ve kişisel veri: sizin tarafta kayıt tutuluyor mu, ne kadar süre, kapatılabilir mi (KVKK; veri işleyen sözleşmesi)?
10. Sözleşme süresi, taahhüt, test hesabı veya deneme süresi; teknik destek kanalı.

## Sonraki adım

Görüşmelerden sonra sonuçlar bu belgeye işlenir, F2 planı (SIP trunk → Retell import → konsolda numara → test matrisi) seçilen sağlayıcıyla yürütülür. Test araması Retell production kredisi gerektirir.
