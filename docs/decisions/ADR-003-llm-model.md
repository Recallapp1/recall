# ADR-003: Sesli Asistan LLM'i

|       |                                           |
| ----- | ----------------------------------------- |
| Durum | Önerildi: Faz 1 ölçümleriyle kesinleşecek |
| Tarih | 2026-10-04                                |

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

## Önerilen karar

- **Varsayılan:** `claude-opus-5-5`, düşük effort (en yüksek talimat bağlılığı ve tool güvenilirliği).
- Model, `VOICE_LLM_MODEL` env değişkeni ile değiştirilebilir. Kod model adına bağımlı değildir.
- **Faz 1 ölçümü:** Aynı 20 senaryo üç modelle çalıştırılır. Karşılaştırılanlar: (a) senaryo başarısı, (b) p50/p95 ilk token süresi, (c) arama başı maliyet. Gecikme hedefini (p95 < 1,8 sn tur) tutturan modeller arasından en yüksek başarı oranına sahip olan seçilir; başarı eşitse daha ucuz olan seçilir.

## İlk ölçüm (2026-10-04, tek web call, 124 sn)

| Ölçü                    | p50     | p90     |
| ----------------------- | ------- | ------- |
| Uçtan uca tur gecikmesi | 2,22 sn | 3,34 sn |
| LLM (`claude-5-sonnet`) | 1,41 sn | 1,57 sn |
| ASR                     | 0,60 sn | 0,72 sn |
| TTS                     | 0,16 sn | 0,19 sn |

Hedef (p50 < 1,0 sn, p95 < 1,8 sn) tutturulamadı; en büyük pay LLM'de. Sıradaki deneme: aynı senaryo `claude-4.5-haiku` ile; ardından Retell LLM'in `model_high_priority` seçeneği (daha düşük gecikme, daha yüksek maliyet). Arama maliyeti: 0,39 $ / 124 sn ≈ **0,19 $/dk** (Retell `combined_cost`).

## Notlar

- **Retell geçişi (2026-10-04):** LLM'i Retell çalıştırır; seçenekler Retell'in listesindeki Claude modelleriyle sınırlıdır: `claude-5-sonnet` (varsayılan, `RETELL_LLM_MODEL`), `claude-4.6-sonnet`, `claude-4.5-sonnet`, `claude-4.5-haiku`. Opus Retell'de sunulmuyor. Effort ve thinking gibi Anthropic parametreleri Retell üzerinden ayarlanamaz. F1.8 ölçümü bu modellerle yapılır.
- Karar ölçümden sonra bu belgeye işlenir ve durum `Kabul edildi` olur.
