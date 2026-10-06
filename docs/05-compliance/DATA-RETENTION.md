# Veri Saklama

İlke: **İhtiyaç kadar, süre kadar.** Varsayılanlar aşağıdadır; klinik ihtiyacına göre kısaltabilir (uzatma, hukuki gerekçe ister).

| Veri                         | Varsayılan süre                                              | Süre dolunca                                             | Sorumlu          |
| ---------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- | ---------------- |
| Ses kaydı                    | **30 gün**                                                   | Sağlayıcıdan silinir, `recording_url` null yapılır       | Cron `retention` |
| Transkript                   | **90 gün**                                                   | `transcript` null; `summary` kalır                       | Cron `retention` |
| Arama özeti ve meta veri     | 2 yıl                                                        | Anonimleştirilir (numara silinir)                        | Cron             |
| Randevu                      | Klinik hesabı aktif olduğu sürece                            | Hasta anonimleştirmesinde ilişki korunur, kimlik silinir | —                |
| Hasta kaydı                  | Son randevudan sonra 5 yıl (avukatla teyit edilecek)         | Anonimleştirme                                           | Cron (Faz 3)     |
| Uygulama logları             | 30 gün (Vercel planına bağlı)                                | Otomatik                                                 | Vercel           |
| Klinik hesabı kapatıldığında | 30 gün içinde tüm veri silinir, kliniğe dışa aktarım verilir | —                                                        | Operasyon        |

## Uygulama (2026-10-06)

- **Cron:** `GET /api/cron/retention` her gün 03:30 UTC çalışır (`vercel.json`, `Authorization: Bearer $CRON_SECRET`). [`applyRetention`](../../src/server/domain/retention.ts):
  - 30 günden eski aramaların kayıt bağlantısı silinir;
  - 90 günden eski dökümler silinir;
  - 2 yıldan eski aramalarda arayan numarası silinir.
  - Özet ve arama satırı istatistik için kalır. Yalnızca sayılar loglanır (`cron.retention`).
- **Retell tarafı:** her ajan `data_storage_retention_days: 30` ile kurulur; Retell ses, döküm ve logları 30 günde kendisi siler. Kayıt bağlantıları **imzalı ve 24 saat geçerli** (`opt_in_signed_url`). Panel her dinlemede yeni bağlantı ister; dinleme denetim kaydına yazılır.
- **"Aramaları kaydet" kapalıysa:** Retell'de yalnızca sesi kapatan bir ayar yok. `basic_attributes_only` webhook'tan da döküm ve özeti siliyor (2026-10-05'te gerçek aramayla doğrulandı), bu yüzden kullanılmadı. Bunun yerine arama analizi bize ulaşınca (`call_analyzed`) arama Retell'den silinir. Döküm ve özet yalnızca bizde kalır ve 90 günlük kurala tabidir.
- **Anonimleştirme** bu numaradan gelen aramaları Retell'den de siler (ses dahil).
- **Dışa aktarma (m.11 bilgi talebi):** Panel → Hastalar → hasta → "Verileri indir" (JSON: hasta, randevular, aramalar, geri arama talepleri). Yetki `patients.export` (sahip ve yönetici); her indirme denetim kaydına yazılır.

## Anonimleştirme

`anonymizePatient(clinicId, patientId)`:

1. `full_name` → `"Anonim Hasta"`, `phone` → `anon:<uuid>`, `notes` → null
2. İlgili `calls`: `from_number` maskelenir, `transcript`, `summary`, `recording_url` → null
3. `callback_requests`: `patient_name`, `phone` → null
4. Randevular kalır (istatistik için), kimlik bağı kopmuş olur.
