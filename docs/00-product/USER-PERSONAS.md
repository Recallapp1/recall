# Kullanıcı Personaları

## 1. Arayan hasta: "Ayşe, 38"

- **Bağlam:** Çalışan bir anne. Diş kliniğini öğle arasında, telefonundan arıyor.
- **İhtiyaç:** Kısa sürede uygun bir saate randevu almak. Bekletilmek istemiyor.
- **Beklenti:** Doğal konuşma, tekrar tekrar aynı bilgiyi vermemek, işlem sonunda yazılı teyit (SMS).
- **Endişe:** "Robotla konuşuyorum, anlamayacak." Asistan anlamazsa insana ulaşabilmeli.

**Varyasyonlar**

- **Yaşlı hasta (70+):** Yavaş konuşur, teknolojiye mesafelidir. Asistan sabırlı olmalı, kısa cümleler kurmalı, bilgiyi tekrar etmeli.
- **İlk kez arayan:** Hizmetler, fiyat, adres ve otopark gibi bilgi soruları sorar.
- **Acil durumdaki hasta:** Şiddetli ağrı, kanama veya şişlik. Hemen insana veya 112'ye yönlendirilmeli.

## 2. Klinik sekreteri / resepsiyonist: "Mehmet, 27"

- **Bağlam:** Aynı anda hem kapıdaki hastayla hem de telefonla ilgileniyor.
- **İhtiyaç:** Telefon yükünün azalması. Asistanın aldığı randevuları anında ve net görmek.
- **Panel kullanımı:** Günlük takvim, gelen randevu bildirimleri, geri arama listesi.
- **Endişe:** "Asistan yanlış saat verirse hasta bana kızar." Her randevunun kaynağı ve arama özeti görünür olmalı.

## 3. Klinik sahibi / yöneticisi: "Dr. Elif, 45"

- **Bağlam:** Diş hekimi ve kliniğin sahibi. Karar verici ve ödemeyi yapan kişi.
- **İhtiyaç:** Kaçan arama ve hasta kaybının bitmesi, ölçülebilir geri dönüş (ROI).
- **Panel kullanımı:** Haftalık rapor (kaç arama, kaç randevu, kaç devir), asistan ayarları (karşılama metni, fiyat söylensin mi, çalışma saatleri).
- **Endişe:** KVKK uyumu ve marka imajı. Asistan kliniği temsil ediyor.

## 4. Hekim: "Dr. Can, 33"

- **Bağlam:** Kliniğin hekimlerinden biri. Paneli nadiren açar.
- **İhtiyaç:** Kendi günlük programını görmek, izin günlerini girmek.
- **Panel kullanımı:** Sadece kendi takvimi (salt okunur veya sınırlı yetki).

## 5. Recall operasyon ekibi (iç kullanıcı)

- **İhtiyaç:** Yeni klinikleri sisteme almak, numara bağlamak, sorunlu aramaları incelemek, maliyetleri izlemek.
- **Not:** MVP'de ayrı bir admin paneli yok. Bu işler doğrudan veritabanı, seed betikleri, `pnpm voice:sync` ve Retell paneli üzerinden yürütülür. Yönetim konsolu F6'da gelir.

## Panel rol eşlemesi

| Persona           | Panel rolü                    | Yetki                                         |
| ----------------- | ----------------------------- | --------------------------------------------- |
| Klinik sahibi     | `owner`                       | Her şey, faturalandırma ve üye yönetimi dahil |
| Klinik yöneticisi | `admin`                       | Ayarlar, personel, hizmetler, tüm randevular  |
| Sekreter          | `member`                      | Randevular, aramalar, hastalar                |
| Hekim             | `member` (+ `practitionerId`) | Kendi takvimi (V1'de kısıtlama)               |
