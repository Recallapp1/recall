# ADR-005: Tek Tasarım Kaynağı Olarak DESIGN.md

|                |              |
| -------------- | ------------ |
| Durum          | Kabul edildi |
| Tarih          | 2026-10-04   |
| Karar verenler | Ürün ekibi   |

## Bağlam

Ürün ekibi, kök dizindeki [DESIGN.md](../../DESIGN.md) dosyasını tasarım sistemi olarak verdi ve bu dosyaya **kesin olarak sadık kalınmasını** istedi. Önceki taslak ([DESIGN-SYSTEM.md](../04-panel/DESIGN-SYSTEM.md): teal, Geist) bununla çelişiyor.

DESIGN.md özeti: glassmorphism ve derinlik; monokrom palet (siyah, Zinc-900, Zinc-100) ve **tek vurgu rengi Emerald-400 `#34D399`**; **Inter** fontu; büyük kapsayıcılarda `2.5rem` köşe yarıçapı; koyu zeminlerde düz renk yasak (alttan ağırlıklı gradyan ve %15 grain dokusu zorunlu); `cubic-bezier(0.16, 1, 0.3, 1)` ile 0.8 sn giriş animasyonu.

## Karar

1. **DESIGN.md tek doğru kaynaktır.** Ürünün tüm arayüzü (tanıtım sitesi, giriş ekranları, klinik paneli, Recall yönetim konsolu) DESIGN.md'den türetilir.
2. DESIGN.md büyük ölçüde tanıtım sayfası bölümlerini tarif eder. Panel gibi yoğun veri ekranları için gereken türetmeler (tablo, form, takvim, rozetler) [DESIGN-SYSTEM.md](../04-panel/DESIGN-SYSTEM.md) belgesinde **DESIGN.md'nin kurallarını bozmadan** tanımlanır. Bu belge DESIGN.md'nin bir uzantısıdır, alternatifi değildir.
3. DESIGN.md'nin tanımlamadığı bir karar gerekirse önce ürün ekibine sorulur, cevap DESIGN-SYSTEM.md'ye işlenir.
4. Token'lar (renk, radius, gölge, blur, motion) tek yerde, `src/app/globals.css` içindeki Tailwind `@theme` bloğunda tanımlanır. Bileşenler sabit değer (hex, px) kullanmaz.
5. DESIGN.md ürün ekibinin dosyasıdır; Prettier ile biçimlendirilmez ve ekip onayı olmadan değiştirilmez.

## Sonuçlar

- ✅ Ürün genelinde tutarlı görünüm, tek referans.
- ⚠️ Mevcut tanıtım sayfası ve `globals.css` (teal, Geist) Faz 4'te DESIGN.md'ye taşınacak.
- ⚠️ Erişilebilirlik kontrolü gerekli: Zinc-500 metin, Zinc-100 zemin üzerinde küçük punto için WCAG AA sınırına yakın. Emerald-400 açık zeminde metin rengi olarak yetersiz kontrastta. Kullanım kuralları DESIGN-SYSTEM.md'de tanımlanacak (Faz 4.1).
