# Destek süreci

_2026-10-09 (denetim C3). Pilot dönemi; kanal ve saatler ürün sahibinin kararıdır ([DECISIONS-TO-REVIEW.md](../DECISIONS-TO-REVIEW.md))._

## Kanallar ve saatler (öneri)

| Kanal                                       | Kullanım                                  | Yanıt                        |
| ------------------------------------------- | ----------------------------------------- | ---------------------------- |
| E-posta (destek adresi, alan adı taşınınca) | Her türlü talep                           | İş günü 09:00–18:00          |
| Telefon / WhatsApp (pilot klinikleri için)  | Acil: asistan çalışmıyor                  | SEV1/SEV2 için mesai dışı da |
| Panel içi                                   | Şimdilik yok; ileride "Destek" bağlantısı | —                            |

## Yanıt hedefleri

| Derece ([INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md)) | İlk yanıt | Çözüm hedefi        |
| ----------------------------------------------------- | --------- | ------------------- |
| SEV1                                                  | 15 dk     | Geçici çözüm 1 saat |
| SEV2                                                  | 1 saat    | 1 iş günü           |
| SEV3                                                  | 1 iş günü | Sonraki sürüm       |
| SEV4                                                  | 2 iş günü | Planlı              |

## Sık talepler ve nasıl yapılır

| Talep                                  | Kim yapar                | Nasıl                                                                                    |
| -------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| Ekibe kişi ekleme / çıkarma            | Klinik sahibi/yöneticisi | Panel → Ayarlar → Ekip. İlk sahip: Recall `pnpm clinic:member`                           |
| Çalışma saati, hekim, hizmet, tatil    | Klinik                   | Panel → Ayarlar                                                                          |
| Asistan adı, karşılama, sık sorulanlar | Klinik                   | Panel → Ayarlar → Asistan (değişiklik ajana otomatik senkronlanır)                       |
| Arama/randevu sınırlarını değiştirme   | Recall                   | Klinik ayarları `limits` (konsol ekranı yok; veritabanından, değişiklik denetim kaydına) |
| Kayıt dinleme sorunu                   | Recall                   | Konsolda kliniğin ajan durumu; Retell kayıt süresi 30 gün                                |
| **KVKK bilgi talebi (m.11)**           | Klinik (veri sorumlusu)  | Panel → Hastalar → hasta → "Verileri indir". Yasal yanıt süresi en geç **30 gün** (m.13) |
| **KVKK silme talebi**                  | Klinik                   | Panel → Hastalar → hasta → "Anonimleştir" (aramalar ve Retell kopyaları dahil; kalıcı)   |
| Asistanın söylediği yanlış bilgi       | Recall                   | Arama kaydı ve dökümü (panel), işaretler; prompt/ayar düzeltmesi dal akışıyla            |
| Faturalama                             | Recall                   | Henüz faturalama yok (pilot)                                                             |

## Triage adımları

1. Kimin, hangi klinik, ne zaman, hangi arama (panel bağlantısı varsa) — hasta adı veya numarası **e-postada istenmez**; panelde arama/hasta bağlantısı yeterli.
2. Derece belirlenir; SEV1/SEV2 ise olay müdahalesi başlar.
3. Tekrar üretilir (dev ortamı, Recall Dev çalışma alanı); production verisi yerele kopyalanmaz.
4. Çözüm dal akışıyla; klinik bilgilendirilir; destek kaydı kapanır.

## Destek kaydı

Basit tablo (pilot): tarih, klinik, kanal, derece, özet (kişisel veri yok), durum, çözüm tarihi. Ayda bir gözden geçirilir; tekrar eden sorunlar plana alınır.

## Kliniğe yanıt şablonu

> Merhaba [ad], talebinizi aldık ([kısa özet]). Önceliği: [derece]. [Ne yapacağımız / geçici çözüm]. [Saat/tarih] içinde güncelleme yapacağız. Recall Destek
