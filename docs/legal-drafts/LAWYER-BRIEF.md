# Avukat için brif: Recall sesli asistanı ve KVKK

> **DRAFT, not reviewed by a lawyer.** TASLAK — avukat incelemesinden geçmedi. Bu belge avukata sorulacak soruları ve gereken bağlamı toplar; hukuki görüş değildir.

_Hazırlayan: Recall ürün ekibi (Claude yardımıyla), 2026-10-09._

## 1. Ürün özeti

- **Recall**, diş, sağlık ve güzellik kliniklerine gelen telefon aramalarını karşılayan Türkçe bir yapay zekâ sesli asistanı ve kliniklerin randevularını gördüğü bir web paneli sunar (çok kiracılı SaaS).
- Asistan: randevu oluşturur, iptal eder, erteler, klinik hakkında bilgi verir, geri arama notu bırakır, acil durumda 112'yi aramayı söyler, tıbbi tavsiye vermez.
- İşlenen kişisel veriler: arayanın telefon numarası, adı soyadı, randevu bilgileri (hizmet, hekim, tarih), görüşmenin ses kaydı (klinik açarsa), görüşme dökümü ve özeti, geri arama notu (şikâyet içerebilir), klinik personelinin hesap bilgileri.
- Hizmet ve randevu adı (ör. "kanal tedavisi", "implant muayenesi") ve görüşmede anlatılan şikâyetler **sağlık verisi** sayılabilir.

## 2. Roller (bizim varsayımımız; teyit isteniyor)

| Taraf                                                                                                 | Rol (varsayım)      |
| ----------------------------------------------------------------------------------------------------- | ------------------- |
| Klinik                                                                                                | Veri sorumlusu      |
| Recall (şirket kurulacak)                                                                             | Veri işleyen        |
| Retell AI (ABD), içindeki LLM ve ses sağlayıcıları, Vercel, Neon, Resend, Sentry, SIP/SMS sağlayıcısı | Alt veri işleyenler |

## 3. Sorular

### A. Hukuki dayanak ve özel nitelikli veri

1. Sesli asistanın randevu için işlediği hizmet adı ve şikâyet bilgisi KVKK m.6 kapsamında **sağlık verisi** midir? Hangi işleme şartına dayanılmalı (açık rıza, m.6/3 "tıbbi teşhis, tedavi … yürütülmesi" için sır saklama yükümlülüğü altındaki kişiler istisnası klinik için geçerli mi, Recall için nasıl)?
2. Aramanın başında **açık rıza** almak gerekli mi, yoksa aydınlatma yeterli mi? Gerekliyse sesli onay ("evet") yeterli mi ve nasıl ispatlanır?
3. Klinik "kayıt kapalı" seçerse döküm ve özet tutmaya devam ediyoruz; bu ayrım hukuken anlamlı mı?

### B. Aydınlatma ve kayıt anonsu

4. Görüşme başındaki **aydınlatma anonsu** ne kadar ayrıntılı olmalı (kısa anons + web sitesinde tam metin yeterli mi)? Taslak: [RECORDING-NOTICE-SCRIPT.md](RECORDING-NOTICE-SCRIPT.md).
5. Arayanın bir **yapay zekâ asistanıyla** konuştuğunun açıkça söylenmesi zorunlu mu (tüketici mevzuatı, reklam/haksız ticari uygulama, ileride AB Yapay Zekâ Yasası benzeri düzenlemeler)?
6. Arayan **kayda itiraz** ederse ne yapmalıyız? (Taslak davranış: randevu bilgisi istemeden kayıtsız hattan geri arama önermek.)

### C. Yurt dışına aktarım (KVKK m.9, 2024 değişikliği sonrası)

7. Retell ve onun model/ses sağlayıcıları ABD'de veri işliyor. Hangi mekanizma uygun: Kurul'un ilan ettiği **standart sözleşme**, bağlayıcı şirket kuralları, yoksa arızi aktarım? Standart sözleşmenin **Kurul'a 5 iş günü içinde bildirimi** kime düşer (klinik mi, Recall mı)?
8. Vercel (sunucular Frankfurt, şirket ABD), Neon (AWS Frankfurt), Resend (İrlanda), Sentry (AB) için ayrı değerlendirme gerekir mi?

### D. Sözleşmeler ve VERBIS

9. Klinikle **veri işleme sözleşmesi (DPA)** zorunlu içerik: taslak ana hatlar [DPA-OUTLINE.md](DPA-OUTLINE.md). Alt işleyen değişikliğinde bildirim/itiraz süresi?
10. Recall'un **VERBIS** kaydı gerekir mi (veri işleyen olarak; çalışan/bilanço eşiği)? Kliniklerin VERBIS kaydında Recall'u nasıl göstermeleri gerekir?
11. Klinik ile hizmet sözleşmesi: sorumluluk sınırı, asistanın yanlış randevu vermesi veya acil durumu atlaması hâlinde sorumluluk, sigorta.

### E. Saklama, ilgili kişi hakları, ihlal

12. Önerdiğimiz saklama süreleri uygun mu? (Kayıt 30 gün, döküm 90 gün, arayan numarası 2 yıl, bildirim kaydı 1 yıl, geri arama notu 90 gün, hasta kaydı klinik hesabı süresince; [DATA-RETENTION.md](../05-compliance/DATA-RETENTION.md)). Sağlık mevzuatındaki (hasta kayıtları) saklama yükümlülükleriyle ilişkisi?
13. İlgili kişi başvurusu (m.11) kliniğe gelir; Recall'un destek süresi ne olmalı (30 günlük yasal süre içinde)? Silme talebinde ses sağlayıcısındaki kopyaların silinmesi (bizde kuyruklu ve kayıtlı) yeterli mi?
14. **Veri ihlali** bildirimi: Recall kliniğe ne kadar sürede bildirmeli (taslakta 24 saat)? Kurul'a 72 saat yükümlülüğü klinikte mi?

### F. İletişim ve SMS

15. Randevu onayı/hatırlatma SMS'leri **İYS** kapsamında ticari ileti mi, yoksa işlem/hizmet mesajı mı? Takip (tekrar ziyaret) hatırlatmaları için ayrı onay gerekir mi?
16. Gönderici başlığı Recall mı, klinik mi olmalı?

### G. Diğer

17. Arayan kimliği (caller ID) ile randevu bilgisi paylaşmak yeterli kimlik doğrulaması mı? Aynı numarayı kullanan aile bireyleri için ek doğrulama (ad + tarih + saat) yeterli mi?
18. Klinik personelinin (hekim, sekreter) denetim kayıtlarında işlenmesi için ayrıca aydınlatma gerekir mi?
19. Tıbbi tavsiye vermeme ve "acil durumda 112" yönlendirmesi metinleri hukuken yeterli mi?

## 4. Ekler

- Veri akışı ve alt işleyenler: [DATA-FLOW.md](DATA-FLOW.md)
- Aydınlatma metni taslağı (klinik adına): [KVKK-AYDINLATMA-METNI.md](KVKK-AYDINLATMA-METNI.md)
- Recall gizlilik politikası taslağı: [GIZLILIK-POLITIKASI.md](GIZLILIK-POLITIKASI.md)
- Klinik hizmet koşulları taslağı: [KULLANIM-KOSULLARI.md](KULLANIM-KOSULLARI.md)
- DPA ana hatları: [DPA-OUTLINE.md](DPA-OUTLINE.md)
- Görüşme başı anons: [RECORDING-NOTICE-SCRIPT.md](RECORDING-NOTICE-SCRIPT.md)
- Teknik önlemler: [SECURITY-REVIEW-2026-10.md](../05-compliance/SECURITY-REVIEW-2026-10.md), [PRELAUNCH-AUDIT-2026-10-08.md](../reviews/PRELAUNCH-AUDIT-2026-10-08.md)
