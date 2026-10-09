# Veri İşleme Sözleşmesi (DPA): ana hatlar

> **DRAFT, not reviewed by a lawyer.** TASLAK — avukat incelemesinden geçmedi. Avukatın tam metni hazırlaması için madde iskeleti.

| Madde                       | İçerik (taslak)                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Taraflar ve roller       | Klinik veri sorumlusu, Recall veri işleyen                                                                                                                                                             |
| 2. Konu, süre, nitelik      | Telefon asistanı ve randevu paneli; hizmet sözleşmesi süresince                                                                                                                                        |
| 3. Veri kategorileri        | Kimlik, iletişim, randevu, **sağlık (özel nitelikli)**, ses kaydı, döküm; klinik personeli hesapları ([DATA-FLOW.md](DATA-FLOW.md))                                                                    |
| 4. İlgili kişi grupları     | Arayan hastalar ve hasta yakınları; klinik personeli                                                                                                                                                   |
| 5. Talimatla işleme         | Recall veriyi yalnızca kliniğin yazılı talimatıyla ve hizmet için işler; başka amaçla (ör. model eğitimi) kullanmaz                                                                                    |
| 6. Gizlilik                 | Recall çalışanları gizlilik yükümlülüğü altında; erişim yalnızca destek için, kayıtlı                                                                                                                  |
| 7. Güvenlik önlemleri       | Kiracı yalıtımı, rol bazlı yetki, imzalı webhook'lar, hız sınırları, şifreli bağlantı, denetim kaydı, yedekleme, olay müdahalesi (ekli teknik ve idari tedbirler listesi)                              |
| 8. Alt işleyenler           | Ek liste ([DATA-FLOW.md](DATA-FLOW.md)); yeni alt işleyen için [30] gün önceden bildirim ve itiraz hakkı                                                                                               |
| 9. Yurt dışı aktarım        | KVKK m.9 mekanizması [avukat]; standart sözleşmelerin imzalanması ve Kurul bildirimi kimde                                                                                                             |
| 10. İlgili kişi başvuruları | Recall, panel araçlarıyla (dışa aktarma, anonimleştirme) kliniğe destek olur; yasal 30 günlük süre içinde                                                                                              |
| 11. Veri ihlali             | Recall, öğrendiğinde kliniğe **gecikmeksizin, en geç 24 saat** içinde bildirir; Kurul ve kişilere bildirim için gereken bilgiyi sağlar ([INCIDENT-RESPONSE.md](../06-operations/INCIDENT-RESPONSE.md)) |
| 12. Saklama ve silme        | Saklama süreleri ([DATA-RETENTION.md](../05-compliance/DATA-RETENTION.md)); sözleşme sonunda [30] gün içinde dışa aktarım ve silme, alt işleyenlerdeki kopyalar dahil                                  |
| 13. Denetim hakkı           | Klinik yılda [1] kez makul bildirimle bilgi ve belge talep edebilir                                                                                                                                    |
| 14. Sorumluluk              | Hizmet sözleşmesine atıf; [avukat]                                                                                                                                                                     |
| 15. Ekler                   | A: alt işleyenler; B: teknik ve idari tedbirler; C: saklama süreleri                                                                                                                                   |
