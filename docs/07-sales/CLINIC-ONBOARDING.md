# Pilot klinik onboarding kontrol listesi

_2026-10-09 (denetim C4). Bugünkü konsol ve panel ekranlarına göre yazıldı; genel akış [docs/04-panel/ONBOARDING.md](../04-panel/ONBOARDING.md). Hedef: sözleşmeden canlı ilk aramaya 48 saat._

## 0. Ön koşullar (klinikten önce, bir kez)

| #   | Koşul                                                                      | Durum / belge                                                                                            |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 0.1 | Şirket, sözleşme ve **veri işleme sözleşmesi (DPA)** hazır, avukat onaylı  | [legal-drafts](../legal-drafts/) (taslak)                                                                |
| 0.2 | Kliniğin web sitesinde **KVKK aydınlatma metni** (klinik veri sorumlusu)   | Taslak: `legal-drafts/`                                                                                  |
| 0.3 | Türk numarası ve SIP hattı Retell'e bağlı                                  | [PHONE-LINE-OPTIONS.md](PHONE-LINE-OPTIONS.md) (F2)                                                      |
| 0.4 | Retell **production** çalışma alanında kredi                               | Ürün sahibi                                                                                              |
| 0.5 | Vercel Pro (ticari kullanım), Neon Launch (7 gün geçmiş), Sentry ve uptime | [BACKUP-RESTORE.md](../06-operations/BACKUP-RESTORE.md), [MONITORING.md](../06-operations/MONITORING.md) |
| 0.6 | Değerlendirme yapıldı, model ve prompt kararı verildi                      | [VOICE-EVAL.md](../02-voice-agent/VOICE-EVAL.md), ADR-003                                                |
| 0.7 | Pilot için açılacak anahtarlar seçildi (aşağıda §9)                        | [DECISIONS-TO-REVIEW.md](../DECISIONS-TO-REVIEW.md)                                                      |

## 1. Keşif görüşmesi: toplanacak bilgiler

- Klinik adı, adresi, saat dilimi (varsayılan `Europe/Istanbul`).
- Haftalık çalışma saatleri (gün başına bir veya birkaç aralık), resmî tatiller ve kapalı günler.
- Hekimler: ad, unvan (Dt., Dr., Uzm.), hangi hizmetleri verdiği, kendi çalışma saatleri.
- Hizmetler: ad, süre (dk), hastaların kullandığı diğer adlar (ör. "temizlik" = "diş taşı temizliği"), fiyat aralığı ve **asistan fiyat söylesin mi**.
- Randevu kuralları: en az kaç dakika sonrasına, en fazla kaç gün ileriye, iptal için en az kaç saat önce, hasta hekim seçebilsin mi.
- Asistan: adı, karşılama cümlesi (isteğe bağlı), **görüşmeler kaydedilsin mi**, sık sorulanlar (en fazla 20), kliniğin notları (en fazla 1000 karakter).
- Devir (insan) numarası: asistanın aktarabileceği, **Recall numarasından farklı** bir hat.
- Ekip: kim sahip, kim yönetici, sekreter, hekim (e-posta ile).
- SMS: şimdilik kapalı (Netgsm ve İYS incelemesi bitene kadar); klinik bilgilendirilir.

## 2. Recall konsolu: klinik ve sahip

1. `/admin` → **Klinikler** → **Yeni klinik**: ad, kısa ad (slug), saat dilimi.
2. Klinik sayfası → **Kişi ekle**: sahip, e-posta, rol **Klinik sahibi** → sahip "parolanızı belirleyin" e-postası alır (24 saat geçerli).
3. (İsteğe bağlı) **Modüller** → Takip.
4. **Her kişiye ayrı hesap.** Ortak (paylaşılan) hesap açılmaz, sahip de dahil. İki adımlı giriş kişinin kendi telefonuna bağlıdır ve denetim kaydı kişi adına tutulur; ortak hesapla ikisi de çalışmaz. Resepsiyon bilgisayarı ortaksa her çalışan kendi hesabıyla girer (oturum süresi `PANEL_SESSION_HOURS` ile kısaltılabilir). Sahibe ve yöneticilere kurulumdan önce telefonlarına bir kimlik doğrulama uygulaması (Google veya Microsoft Authenticator) kurmalarını söyleyin; yedek kodları güvenli bir yere kaydetmeleri gerekir.

## 3. Klinik paneli: ayarlar (sahip veya Recall birlikte)

| Ekran                       | Yapılacak                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------- |
| Ayarlar → Klinik            | Ad, adres, **devir numarası**                                                           |
| Ayarlar → Çalışma saatleri  | Haftalık saatler                                                                        |
| Ayarlar → Tatil ve izinler  | Resmî tatilleri ekle (yıl düğmesi), hekim izinleri                                      |
| Ayarlar → Hekimler          | Hekimler, unvan, verdiği hizmetler, kendi saatleri                                      |
| Ayarlar → Hizmetler         | Süre, diğer adlar, fiyat aralığı                                                        |
| Ayarlar → Randevu kuralları | Bildirim süreleri, ileri gün sınırı, iptal süresi                                       |
| Ayarlar → Asistan           | Ad, karşılama, ses, sık sorulanlar, notlar, kayıt tercihi; **prompt önizlemesi** okunur |
| Ayarlar → Ekip              | Diğer üyeleri davet et, rollerini ver                                                   |

## 4. Numara ve asistan (konsol)

1. SIP hattı Retell'e aktarıldıktan sonra konsol → klinik → **Telefon numaraları** → numarayı E.164 biçiminde ekle (ör. `+90…`).
2. **Sesli asistan** → **Asistanı oluştur / senkronla** → durum **Güncel** olmalı; hata varsa mesaj kartta görünür.
3. Sınırlar (`limits`): varsayılanlar (numara başına saatte 5 arama, günde 300 ses dakikası, aramada 2 randevu…) pilot için uygundur; değişiklik gerekirse Recall veritabanından yapar ve kliniğe bildirir.

## 5. Test (canlıdan önce)

| #   | Senaryo                                                 | Beklenen                                               |
| --- | ------------------------------------------------------- | ------------------------------------------------------ |
| T1  | Panel → Ayarlar → Asistan → **Test araması** (tarayıcı) | Asistan kliniğin adıyla karşılar                       |
| T2  | Gerçek telefondan randevu al                            | Randevu panelde "Asistan" kaynağıyla görünür           |
| T3  | Aynı telefondan iptal et                                | Randevu iptal; arama kaydında sonuç                    |
| T4  | Gizli numarayla iptal dene                              | Ad, tarih ve saat sorulur; yanlışsa bilgi verilmez     |
| T5  | "Göğsüm ağrıyor" de                                     | Asistan 112'yi aramasını söyler                        |
| T6  | "Bir insanla görüşmek istiyorum" (mesai içinde)         | Devir numarasına aktarılır                             |
| T7  | Mesai dışında arayıp geri arama iste                    | Panel → Geri aranacaklar'da not                        |
| T8  | Kayıt kapalıysa (seçildiyse)                            | Arama sonrası Retell'de ses yok (silme kuyruğu `done`) |

## 6. Kliniğin hattında yönlendirme

Kliniğin mevcut numarası Recall numarasına yönlendirilir: meşgulken, cevapsızken veya mesai dışında ([CALL-ROUTING.md](../03-telephony/CALL-ROUTING.md)). Devir numarasının Recall'a geri yönlenmediği (döngü) test edilir.

## 7. Canlıya geçiş

- [ ] 1–6 tamam; T1–T8 başarılı
- [ ] KVKK aydınlatma metni yayında, DPA imzalı
- [ ] Ekip panele giriş yaptı; bildirim ve geri arama listesini kim izleyecek belli
- [ ] Uptime ve Sentry açık; olay ve destek iletişim bilgileri kliniğe verildi ([SUPPORT-PROCESS.md](../06-operations/SUPPORT-PROCESS.md))

## 8. İlk hafta

- Her gün: Aramalar (sonuçlar, işaretler), Geri aranacaklar, asistanın aldığı randevular.
- Haftalık kısa görüşme: yanlış anlamalar, eksik SSS, hizmet adları; ayarlar ve prompt düzeltmeleri dal akışıyla.

## Prova kaydı

### 2026-10-17 · Neon `dev` dalı, §2–§4 (Claude)

Sentetik bir diş kliniği (`kurulum-provasi`), konsolun ve panelin kullandığı aynı form şemaları ve sunucu fonksiyonlarıyla, bu belgenin sırasıyla kuruldu; sonunda tüm satırlar silindi. Canlıya, Retell'e ve gerçek e-postaya dokunulmadı (`EMAIL_PROVIDER=console`); arama yapılmadı.

| Adım                           | Sonuç                                                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §2.1 Yeni klinik (şablon: diş) | Organizasyon, 8 şablon hizmeti, varsayılan saatler tek işlemde                                                                                                                     |
| §2.2 Sahip ekleme              | Kullanıcı ve üyelik; "parolanızı belirleyin" e-postası konsola yazıldı                                                                                                             |
| §3 Klinik                      | Adres ve devir numarası                                                                                                                                                            |
| §3 Çalışma saatleri            | Hafta içi 09–18, cumartesi 09–13                                                                                                                                                   |
| §3 Tatiller                    | 2026 için 12 resmî tatil                                                                                                                                                           |
| §3 Hekim, hizmetler            | 1 hekim (3 hizmet); bir hizmete fiyat aralığı ve eş anlamlı                                                                                                                        |
| §3 Randevu kuralları           | 15 dk aralık, 2 saat ön süre, 30 gün, 24 saat iptal                                                                                                                                |
| §3 Asistan                     | Ad, kayıt açık, 1 SSS, not                                                                                                                                                         |
| §3 Ekip                        | Sekreter (rol `staff`) eklendi                                                                                                                                                     |
| §4.1 Numara                    | Eklendi (Retell'e aktarılmadı)                                                                                                                                                     |
| §4.2 Asistan                   | Ajan tanımı **yalnızca yerelde** kuruldu, Retell'e gönderilmedi: talimatta hekim, SSS ve kliniğin adıyla karşılama var                                                             |
| Yayına hazırlık                | Klinik aktif, telefon hattı 1 numara, saat/hekim/hizmet tamam, SMS kapalı, konsol kullanıcısı yok, silme kuyruğu boş; **asistan "Senkronize değil"** (beklenen: ajan gönderilmedi) |

**Görülenler:**

- Yayına hazırlık sayfası "Telefon hattı" için yalnızca veritabanındaki numarayı sayar; numaranın gerçekten SIP üzerinden Retell'e bağlı olduğunu bilemez. Bunu ilk gerçek test araması (T2) gösterir.
- §4.3'teki "sınır değişikliği Recall veritabanından yapılır" ifadesi `CONSOLE_LIMITS_EDIT` açıkken konsoldan da yapılabilir; bu provada sınırlar değiştirilmedi.

**Denenmeyenler:** konsol ve panelin tarayıcı arayüzü (aynı fonksiyonları çağırır; E2E testleri ayrıca kapsar), Retell'e ajan oluşturma, T1–T8 (gerçek arama ve kredi gerektirir), parola e-postasındaki bağlantıyla ilk giriş, iki adımlı giriş.

**Temizlik:** klinik, organizasyon, iki kullanıcı ve doğrulama kayıtları silindi. Dev'deki sayılar prova öncesiyle aynı (2 klinik, 2 organizasyon, 5 kullanıcı, 4 üyelik, 2 doğrulama kaydı, 29 denetim kaydı, 2 numara).

## 9. Pilot için anahtar kararı (ürün sahibi)

| Anahtar                                                                           | Önerilen pilot değeri                                | Not                                                                                                                                     |
| --------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `POST_CALL_FLAGS`                                                                 | Açık                                                 | Panelde acil durum ve uyuşmayan sonuç rozetleri                                                                                         |
| `VOICE_TOOL_IDEMPOTENCY`                                                          | Açık                                                 | Tekrar isteklerde ikinci işlem yok                                                                                                      |
| `VOICE_SHARED_NUMBER_CHECK`                                                       | Kliniğe göre                                         | Aile numarası yaygınsa açık; arayanlar daha çok doğrulama sorusu duyar                                                                  |
| `AUDIT_STRICT`                                                                    | Açık                                                 | Denetim kaydı yazılamazsa işlem durur                                                                                                   |
| `PANEL_LIMITS_VIEW`                                                               | Açık                                                 | Sahip kullanım ve sınırları görür                                                                                                       |
| `VOICE_PROMPT_VARIANT`, `VOICE_PROMPT_HARDENING`, `RETELL_DYNAMIC_RESPONSIVENESS` | Ölçümden sonra                                       | ADR-003                                                                                                                                 |
| `HEALTH_JOBS_TOKEN`                                                               | Uptime kurulunca                                     | MONITORING.md                                                                                                                           |
| `PANEL_TWO_FACTOR`                                                                | `required-admins`                                    | Karar: pilottan önce sahip ve yöneticiler için zorunlu; diğer personel isteğe bağlı açar. Bir ay sorunsuzsa `required-all`              |
| `TWO_FACTOR_RESET_EMAILS`                                                         | Recall sahibinin e-postası                           | Telefonunu ve yedek kodlarını kaybedeni yalnızca Recall sahibi sıfırlar; önce kliniği kayıtlı numarasından geri arar                    |
| `VOICE_EMERGENCY_FIRST`                                                           | Açık (C5 geçtikten sonra)                            | Acil durum kuralı talimatın başında, sabit cümle "Lütfen hemen yüz on ikiyi arayın."                                                    |
| `VOICE_EMERGENCY_END_CALL`                                                        | Açık (ayrı turda, `VOICE_EMERGENCY_FIRST`'ten sonra) | Aktarma yapılamıyorsa acil durum cümlesinden sonra görüşmeyi kapatır; arayan konuşuyorsa kapatmaz. Kliniğin devir numarası yoksa önemli |
| `SMS_SENDING_ENABLED`                                                             | **Kapalı**                                           | Netgsm ve İYS/hukuk onayı bitene kadar                                                                                                  |

## 10. Pilotun bitişi veya ayrılma

Konsol → klinik durumu **Duraklat** (asistan yeni randevu almaz, geri arama önerir); numara kaldırılır; veriler sözleşmedeki süre sonunda silinir veya kliniğe dışa aktarılır (DPA).
