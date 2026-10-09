# Maliyet modeli

_Güncelleme 2026-10-09 (denetim C7). Önceki sürüm (2026-10-04) tahmine dayanıyordu; bu sürüm ölçülen değerleri kullanır. **Tüm senaryolar varsayımdır**; kur, fiyat ve kullanım değiştikçe güncellenir._

## 1. Dakika başı ses maliyeti

Kaynak: Retell fiyat sayfası (2026-10-08) ve ilk değerlendirme koşusu ([VOICE-EVAL.md](../02-voice-agent/VOICE-EVAL.md), 12 arama).

| Bileşen                                              | $/dk (liste) |
| ---------------------------------------------------- | ------------ |
| Retell ses altyapısı                                 | 0,055        |
| Claude 4.5 Haiku (bugünkü model)                     | 0,025        |
| ElevenLabs (Flash dahil)                             | 0,040        |
| **Liste toplamı (bugün)**                            | **0,120**    |
| **Ölçülen faturalanan** (12 arama, ortalama 1,26 dk) | **0,153**    |

Faturalanan, listeden ~%28 yüksek (Retell'in arama başına ek kalemleri). Senaryolarda **0,153 $/dk** kullanılır.

### ADR-003 seçeneklerine göre (liste fiyatı → ölçüm oranıyla tahmini faturalanan)

| Seçenek                        | Model                | Liste $/dk | Tahmini faturalanan $/dk |
| ------------------------------ | -------------------- | ---------- | ------------------------ |
| Bugün / A (ayar + kısa prompt) | Claude 4.5 Haiku     | 0,120      | 0,153                    |
| B                              | Claude 5.5 Sonnet    | 0,159      | 0,203                    |
| C                              | Gemini 3.0 Flash     | 0,111      | 0,141                    |
| C                              | GPT 4.1 mini         | 0,108      | 0,138                    |
| D                              | Haiku + standart ses | 0,095      | 0,121                    |

## 2. Diğer kalemler

| Kalem                      | Birim | Tahmin                                             | Kaynak / not                                                                                      |
| -------------------------- | ----- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| SIP hattı (Verimor örneği) | ay    | santral 478 ₺ + SIP Trunk modülü 1.299 ₺ ≈ 1.800 ₺ | [PHONE-LINE-OPTIONS.md](../07-sales/PHONE-LINE-OPTIONS.md); klinik başına mı tek mi **sorulacak** |
| Gelen arama dakikası (hat) | dk    | genelde 0 (arayan öder)                            | **Doğrulanmadı**                                                                                  |
| SMS                        | adet  | 0,20–0,30 ₺ (varsayım)                             | Netgsm fiyatı **sorulacak**; şu an kapalı                                                         |
| E-posta (Resend)           | ay    | 0 $ (ücretsiz katman 3.000/ay)                     | Yalnızca personel e-postaları                                                                     |
| Hata takibi (Sentry)       | ay    | 0 $ (Developer)                                    | MONITORING.md                                                                                     |
| Veritabanı (Neon Launch)   | ay    | 5–19 $                                             | [BACKUP-RESTORE.md](BACKUP-RESTORE.md)                                                            |
| Barındırma (Vercel Pro)    | ay    | 20 $/kullanıcı                                     | Ticari kullanım için gerekli                                                                      |
| Alan adı                   | yıl   | ~15–40 $                                           | [DOMAIN-MIGRATION.md](DOMAIN-MIGRATION.md)                                                        |

**Ortak sabit gider (tüm klinikler için):** Vercel 20 $ + Neon ~19 $ + Sentry 0 $ + Resend 0 $ ≈ **40 $/ay**.

## 3. Klinik başı aylık senaryolar (varsayım)

Varsayımlar: arama başına ortalama 1,5 dk; aramaların %40'ı randevuyla biter; randevu başına 2 SMS (onay + hatırlatma; SMS açılınca); 1 USD = 45 ₺ (**varsayım**, güncellenmeli); SIP hattı klinik başına 1.800 ₺ (≈ 40 $).

| Senaryo           | Arama/ay | Dakika/ay | Ses (0,153 $/dk) | SIP  | SMS              | **Değişken toplam**      | %60 brüt marj için en az fiyat (×2,5) |
| ----------------- | -------- | --------- | ---------------- | ---- | ---------------- | ------------------------ | ------------------------------------- |
| Küçük (1–2 hekim) | 200      | 300       | 46 $             | 40 $ | 160 adet ≈ 1 $   | **≈ 87 $ (≈ 3.900 ₺)**   | **≈ 218 $ (≈ 9.800 ₺)**               |
| Orta (3–6 hekim)  | 650      | 1.000     | 153 $            | 40 $ | 520 adet ≈ 3 $   | **≈ 196 $ (≈ 8.800 ₺)**  | **≈ 490 $ (≈ 22.000 ₺)**              |
| Büyük (7+ hekim)  | 2.000    | 3.000     | 459 $            | 40 $ | 1.600 adet ≈ 9 $ | **≈ 508 $ (≈ 22.900 ₺)** | **≈ 1.270 $ (≈ 57.000 ₺)**            |

Ortak sabit gider (~40 $/ay) klinik sayısına bölünür; 10 klinikte klinik başı ~4 $.

### Hassasiyet

- **Model:** C (Gemini Flash) ses maliyetini ~%8 düşürür (orta senaryoda ≈ 12 $/ay); B (Sonnet) ~%33 artırır.
- **Arama süresi:** gecikme ve tekrar sorular süreyi uzatır; ortalama 1,5 → 2 dk olursa ses maliyeti %33 artar.
- **SIP hattı paylaşılabiliyorsa** (tek hesapta birden çok numara), küçük klinikte değişken maliyet ~%45 düşer.

## 4. Fiyatlandırmaya etkisi

[PRICING.md](../00-product/PRICING.md) ilkesi (paket fiyatı ≥ değişken maliyetin 2,5 katı) bu varsayımlarla: Başlangıç (300 dk) ≈ **9.800 ₺/ay**, Profesyonel (1.000 dk) ≈ **22.000 ₺/ay**, Klinik+ (3.000 dk) ≈ **57.000 ₺/ay** taban fiyat. Bu tabanlar, yarı zamanlı bir sekreterin maliyetiyle ve klinik görüşmeleriyle karşılaştırılarak kesinleşir (iş kararı). SIP maliyetinin paylaşılması küçük paketi belirgin ucuzlatır.

## 5. Güncelleme

- Değerlendirme koşusundan sonra (kredi yüklenince) dakika başı faturalanan değer yeniden ölçülür.
- SIP ve SMS teklifleri gelince §2 güncellenir.
- Kur her fiyat güncellemesinde gözden geçirilir; fiyatların TL mi USD bazlı mı olacağı PRICING.md'deki açık soru.
