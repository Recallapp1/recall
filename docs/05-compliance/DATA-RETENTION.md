# Veri Saklama

> ⚖️ **Tüm süreler hukuki inceleme bekliyor.** Avukat onayına kadar bu değerler çalışma varsayımıdır.

İlke: **İhtiyaç kadar, süre kadar.** Varsayılanlar aşağıdadır; klinik ihtiyacına göre kısaltabilir (uzatma, hukuki gerekçe ister).

| Veri                             | Varsayılan süre                                                            | Süre dolunca                                                                                                             | Sorumlu                    |
| -------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| Ses kaydı                        | **30 gün**                                                                 | Sağlayıcıdan silinir, `recording_url` null yapılır                                                                       | Cron `retention`           |
| Transkript                       | **90 gün**                                                                 | `transcript` null; `summary` kalır                                                                                       | Cron `retention`           |
| Arama özeti ve meta veri         | 2 yıl                                                                      | Anonimleştirilir (numara silinir)                                                                                        | Cron                       |
| Randevu                          | Klinik hesabı aktif olduğu sürece                                          | Hasta anonimleştirmesinde ilişki korunur, kimlik silinir                                                                 | —                          |
| Hasta kaydı                      | Son randevudan sonra 5 yıl (avukatla teyit edilecek)                       | Anonimleştirme                                                                                                           | Henüz yok (elle, panelden) |
| Bildirim kaydı (`notifications`) | **1 yıl** (hukuki inceleme bekliyor)                                       | Silinir; mesaj metni ve telefon zaten saklanmaz                                                                          | Cron `retention`           |
| Uygulama logları                 | Vercel planının saklama süresi (Hobby'de kısa; plan değişince güncellenir) | Otomatik                                                                                                                 | Vercel                     |
| Klinik hesabı kapatıldığında     | 30 gün içinde tüm veri silinir, kliniğe dışa aktarım verilir               | `pnpm clinic:offboard` ([CLINIC-OFFBOARDING.md](../06-operations/CLINIC-OFFBOARDING.md)); production'da henüz açık değil | Operasyon                  |

## Uygulama (2026-10-06)

- **Cron:** `GET /api/cron/retention` her gün 03:30 UTC çalışır (`vercel.json`, `Authorization: Bearer $CRON_SECRET`). [`applyRetention`](../../src/server/domain/retention.ts):
  - 30 günden eski aramaların kayıt bağlantısı silinir;
  - 90 günden eski dökümler silinir;
  - 2 yıldan eski aramalarda arayan numarası silinir.
  - Özet ve arama satırı istatistik için kalır. Yalnızca sayılar loglanır (`cron.retention`).
- **Retell tarafı:** her ajan `data_storage_retention_days: 30` ile kurulur; Retell ses, döküm ve logları 30 günde kendisi siler. Kayıt bağlantıları **imzalı ve 24 saat geçerli** (`opt_in_signed_url`). Panel her dinlemede yeni bağlantı ister; dinleme denetim kaydına yazılır.
- **"Aramaları kaydet" kapalıysa:** Retell'de yalnızca sesi kapatan bir ayar yok. `basic_attributes_only` webhook'tan da döküm ve özeti siliyor (2026-10-05'te gerçek aramayla doğrulandı), bu yüzden kullanılmadı. Bunun yerine arama analizi bize ulaşınca (`call_analyzed`) arama Retell'den silinir ve bizde kalmış olabilecek kayıt bağlantısı temizlenir (2026-10-14, FA-15). Analizi hiç gelmeyen aramalar `RECORDING_OFF_SWEEP` açıkken günlük işte kuyruğa alınır (FA-10); kapalıyken Retell'in 30 günlük silmesini bekler. Döküm ve özet yalnızca bizde kalır ve 90 günlük kurala tabidir.
- **Anonimleştirme** hastayla ilgili aramaları (hangi numaradan gelirse gelsin) Retell'den de siler (ses dahil).
- **Sağlayıcı silme kuyruğu (2026-10-08, denetim P-10):** Retell'den silinecek her arama önce `provider_deletions` tablosuna yazılır (anonimleştirmede aynı transaction içinde), hemen denenir; başarısız olursa 15 dk'dan başlayıp 24 saate kadar artan aralıklarla günlük retention işi yeniden dener. Üçüncü başarısızlıktan itibaren `voice.provider_deletion_failing` alarmı. Satırın `done_at` alanı silmenin kaydıdır; Retell'in 30 günlük kendi silmesi son güvencedir.
- **Dışa aktarma (m.11 bilgi talebi):** Panel → Hastalar → hasta → "Verileri indir" (JSON: hasta, randevular, aramalar, geri arama talepleri). Yetki `patients.export` (sahip ve yönetici); her indirme denetim kaydına yazılır.

## Anonimleştirme

`anonymizePatient(clinicId, patientId)`:

1. `full_name` → `"Anonimleştirilmiş hasta"`, `phone` → `anon:<uuid>`, `notes` → null
2. Hastayla ilgili `calls` (2026-10-08, denetim P-09): hastanın numarasından gelenler, `call_patients` ile hastaya bağlananlar (asistan bu aramada hastanın randevusunu oluşturdu, buldu, iptal etti veya taşıdı; gizli numara veya başka birinin numarası olabilir) ve hastanın randevularını oluşturan aramalar. `from_number`, `transcript`, `summary`, `recording_url` → null; Retell kopyaları silme kuyruğuna yazılır
3. `callback_requests`: hastanın numarasıyla veya silinen bu aramalarda bırakılanlar: `patient_name`, `phone` → null, `reason` → `(anonimleştirildi)`
4. Randevular kalır (istatistik için), kimlik bağı kopmuş olur; randevu notu ve "kimin adına" adı (`booked_for_name`) silinir (2026-10-13, tam denetim FA-01).
