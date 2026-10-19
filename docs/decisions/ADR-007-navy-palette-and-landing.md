# ADR-007: Lacivert Palet ve Yeni Tanıtım Sayfası

|                |                                                   |
| -------------- | ------------------------------------------------- |
| Durum          | Kabul edildi (ADR-005'in palet kısmını günceller) |
| Tarih          | 2026-10-04                                        |
| Karar verenler | Ürün ekibi                                        |

## Bağlam

DESIGN.md v1 siyah/zinc monokrom palet ve Emerald-400 vurgu tanımlıyordu. Ürün ekibi tasarımın kliniklere daha çok hitap etmesini, hem "cool" hem son derece profesyonel olmasını ve **koyu mavi + beyaz** palet kullanılmasını istedi. Ayrıca:

- Tanıtım sayfası sıfırdan, en az 7–8 bölümle tasarlanacak (daha uzun, anlaşılır, güven verici).
- Header **yapışkan (sticky)** olacak.
- Başlık: "Kliniğinizin yeni nesil sekreteri"; açıklama: "Yapay zekâ destekli sesli asistan ile gelen aramaları karşılayın, randevuları yönetin ve ekibinize zaman kazandırın."

## Karar

1. **DESIGN.md v2:** Palet koyu lacivert + beyaz + tek parlak mavi vurgu. Token adları korunur (`ink`, `surface-dark`, `canvas`, `paper`, `accent`, `body`, `heading`…); yalnızca değerleri değişir, yeni token'lar eklenir (`primary`, `primary-soft`, `surface-raised`, `success`). Böylece mevcut bileşenler kırılmadan yeni palete geçer.
2. **Kontrast ölçülerek seçildi:** Tüm metin kombinasyonları WCAG AA'yı geçer. Bu, v1'deki açık soruyu da kapatır (Zinc-500 / Zinc-100 ≈ 4,4:1). Gövde metni artık `#475569`, beyazda 7,6:1.
3. Glassmorphism, köşe yarıçapları, hareket ve iç içe ikonlu buton korunur. Grain opaklığı %15'ten %8'e düşürüldü; lacivertte daha temiz bir görünüm için.
4. **Tanıtım sayfası:** 13 bölüm ve footer (yapı DESIGN.md §4'te).
5. **İçerik ilkesi:** Ürün pilot öncesinde olduğu için uydurma müşteri logosu, yorum veya kaynaksız istatistik yok. Ürün görselleri "örnek" olarak etiketlenir. "Avrupa'da barındırma" yalnızca uygulama ve veritabanı için söylenir; ses işleme Retell'de yapılır.
6. **Demo talep formu gerçek:** Ortak Zod sözleşmesi (`src/lib/contracts/demo-request.ts`), `demo_requests` tablosu, server action, KVKK onay kutusu ve bot tuzağı (honeypot).

## Sonuçlar

- ✅ Tek palet tüm ürüne (tanıtım sayfası, panel, e-postalar) uygulanacak.
- ✅ Kontrast sorunu çözüldü.
- ⚠️ Panel türetmeleri ([DESIGN-SYSTEM.md](../04-panel/DESIGN-SYSTEM.md)) yeni palete göre güncellendi; ürün sahibi 2026-10-20'de onayladı; önceki not: F5 öncesi ürün ekibine onaylatılacak.
- ⚠️ Demo talepleri şimdilik yalnızca veritabanına yazılıyor; ekibe bildirim (e-posta) ve görüntüleme ekranı F3/F6'da gelecek.
- ⏳ Logo ve görsel varlıklar ürün ekibiyle birlikte üretilecek. Şimdilik geçici yazı-logo ve CSS tabanlı derinlik kullanılıyor.

## Ek (2026-10-04): Yazı tipi Montserrat

Ürün ekibinin isteğiyle tüm ürünün (tanıtım sayfası, panel, e-postalar) yazı tipi Inter'den **Montserrat**'a geçirildi. Font yine yerel paketten gelir (`@fontsource-variable/montserrat`, `latin-ext` dahil); build ağa bağımlı değildir. Montserrat Inter'den geniş olduğu için header bağlantıları tek satırda tutuldu ve mobilde header iç boşlukları azaltıldı.
