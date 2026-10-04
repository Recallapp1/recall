# Multi-Tenancy (Kiracı İzolasyonu)

Her klinik bir **kiracıdır** (tenant). Bir kliniğin hastası, randevusu veya arama kaydı başka bir kliniğe **asla** görünmemelidir. Sağlık verisi söz konusu olduğu için bu, ürünün en kritik güvenlik özelliğidir.

## Model: paylaşılan veritabanı, satır seviyesinde izolasyon

Tüm klinikler aynı veritabanını ve tabloları paylaşır. Her satırda `clinic_id` bulunur.

**Neden şema veya DB başına kiracı değil?** Yüzlerce küçük klinik için yönetim ve migration maliyeti çok yüksek olur. Satır seviyesi izolasyon, doğru disiplinle yeterlidir.

## Kiracı nereden gelir?

| Giriş noktası                    | Kiracı kaynağı                                                                                                  | Asla                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Retell inbound webhook           | Aranan numara → `phone_numbers.e164`                                                                            | LLM'in ürettiği tool argümanları |
| Retell tool ve olay webhook'ları | `call.agent_id` → `voice_agents.external_agent_id` (inbound'da yazılan `metadata.clinic_id` ile çapraz kontrol) | LLM'in ürettiği tool argümanları |
| Panel                            | Oturumdaki aktif organizasyon → klinik                                                                          | URL veya form alanı              |
| Cron                             | Her kliniği sırayla dolaşır                                                                                     | —                                |

## Kurallar

1. **Domain fonksiyonları `clinicId`'yi ilk parametre olarak alır.**
   ```ts
   findAvailableSlots(db, clinicId, { serviceId, date });
   ```
2. **Her sorgu `clinic_id` ile filtrelenir**, ID ile tekil kayıt çekerken bile:
   ```ts
   // ✅
   where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)));
   // ❌ başka kliniğin randevusunu iptal edebilir
   where(eq(appointments.id, id));
   ```
3. **Tool context'i sunucuda kurulur:** `ToolContext { clinicId, callId, callerPhone, timezone }` webhook'ta oluşturulur ve tool'a enjekte edilir.
4. **İlişki doğrulaması:** Bir randevu oluşturulurken `practitionerId` ve `serviceId`'nin aynı kliniğe ait olduğu kontrol edilir.
5. **Testler:** Her domain modülü için "başka kliniğin verisine erişemez" testi yazılır.

## Gelecek: Postgres RLS

Faz 3'te ek savunma katmanı olarak Row Level Security değerlendirilecek (`SET app.clinic_id` ve politika). Uygulama seviyesindeki kurallar yine de geçerli kalır.
