# Tasarım Sistemi

## İlkeler

1. **Sakin ve güven veren:** Sağlık sektörü. Agresif renkler ve animasyonlar yok.
2. **Yoğun ama okunur:** Sekreter bir bakışta günü görmeli.
3. **Erişilebilir:** WCAG AA kontrast; klavye ile tam kullanım.
4. **Türkçe öncelikli:** Uzun Türkçe kelimelere yer bırakan düzen; `tr-TR` tarih ve sayı biçimleri.

## Temel

- **Bileşen kütüphanesi:** [shadcn/ui](https://ui.shadcn.com) (Radix + Tailwind). Bileşenler `src/components/ui/` altına kopyalanır ve bizim kodumuzdur.
- **İkonlar:** lucide-react.
- **Font:** Geist Sans (UI), Geist Mono (saat ve numaralar), `next/font` ile.
- **Tema:** Açık (varsayılan) ve koyu. Renkler CSS değişkenleri ile tanımlanır (`src/app/globals.css`).

## Renkler (semantik token'lar)

| Token | Kullanım | Açık tema |
|---|---|---|
| `--primary` | Ana aksiyon, marka | Teal 600 `#0d9488` |
| `--background` | Sayfa | `#ffffff` |
| `--muted` | İkincil yüzey | Slate 50 |
| `--foreground` | Metin | Slate 900 |
| `--destructive` | İptal, sil | Red 600 |

### Durum renkleri (randevu)
| Durum | Renk |
|---|---|
| scheduled | Mavi |
| confirmed | Teal |
| completed | Gri |
| cancelled | Kırmızı (üstü çizili) |
| no_show | Turuncu |

### Kaynak rozeti
- `voice` → 🎙 "Asistan" rozeti (primary, açık ton)
- `panel` → "Panel" rozeti (nötr)

## Tipografi ölçeği

| Rol | Sınıf |
|---|---|
| Sayfa başlığı | `text-2xl font-semibold tracking-tight` |
| Bölüm başlığı | `text-lg font-medium` |
| Gövde | `text-sm` |
| Yardımcı | `text-xs text-muted-foreground` |

## Boşluk ve düzen

- 4px tabanlı Tailwind ölçeği.
- Panel: sol sidebar (masaüstü), alt sekme çubuğu (mobil).
- İçerik genişliği: `max-w-7xl`.

## Yazım tonu (UI metinleri)

- Kısa, eylem odaklı: "Randevu oluştur", "İptal et".
- Hata mesajları ne olduğunu ve ne yapılacağını söyler: "Bu saat dolu. Başka bir saat seçin."
- "Siz" dili.
