# Yol Haritası

Ürün seviyesinde özet (durumlar 2026-10-14, plandaki faz tablosuyla aynı; 🟡 = kısmen). **Görev düzeyindeki ayrıntılar, kabul kriterleri ve sıralama [IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) belgesindedir.** İlerleme kaydı: [WORKLOG.md](../../WORKLOG.md).

| Faz | Ürün çıktısı                                                                         | Durum |
| --- | ------------------------------------------------------------------------------------ | ----- |
| F0  | Belgeler, iskelet, veri modeli, randevu motoru, testler                              | ✅    |
| F1  | Retell üzerinde kliniğe özel Türkçe sesli asistan, web call ile uçtan uca randevu    | 🟡    |
| F2  | Gerçek Türk numarası (Netgsm SIP ve alternatifler), SMS onay ve hatırlatma           | ⏳    |
| F3  | Klinik hesapları, ekip üyeleri, roller ve izinler, panel kişiselleştirme altyapısı   | ✅    |
| F4  | DESIGN.md tasarım sistemi, bileşen kütüphanesi, yeni tanıtım sitesi                  | 🟡    |
| F5  | Klinik paneli: Bugün, Takvim, Randevular, Aramalar, Hastalar, Geri aramalar, Ayarlar | ✅    |
| F6  | Recall yönetim konsolu: klinik oluşturma, numara bağlama, izleme                     | 🟡    |
| F7  | KVKK: anonimleştirme, dışa aktarma, saklama, güvenlik sertleştirme                   | 🟡    |
| F8  | Production: Vercel, Neon, alan adı, izleme                                           | 🟡    |
| F9  | Pilot: 3 klinik, 2 hafta, metrikler                                                  | ⏳    |
| F10 | V1+: faturalandırma, self-servis, Google Calendar, WhatsApp, giden arama, çoklu dil  | ⏳    |

## Başarı ölçütleri (pilot sonu)

- İnsana devredilmeden tamamlanan arama oranı ≥ %70
- Randevu niyetli aramalarda randevu oluşturma ≥ %80
- Hatalı randevu < %1
- Tur gecikmesi p95 < 1,8 sn

Ayrıntılar: [PRD.md](PRD.md)
