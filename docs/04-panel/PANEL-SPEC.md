# Klinik Paneli

Rota kökü: `/panel`. Oturum gerektirir (Better Auth, Faz 2). Klinik = aktif organizasyon.

## Navigasyon

```
Bugün │ Takvim │ Randevular │ Aramalar │ Hastalar │ Geri aranacaklar │ Ayarlar
```

## Ekranlar

### 1. Bugün (`/panel`)

- Özet kartları: bugünkü randevular, asistanın bugün aldığı randevular, açık geri arama talepleri, bugünkü aramalar.
- Zaman çizelgesi: günün randevuları, hekim bazında.
- "Yeni" etiketi: son girişten beri asistanın oluşturduğu randevular.

### 2. Takvim (`/panel/calendar`)

- Gün / hafta görünümü, hekim kolonları.
- Randevuya tıklayınca detay paneli (hasta, hizmet, kaynak, ilgili arama özeti).
- Boş slota tıklayınca manuel randevu oluşturma (`source=panel`).
- Sürükle-bırak erteleme (V1).

### 3. Randevular (`/panel/appointments`)

- Tablo: tarih, saat, hasta, hizmet, hekim, durum, kaynak.
- Filtre: tarih aralığı, hekim, durum, kaynak.
- Aksiyonlar: onayla, iptal et, gelmedi, tamamlandı.

### 4. Aramalar (`/panel/calls`)

- Tablo: zaman, arayan (maskeli), süre, sonuç (`outcome`), özet.
- Detay: özet, transkript, ses kaydı oynatıcı (izin ve saklama süresi dahilinde), bağlı randevu.

### 5. Hastalar (`/panel/patients`)

- Arama: isim, telefon.
- Detay: iletişim, randevu geçmişi, aramalar, notlar.
- KVKK: "Hastayı anonimleştir" aksiyonu (owner ve admin).

### 6. Geri aranacaklar (`/panel/callbacks`)

- Açık talepler listesi: isim, telefon, sebep, zaman.
- "Tamamlandı" işareti.

### 7. Ayarlar (`/panel/settings`)

| Sekme             | İçerik                                                                         | Rol   |
| ----------------- | ------------------------------------------------------------------------------ | ----- |
| Klinik            | Ad, adres, saat dilimi, devir numarası                                         | admin |
| Çalışma saatleri  | Klinik geneli haftalık program, tatiller                                       | admin |
| Hekimler          | Liste, hizmet eşlemesi, haftalık program, izinler                              | admin |
| Hizmetler         | Ad, eş anlamlılar, süre, fiyat aralığı                                         | admin |
| Asistan           | Ad, karşılama, ses, fiyat söylensin mi, SSS, ek talimatlar, "Test araması yap" | admin |
| Randevu kuralları | Slot aralığı, minimum ön süre, en fazla ileri gün, iptal kuralı                | admin |
| Bildirimler       | SMS onay ve hatırlatma                                                         | admin |
| Ekip              | Üyeler, davet, roller                                                          | owner |

## Teknik notlar

- Sayfalar Server Component; veri `src/server/domain` fonksiyonlarıyla, `clinicId` oturumdan alınarak çekilir.
- Mutasyonlar Server Actions + Zod. Başarıda `revalidatePath` / `refresh`.
- Tarih gösterimi `Intl.DateTimeFormat('tr-TR', { timeZone: clinic.timezone })`.
- Gerçek zamanlı güncelleme (yeni randevu düştüğünde): MVP'de 30 sn polling, V1'de SSE.
- Mobil uyumlu: sekreter tablet veya telefondan kullanabilmeli.
