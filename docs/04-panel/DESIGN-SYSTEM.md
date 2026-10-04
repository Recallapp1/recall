# Tasarım Sistemi: Panel Türetmeleri

> **Tek tasarım kaynağı kök dizindeki [DESIGN.md](../../DESIGN.md) dosyasıdır** ([ADR-005](../decisions/ADR-005-design-system.md)).
> Bu belge yalnızca DESIGN.md'nin tarif etmediği panel öğelerini (tablo, form, takvim, rozet vb.) **DESIGN.md kurallarını bozmadan** tanımlar. Çelişki olursa DESIGN.md geçerlidir.

Durum: Taslak. İçerik [IMPLEMENTATION-PLAN.md → F4.1](../IMPLEMENTATION-PLAN.md#f41-tokenlar-ve-temel) görevinde doldurulacak.

## Doldurulacak bölümler (F4.1)

1. **Token eşlemesi:** DESIGN.md değerleri → `src/app/globals.css` `@theme` değişkenleri
2. **Panel kabuğu:** Koyu cam kenar çubuğu (alttan ağırlıklı gradyan + %15 grain), açık içerik alanı (Zinc-100), yüzen cam üst bar
3. **Yoğun veri öğeleri:** Tablo, form alanları, takvim ızgarası, durum rozetleri, boş durum, iskelet yükleme, toast, dialog/sheet
4. **Radius eşlemesi:** Sayfa bölümleri `2.5rem`, kartlar `1rem–1.5rem`, buton ve rozetler `rounded-full`
5. **Erişilebilirlik kuralları:** Kontrast (Zinc-500 / Zinc-100 ≈ 4,4:1), Emerald-400 yalnızca koyu zeminde metin; odak halkaları; `prefers-reduced-motion`
6. **Durum renkleri:** Randevu durumları ve kaynak rozetleri monokrom palet + tek Emerald aksanla nasıl ayrışır (ürün ekibi onayı gerekir)
7. **UI yazım tonu:** Kısa, eylem odaklı, "siz" dili; hata mesajı ne olduğunu ve ne yapılacağını söyler
