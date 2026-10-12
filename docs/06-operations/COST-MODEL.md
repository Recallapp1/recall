# Maliyet modeli

_Güncelleme 2026-10-11 (R2 6a; önceki sürüm 2026-10-09, C7)._

> **Bu modelde ölçülmüş tek değer, dakika başı faturalanan ses maliyetidir: 0,153 $/dk.** Bu değer 2026-10-08'de yapılan **12 senaryolu test aramasından** gelir (betikli arayan, tek yapılandırma: Claude 4.5 Haiku + ElevenLabs Flash; toplam 15,10 dk, 2,314 $; ham veri `.voice-eval/recovered-run1.json`, git dışı). Gerçek hasta aramaları ölçülmedi. Diğer modeller için kullanılan ×1,28 oranı **ölçülmedi**, yalnızca Haiku + Flash ölçümünden taşındı. Diğer her rakam ya sağlayıcının yayımladığı fiyattır ya da varsayımdır. Kur: **1 USD = 50 TL (varsayım)**.

Her satırdaki etiket:

- **Ölçüldü:** kendi verimizden hesaplandı (kaynak yazılı).
- **Yayımlanmış:** sağlayıcının fiyat sayfası (tarih yazılı); fatura ile doğrulanmadı.
- **Türetildi:** yukarıdakilerden hesaplandı; girdisi varsayımsa sonucu da varsayımdır.
- **Varsayım:** tahmin; ürün ekibi gerçek değerle değiştirmeli.

## 1. Dakika başı ses maliyeti

| Kalem                                  | $/dk    | Etiket                                                         |
| -------------------------------------- | ------- | -------------------------------------------------------------- |
| Retell ses altyapısı                   | 0,055   | Yayımlanmış (Retell fiyat sayfası, 2026-10-08)                 |
| Claude 4.5 Haiku (bugünkü model)       | 0,025   | Yayımlanmış (aynı sayfa)                                       |
| ElevenLabs (Flash dahil)               | 0,040   | Yayımlanmış (aynı sayfa)                                       |
| **Liste toplamı (bugün)**              | 0,120   | Türetildi (yayımlanmış kalemlerin toplamı)                     |
| **Faturalanan (Haiku + Flash)**        | 0,153   | **Ölçüldü** (12 test araması, 2,314 $ / 15,10 dk)              |
| Ortalama arama süresi (test aramaları) | 1,26 dk | **Ölçüldü** (aynı 12 arama; betikli, gerçek hasta değil)       |
| Faturalanan / liste oranı              | ×1,28   | Türetildi (0,153 / 0,120); yalnızca Haiku + Flash için geçerli |

### ADR-003 seçenekleri

| Seçenek                        | Model                | Liste $/dk (yayımlanmış) | Tahmini faturalanan $/dk            |
| ------------------------------ | -------------------- | ------------------------ | ----------------------------------- |
| Bugün / A (ayar + kısa prompt) | Claude 4.5 Haiku     | 0,120                    | 0,153 (**ölçüldü**)                 |
| B                              | Claude 5.5 Sonnet    | 0,159                    | 0,203 (**ölçülmedi**: liste × 1,28) |
| C                              | Gemini 3.0 Flash     | 0,111                    | 0,141 (**ölçülmedi**: liste × 1,28) |
| C                              | GPT 4.1 mini         | 0,108                    | 0,138 (**ölçülmedi**: liste × 1,28) |
| D                              | Haiku + standart ses | 0,095                    | 0,121 (**ölçülmedi**: liste × 1,28) |

Ses değerlendirmesinin 1. kademesi (VOICE-EVAL.md; Recall Dev kredisi yüklenince) Gemini Flash için ilk gerçek ölçümü verir.

## 2. Diğer kalemler

| Kalem                      | Birim | Değer                                              | Etiket                                                                      |
| -------------------------- | ----- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| SIP hattı (Verimor örneği) | ay    | santral 478 ₺ + SIP Trunk modülü 1.299 ₺ ≈ 1.800 ₺ | Yayımlanmış (PHONE-LINE-OPTIONS.md); klinik başına mı tek mi: **sorulacak** |
| Gelen arama dakikası (hat) | dk    | 0 (arayan öder)                                    | Varsayım, **doğrulanmadı**                                                  |
| SMS                        | adet  | 0,25 ₺                                             | Varsayım (Netgsm fiyatı **sorulacak**; gönderim kapalı)                     |
| E-posta (Resend)           | ay    | 0 $ (3.000 e-posta/ay)                             | Yayımlanmış (ücretsiz katman)                                               |
| Hata takibi (Sentry)       | ay    | 0 $ (Developer)                                    | Yayımlanmış                                                                 |
| Veritabanı (Neon Launch)   | ay    | 5–19 $                                             | Türetildi (yayımlanmış CU-saat fiyatı × tahmini kullanım)                   |
| Barındırma (Vercel Pro)    | ay    | 20 $ / kullanıcı                                   | Yayımlanmış                                                                 |
| Alan adı                   | yıl   | 15–40 $                                            | Varsayım                                                                    |

**Ortak sabit gider:** Vercel 20 $ + Neon ≈ 19 $ ≈ **40 $/ay** (türetildi; Neon kısmı tahmin).

## 3. Klinik başı aylık senaryolar

Varsayımlar (hepsi **varsayım**): arama başına 1,5 dk (ölçülen 1,26 dk betikli test aramasıydı; gerçek hasta aramaları daha uzun olabilir), aramaların %40'ı randevuyla biter, randevu başına 2 SMS (SMS açılınca), SIP hattı klinik başına 1.800 ₺ = 36 $, **1 USD = 50 TL**. Ses maliyeti ölçülen 0,153 $/dk ile hesaplanır.

| Senaryo           | Arama/ay | Dakika/ay | Ses   | SIP  | SMS              | **Değişken toplam**      | %60 brüt marj için en az fiyat (×2,5) |
| ----------------- | -------- | --------- | ----- | ---- | ---------------- | ------------------------ | ------------------------------------- |
| Küçük (1–2 hekim) | 200      | 300       | 46 $  | 36 $ | 160 adet ≈ 1 $   | **≈ 83 $ (≈ 4.150 ₺)**   | **≈ 208 $ (≈ 10.400 ₺)**              |
| Orta (3–6 hekim)  | 650      | 1.000     | 153 $ | 36 $ | 520 adet ≈ 3 $   | **≈ 192 $ (≈ 9.600 ₺)**  | **≈ 480 $ (≈ 24.000 ₺)**              |
| Büyük (7+ hekim)  | 2.000    | 3.000     | 459 $ | 36 $ | 1.600 adet ≈ 8 $ | **≈ 503 $ (≈ 25.150 ₺)** | **≈ 1.258 $ (≈ 62.900 ₺)**            |

Her toplam **türetildi**: tek ölçülmüş girdi 0,153 $/dk'dır, geri kalanı varsayımdır. Ortak sabit gider (~40 $/ay) klinik sayısına bölünür; 10 klinikte klinik başı ~4 $.

### Hassasiyet (türetildi)

- **Model:** C (Gemini Flash) ses maliyetini ~%8 düşürür; B (Sonnet) ~%33 artırır. İkisi de ölçülmemiş ×1,28 oranına dayanır.
- **Arama süresi:** ortalama 1,5 → 2 dk olursa ses maliyeti %33 artar.
- **Kur:** 1 USD = 45 TL olsaydı TL tabanları ~%10 düşük çıkardı; dolar tabanları değişmez.
- **SIP hattı paylaşılabiliyorsa** (tek hesapta birden çok numara), küçük klinikte değişken maliyet ~%40 düşer.

## 4. Fiyatlandırmaya etkisi

[PRICING.md](../00-product/PRICING.md) kuralına göre (paket fiyatı ≥ değişken maliyetin 2,5 katı) taban fiyatlar bu varsayımlarla: Başlangıç (300 dk) ≈ **10.400 ₺/ay**, Profesyonel (1.000 dk) ≈ **24.000 ₺/ay**, Klinik+ (3.000 dk) ≈ **62.900 ₺/ay**. Gerçek fiyat iş kararıdır (yarı zamanlı sekreter maliyeti ve klinik görüşmeleriyle karşılaştırılır).

## 5. Güncelleme

- Değerlendirme kademe 1'den sonra Gemini Flash'ın faturalanan dakikası ölçülür; ×1,28 tahmini o satırda ölçümle değişir.
- İlk pilot aylarında gerçek hasta aramalarının süresi ve dakika başı faturası ölçülür; §3 varsayımları onlarla değişir.
- SIP ve SMS teklifleri gelince §2 güncellenir.
- Kur her fiyat güncellemesinde gözden geçirilir; fiyatların TL mi USD bazlı mı olacağı PRICING.md'deki açık soru.
