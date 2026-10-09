# Olay müdahalesi (incident response)

_2026-10-09 (denetim C3). Pilot dönemi için; ekip büyüdükçe roller ayrılır. Hukuki süreler avukat incelemesinden geçmelidir ([docs/legal-drafts/LAWYER-BRIEF.md](../legal-drafts/LAWYER-BRIEF.md))._

## Önem dereceleri

| Derece   | Tanım                                                                           | Örnek                                                                                | İlk yanıt | Bildirim                                                    |
| -------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------- |
| **SEV1** | Hasta verisi sızıntısı şüphesi veya tüm klinikler için asistan/panel çalışmıyor | Yetkisiz veri erişimi, veritabanı erişilemez, Retell tamamen kapalı                  | 15 dk     | Kliniklere 1 saat içinde; KVKK değerlendirmesi hemen başlar |
| **SEV2** | Bir klinik için asistan çalışmıyor veya yanlış randevu işlemi yapıyor           | Bir kliniğin numarası reddediliyor, sahte "oluşturuldu" iddiaları, SMS yanlış kişiye | 1 saat    | Etkilenen kliniğe 2 saat içinde                             |
| **SEV3** | Kısmi bozulma, geçici çözüm var                                                 | Yavaş yanıt, bir panel sayfası hatalı, günlük iş gecikti                             | 1 iş günü | Gerekirse sürüm notunda                                     |
| **SEV4** | Kozmetik veya tek kullanıcı                                                     | Yazım hatası, tek tarayıcıda görünüm                                                 | Planlı    | Yok                                                         |

## Roller (pilot)

| Rol             | Kim                        | Sorumluluk                                                |
| --------------- | -------------------------- | --------------------------------------------------------- |
| Olay sorumlusu  | Ürün sahibi                | Derece kararı, kliniklerle iletişim, KVKK bildirim kararı |
| Teknik sorumlu  | Geliştirici (Claude dahil) | Teşhis, geçici çözüm, düzeltme, zaman çizelgesi           |
| Hukuk danışmanı | Avukat                     | Veri ihlali değerlendirmesi, Kurul ve kişi bildirimleri   |

## Genel akış

1. **Algıla:** uptime alarmı, `ALARM` logu, Sentry, klinik bildirimi veya panelde işaretli arama.
2. **Derecelendir** (yukarıdaki tablo) ve olay kaydını aç: `docs/incidents/YYYY-MM-DD-kisa-ad.md` (şablon aşağıda).
3. **Durdur / sınırla:** etkilenen özelliği kapat (env anahtarı, klinik durumu "paused", Vercel'de önceki deploy'a dönüş).
4. **İletişim:** şablonlarla kliniklere bilgi; SEV1'de her saat güncelleme.
5. **Düzelt:** dal akışıyla, CI yeşil; acilse önce geri dönüş, sonra düzeltme.
6. **Kapat:** 5 iş günü içinde olay sonrası değerlendirme (suçlamasız), aksiyon maddeleri plana.

## Senaryolar

### Retell kesintisi (asistan aramaları alamıyor)

- Belirti: aramalar düşüyor/sessiz; Retell durum sayfası; webhook trafiği yok.
- Geçici çözüm: kliniklere telefonlarını kendi hatlarına yönlendirmelerini söyle (SIP sağlayıcısında yönlendirme; F2 ile birlikte belgelenecek). Asistan kapalıyken randevu panelden alınır.
- Kalıcı: Retell düzelince test araması (kredi gerekir); kaçan aramalar için sağlayıcıdaki arama kayıtlarından geri arama listesi.

### LLM sağlayıcısı (Retell içindeki model) bozuk veya yavaş

- Belirti: gecikme artışı, anlamsız yanıtlar, işaretli aramalar (`unbacked_claim`).
- Geçici çözüm: Retell'de modeli değiştirmek bir ürün kararıdır; onayla `RETELL_LLM_MODEL` güncellenip yeniden deploy (ADR-003 profilleri önceden ölçülmüş olmalı).

### ElevenLabs (ses) kesintisi

- Belirti: asistan konuşmuyor, Retell hata veriyor.
- Geçici çözüm: Retell'in standart bir Türkçe sesine geçiş (`RETELL_VOICE_MODEL` veya klinik sesi) onayla; dinleyerek doğrula.

### Neon (veritabanı) kesintisi

- Belirti: `/api/health` 503 (`db: error`); panel açılmıyor; tool çağrıları hata veriyor (asistan "sisteme ulaşamıyorum" der, güçlendirilmiş prompt açıksa geri arama önerir).
- Geçici çözüm: Neon durum sayfası; uzun sürerse kliniklere aramaları kendi hatlarına almalarını söyle. Veri kaybı şüphesinde [BACKUP-RESTORE.md](BACKUP-RESTORE.md).

### Vercel kesintisi

- Belirti: site ve webhook'lar erişilemez.
- Geçici çözüm: Vercel durum sayfası; kötü bir deploy ise Deployments → önceki deploy → **Promote to Production**.

### Veri ihlali şüphesi (KVKK)

1. Hemen sınırla: ilgili oturumları kapat, anahtar/parolayı döndür ([SECRET-ROTATION-2026-10.md](SECRET-ROTATION-2026-10.md)), gerekiyorsa erişimi kapat.
2. Kanıtı koru: denetim kaydı (`audit_events`), Vercel ve Neon logları, ilgili commit'ler.
3. Kapsamı belirle: hangi klinikler, hangi veri kategorileri (sağlık verisi özel nitelikli), kaç kişi, ne zamandan beri.
4. **Veri sorumlusu kliniktir; Recall veri işleyendir.** Recall, kliniğe **gecikmeksizin** bildirir (DPA taslağında 24 saat önerilir). Kurula bildirim veri sorumlusunun yükümlülüğüdür: Kurul kararına göre **öğrenildiği andan itibaren en geç 72 saat** içinde; ilgili kişilere en kısa sürede. Recall, kliniğe bildirim formu için gereken bilgileri hazırlar. _Süreler ve rol dağılımı avukatla teyit edilecek._
5. Kayıt: ihlal kaydı tutulur (tarih, kapsam, etkiler, alınan önlemler).

## Türkçe bildirim şablonları

**Kliniğe ilk bildirim (SEV1/SEV2):**

> Konu: Recall hizmetinde kesinti / güvenlik olayı — [tarih saat]
> Sayın [Klinik adı] yetkilisi, [saat] itibarıyla [kısa açıklama: ör. sesli asistan aramaları karşılayamıyor]. Ekibimiz konu üzerinde çalışıyor. Bu süre içinde [geçici çözüm: ör. aramaları kendi hattınıza yönlendirmenizi] öneririz. Bir sonraki bilgilendirme [saat] içinde yapılacaktır. Sorularınız için: [iletişim].

**Çözüm bildirimi:**

> Konu: Recall hizmeti normale döndü — [tarih saat]
> [Saat] itibarıyla [hizmet] yeniden çalışıyor. Etkilenen süre: [aralık]. Bu sürede [etkilenen işlemler, ör. X arama karşılanamadı; geri arama listesi panelde]. Ayrıntılı değerlendirme [tarih] tarihinde paylaşılacaktır.

**Veri ihlali (kliniğe, veri işleyen olarak):**

> Konu: Kişisel veri güvenliği olayı bildirimi — [tarih]
> [Tarih saat] tarihinde [olayın kısa tanımı] tespit edilmiştir. Etkilenen veri kategorileri: [ör. ad, telefon, randevu bilgisi]. Etkilenen kişi sayısı (tahmini): [sayı]. Alınan önlemler: [liste]. KVKK kapsamında Kurul'a ve ilgili kişilere bildirim yükümlülüğünüzü değerlendirmeniz için gereken bilgileri ekte sunuyoruz. İletişim: [ad, telefon, e-posta].

## Olay kaydı şablonu

```
# [Tarih] [Kısa ad]
Derece: SEV_
Başlangıç / tespit / çözüm: __ / __ / __
Etki: (klinikler, aramalar, veri)
Zaman çizelgesi:
Kök neden:
Ne işe yaradı / yaramadı:
Aksiyonlar (sahibi, tarih):
KVKK değerlendirmesi: (gerek yok / kliniğe bildirildi / Kurul bildirimi klinikte)
```
