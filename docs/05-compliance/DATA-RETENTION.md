# Veri Saklama

İlke: **İhtiyaç kadar, süre kadar.** Varsayılanlar aşağıdadır; klinik ihtiyacına göre kısaltabilir (uzatma, hukuki gerekçe ister).

| Veri | Varsayılan süre | Süre dolunca | Sorumlu |
|---|---|---|---|
| Ses kaydı | **30 gün** | Sağlayıcıdan silinir, `recording_url` null yapılır | Cron `retention` |
| Transkript | **90 gün** | `transcript` null; `summary` kalır | Cron `retention` |
| Arama özeti ve meta veri | 2 yıl | Anonimleştirilir (numara silinir) | Cron |
| Randevu | Klinik hesabı aktif olduğu sürece | Hasta anonimleştirmesinde ilişki korunur, kimlik silinir | — |
| Hasta kaydı | Son randevudan sonra 5 yıl (avukatla teyit edilecek) | Anonimleştirme | Cron (Faz 3) |
| Uygulama logları | 30 gün (Vercel planına bağlı) | Otomatik | Vercel |
| Klinik hesabı kapatıldığında | 30 gün içinde tüm veri silinir, kliniğe dışa aktarım verilir | — | Operasyon |

## Uygulama

- `GET /api/cron/retention`: günlük çalışır (Vercel Cron, `vercel.json`).
- Her silme işlemi sayısal olarak loglanır ("12 transkript temizlendi"), içerik loglanmaz.
- Sağlayıcı tarafı (Vapi kayıtları): Vapi API ile silme veya Vapi'de kayıt saklama süresi ayarı. Faz 1'de doğrulanacak.

## Anonimleştirme

`anonymizePatient(clinicId, patientId)`:
1. `full_name` → `"Anonim Hasta"`, `phone` → `anon:<uuid>`, `notes` → null
2. İlgili `calls`: `from_number` maskelenir, `transcript`, `summary`, `recording_url` → null
3. `callback_requests`: `patient_name`, `phone` → null
4. Randevular kalır (istatistik için), kimlik bağı kopmuş olur.
