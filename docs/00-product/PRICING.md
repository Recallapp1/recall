# Fiyatlandırma

> Taslaktır. Rakamlar [COST-MODEL.md](../06-operations/COST-MODEL.md) içindeki gerçek ölçümlerle Faz 1 sonunda kesinleşecek.

## İlkeler

1. **Değer odaklı:** Referans nokta, yarı zamanlı bir sekreterin maliyeti ve kaçan hasta başına kayıp gelir.
2. **Öngörülebilir:** Klinikler sabit aylık ücreti sever. Dakika bazlı fiyatlandırma sadece aşımda devreye girer.
3. **Brüt marj ≥ %60:** Paket fiyatı, dahil dakikaların değişken maliyetinin en az 2,5 katı olmalı.

## Paket taslağı

|                           | Başlangıç | Profesyonel     | Klinik+               |
| ------------------------- | --------- | --------------- | --------------------- |
| Hedef                     | 1–2 hekim | 3–6 hekim       | 7+ hekim / çoklu şube |
| Dahil dakika / ay         | 300       | 1.000           | 3.000                 |
| Aşım (dk)                 | ₺X        | ₺Y              | ₺Z                    |
| Telefon numarası          | 1         | 1               | 3                     |
| SMS (onay + hatırlatma)   | 300       | 1.000           | 3.000                 |
| Panel kullanıcısı         | 3         | 10              | Sınırsız              |
| İnsana devretme           | ✓         | ✓               | ✓                     |
| Arama kaydı ve transkript | ✓         | ✓               | ✓                     |
| Haftalık rapor            | —         | ✓               | ✓                     |
| Entegrasyonlar (V1+)      | —         | Google Calendar | Tümü                  |
| Destek                    | E-posta   | Öncelikli       | Atanmış yönetici      |

₺X, ₺Y, ₺Z ve aylık ücretler maliyet ölçümlerinden sonra belirlenecek.

## Diğer

- **Kurulum ücreti:** Pilot dönemde yok. Sonrasında numara taşıma ve özel yapılandırma için tek seferlik ücret opsiyonu.
- **Deneme:** 14 gün veya 100 dakika (hangisi önce dolarsa).
- **Yıllık ödeme:** 2 ay ücretsiz.
- **Pilot klinikler:** İlk 3 ay ücretsiz; karşılığında geri bildirim ve referans.

## Açık sorular

- [ ] Fiyatlar TL mi, USD bazlı TL mi olacak? (Sağlayıcı maliyetleri USD.)
- [ ] KDV dahil mi gösterilecek?
