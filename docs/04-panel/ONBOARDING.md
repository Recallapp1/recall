# Klinik Onboarding

Hedef: Sözleşmeden **canlı ilk aramaya 48 saat**.

## MVP: Recall ekibi destekli (concierge)

| # | Adım | Kim | Araç |
|---|---|---|---|
| 1 | Keşif görüşmesi: hizmetler, süreler, hekimler, saatler, SSS, fiyat politikası | Recall + klinik | Form |
| 2 | Klinik kaydı ve owner daveti | Recall | Seed betiği / panel |
| 3 | Hekimler, hizmetler, çalışma saatleri girişi | Recall veya klinik | Panel |
| 4 | Asistan ayarları (ad, karşılama, ses, SSS) | Klinik | Panel → Ayarlar → Asistan |
| 5 | Türk numarası tahsisi ve Vapi'ye bağlanması | Recall | Operatör paneli + Vapi |
| 6 | **Test araması:** Recall ekibi ve klinik birlikte 5 senaryo dener | Birlikte | Telefon |
| 7 | Kliniğin mevcut hattında yönlendirme kurulumu | Klinik (Recall rehberliğinde) | Operatör |
| 8 | Devir numarası testi (döngü olmadığından emin ol) | Birlikte | Telefon |
| 9 | Canlıya geçiş, ilk hafta günlük kontrol | Recall | Panel, arama kayıtları |

## Kontrol listesi (canlıya geçmeden önce)

- [ ] En az 1 hekim, 1 hizmet ve haftalık çalışma saatleri tanımlı
- [ ] Önümüzdeki 30 gün için resmî tatiller girilmiş
- [ ] `clinics.phone_number` Vapi'deki numarayla aynı (E.164)
- [ ] Devir numarası farklı bir hat ve test edildi
- [ ] KVKK aydınlatma metni klinik web sitesinde yayında ([KVKK.md](../05-compliance/KVKK.md))
- [ ] Veri işleme sözleşmesi (DPA) imzalı
- [ ] 5 test senaryosu başarılı (S01, S04, S05, S10, S11)

## V1: Self-servis sihirbaz

`/onboarding` rotasında 5 adımlı sihirbaz: Klinik bilgileri → Hizmetler (sektöre göre hazır şablonlarla: diş, estetik, fizyoterapi) → Hekimler ve saatler → Asistan kişiliği → Numara ve test araması.

### Sektör şablonları (örnek: diş kliniği)
| Hizmet | Süre | Eş anlamlılar |
|---|---|---|
| Muayene / Kontrol | 20 dk | muayene, kontrol, bakılması, ağrı |
| Diş Taşı Temizliği | 30 dk | temizlik, detertraj, taş |
| Dolgu | 45 dk | dolgu, çürük |
| Kanal Tedavisi | 60 dk | kanal |
| Diş Çekimi | 30 dk | çekim, çektirmek |
| İmplant Görüşmesi | 30 dk | implant, vida |
| Diş Beyazlatma | 60 dk | beyazlatma, bleaching |
| Ortodonti Görüşmesi | 30 dk | tel, şeffaf plak, ortodonti |
