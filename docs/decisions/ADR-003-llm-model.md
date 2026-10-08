# ADR-003: Sesli Asistan LLM'i

|       |                                                                                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Durum | **Geçerli: `claude-4.5-haiku` + ElevenLabs `eleven_flash_v2_5`** (production). Gecikme hedefin üstünde; model değişikliği ürün ekibi kararını bekliyor (aşağıda "Ölçüm 2026-10-08") |
| Tarih | 2026-10-04 · güncelleme 2026-10-08                                                                                                                                                  |

## Bağlam

Sesli asistanın LLM'i aynı anda şunları sağlamalı:

1. **Düşük gecikme:** İlk token süresi, tur gecikmesinin en büyük parçası.
2. **Güvenilir tool kullanımı:** Doğru ID'ler, doğru tarih çözümleme, teyitsiz işlem yapmama.
3. **Doğal Türkçe** ve talimatlara sıkı bağlılık (tıbbi tavsiye yok, uydurma yok).
4. Makul maliyet ([COST-MODEL.md](../06-operations/COST-MODEL.md)).

## Adaylar (Anthropic, 2026-09)

| Model             | ID                  | Not                                                                                                             |
| ----------------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| Claude Opus 5.5   | `claude-opus-5-5`   | En yetenekli Opus. Effort ayarı ile hız ve kalite dengelenebilir. Thinking kapatılamaz; `low` effort kullanılır |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | Hız ve yetenek dengesi, daha düşük maliyet                                                                      |
| Claude Haiku 4.5  | `claude-haiku-4-5`  | En hızlı ve en ucuz; karmaşık akışlarda zayıf kalabilir                                                         |

## İlk öneri (2026-10-04, geçersiz)

- Anthropic API üzerinden `claude-opus-5-5` önerilmişti; Retell geçişiyle (ADR-004) LLM'i Retell çalıştırır ve seçenekler Retell'in listesiyle sınırlıdır. Model `RETELL_LLM_MODEL` ile değişir; kod model adına bağlı değildir.
- **Faz 1 ölçümü:** Aynı 20 senaryo üç modelle çalıştırılır. Karşılaştırılanlar: (a) senaryo başarısı, (b) p50/p95 ilk token süresi, (c) arama başı maliyet. Gecikme hedefini (p95 < 1,8 sn tur) tutturan modeller arasından en yüksek başarı oranına sahip olan seçilir; başarı eşitse daha ucuz olan seçilir.

## İlk ölçüm (2026-10-04, tek web call, 124 sn)

| Ölçü                    | p50     | p90     |
| ----------------------- | ------- | ------- |
| Uçtan uca tur gecikmesi | 2,22 sn | 3,34 sn |
| LLM (`claude-5-sonnet`) | 1,41 sn | 1,57 sn |
| ASR                     | 0,60 sn | 0,72 sn |
| TTS                     | 0,16 sn | 0,19 sn |

Hedef (p50 < 1,0 sn, p95 < 1,8 sn) tutturulamadı; en büyük pay LLM'de. Sıradaki deneme: aynı senaryo `claude-4.5-haiku` ile; ardından Retell LLM'in `model_high_priority` seçeneği (daha düşük gecikme, daha yüksek maliyet). Arama maliyeti: 0,39 $ / 124 sn ≈ **0,19 $/dk** (Retell `combined_cost`).

## Haiku denemesi ve hız ayarları (2026-10-04)

- Ürün ekibi `claude-4.5-haiku` ile test araması yaptı: Türkçe kalite yeterli, hız farkı "çok fark etmedi, bir tık daha hızlı olabilir". **Varsayılan model `claude-4.5-haiku`** (Retell'deki en hızlı Claude).
- Ek hız için iki ayar açıldı (env ile, kod değişmeden geri alınabilir):
  - `RETELL_VOICE_MODEL=eleven_flash_v2_5`: ElevenLabs Flash, Türkçe destekli, multilingual v2'ye göre ilk ses çok daha erken başlar; ek ücret yok.
  - `RETELL_LLM_HIGH_PRIORITY`: Retell'in öncelikli LLM havuzu (`model_high_priority`). **Kapalı (`false`):** Retell fiyat sayfasında (2026-10-05) "Fast Tier" yalnızca bazı GPT modelleri için var ve fiyatı ikiye katlıyor (ör. GPT 5.4: 0,08 → 0,16 $/dk); Claude modelleri için sunulmuyor. Bayrak, desteklenen bir model seçilirse diye kodda kaldı.
- Güncel dakika maliyeti (Retell fiyat sayfası, 2026-10-05): ses altyapısı 0,055 + ElevenLabs 0,040 (Flash dahil tüm ElevenLabs sesleri aynı fiyat) + Claude 4.5 Haiku 0,025 = **~0,12 $/dk**; kendi SIP hattımızla (Netgsm) Retell telefon ücreti yok.
- Claude dışı modeller (Gemini Flash, GPT mini) Retell'de daha hızlı olabilir, ancak bu ADR'nin Claude kararını değiştirir; gerekirse ayrı ölçümle değerlendirilir.
- Sonraki adım: aynı senaryoyla yeni bir ölçüm (Retell call detail → latency) ve sonuçların bu tabloya eklenmesi.

## Notlar

- **Retell geçişi (2026-10-04):** LLM'i Retell çalıştırır; seçenekler Retell'in listesindeki Claude modelleriyle sınırlıdır: `claude-5-sonnet` (varsayılan, `RETELL_LLM_MODEL`), `claude-4.6-sonnet`, `claude-4.5-sonnet`, `claude-4.5-haiku`. Opus Retell'de sunulmuyor. Effort ve thinking gibi Anthropic parametreleri Retell üzerinden ayarlanamaz. F1.8 ölçümü bu modellerle yapılır.
- Karar ölçümden sonra bu belgeye işlenir ve durum `Kabul edildi` olur.

## Ölçüm 2026-10-08: ses değerlendirmesi (Haiku + Flash)

Kaynak: [VOICE-EVAL.md](../02-voice-agent/VOICE-EVAL.md), 12 gerçek web araması (Retell kredisi bittiği için 24 senaryonun 12'si koştu), dev kliniği, production ile aynı ayarlar.

| Ölçü (ms)         | Arama medyanlarının ortancası | Aralık        |
| ----------------- | ----------------------------- | ------------- |
| Uçtan uca tur p50 | ~1.550                        | 1.278 – 3.301 |
| Uçtan uca tur p90 | ~2.700                        | 1.395 – 4.112 |
| LLM (Haiku) p50   | ~630                          | 537 – 720     |
| ASR p50           | ~580                          | 552 – 703     |
| TTS (Flash) p50   | ~165                          | 156 – 238     |

Hedef (p50 < 1.000, p95 < 1.800) **tutmuyor**. Pay: LLM ~%40, ASR/uç algılama ~%37, TTS ~%10, geri kalanı ağ ve Retell.

Kalite bulguları (aynı aramalar): asistan bir kez `book_appointment` çağırmadan "Randevunuz oluşturuldu" dedi; saatleri rakamdan okurken bozdu ("on dört sıfır sıfır", 14:00 isteğini 14:30'a kaydetti); prompt örneğindeki soyadını hastaya söyledi. Yapısal düzeltmeler yapıldı (istenen saat tool'dan sözlü döner, sonuç iddiası kuralı, örnek adlar kaldırıldı); modelden bağımsız güvenceler sunucuda.

## Seçenekler (fiyatlar: Retell fiyat sayfası, 2026-10-08)

Bugün: altyapı 0,055 + Claude 4.5 Haiku 0,025 + ElevenLabs Flash 0,040 = **0,120 $/dk**.

| #   | Seçenek                                                                                                | Dakika maliyeti    | Beklenen etki                                                                                                             | Risk                                                                         |
| --- | ------------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A   | Modeli koru; Retell ayarlarını ayarla (yanıt hızı / uç algılama, kesinti hassasiyeti), prompt'u kısalt | 0,120 $ (değişmez) | Tur başına muhtemelen 0,2–0,5 sn kazanç; ölçülmeli                                                                        | Çok erken konuşma, hastanın sözünü kesme                                     |
| B   | **Claude 5.5 Sonnet** (Retell listesinde yeni)                                                         | 0,159 $ (+%33)     | Talimat ve tool güvenilirliği daha yüksek (yanlış "oluşturuldu" gibi hatalara karşı); gecikme Haiku'dan muhtemelen yüksek | Gecikme hedefinden daha da uzaklaşabilir                                     |
| C   | Claude dışı hızlı model: Gemini 3.0 Flash (0,016) veya GPT 4.1 mini (0,0128)                           | ~0,108–0,111 $     | LLM payında belirgin kısalma beklenir                                                                                     | ADR'nin "Claude" kararını değiştirir; Türkçe ve tool güvenilirliği ölçülmeli |
| D   | Ses: standart sesler (Cartesia/OpenAI vb.)                                                             | −0,025 $/dk        | TTS zaten kısa; maliyet düşer                                                                                             | Türkçe ses kalitesi dinlenmeli                                               |

**Öneri (karar ürün ekibinde):** önce A (ücretsiz) ve aynı 24 senaryoda yeniden ölçüm; ardından B ve C'yi aynı senaryolarla karşılaştırmak için bir koşu (her biri ~7 $). Kalite bulguları ağır bastığı için uzun vadede B'nin güvenilirliği ile C'nin hızı arasında seçim yapılmalı. Model değişikliği klinik ve hastaların fark edeceği bir ürün değişikliği olduğundan onay olmadan yapılmaz.
