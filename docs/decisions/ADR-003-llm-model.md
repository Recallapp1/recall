# ADR-003: Sesli Asistan LLM'i

| | |
|---|---|
| Durum | Önerildi: Faz 1 ölçümleriyle kesinleşecek |
| Tarih | 2026-10-04 |

## Bağlam

Sesli asistanın LLM'i aynı anda şunları sağlamalı:
1. **Düşük gecikme:** İlk token süresi, tur gecikmesinin en büyük parçası.
2. **Güvenilir tool kullanımı:** Doğru ID'ler, doğru tarih çözümleme, teyitsiz işlem yapmama.
3. **Doğal Türkçe** ve talimatlara sıkı bağlılık (tıbbi tavsiye yok, uydurma yok).
4. Makul maliyet ([COST-MODEL.md](../06-operations/COST-MODEL.md)).

## Adaylar (Anthropic, 2026-09)

| Model | ID | Not |
|---|---|---|
| Claude Opus 5.5 | `claude-opus-5-5` | En yetenekli Opus. Effort ayarı ile hız ve kalite dengelenebilir. Thinking kapatılamaz; `low` effort kullanılır |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | Hız ve yetenek dengesi, daha düşük maliyet |
| Claude Haiku 4.5 | `claude-haiku-4-5` | En hızlı ve en ucuz; karmaşık akışlarda zayıf kalabilir |

## Önerilen karar

- **Varsayılan:** `claude-opus-5-5`, düşük effort (en yüksek talimat bağlılığı ve tool güvenilirliği).
- Model, `VOICE_LLM_MODEL` env değişkeni ile değiştirilebilir. Kod model adına bağımlı değildir.
- **Faz 1 ölçümü:** Aynı 20 senaryo üç modelle çalıştırılır. Karşılaştırılanlar: (a) senaryo başarısı, (b) p50/p95 ilk token süresi, (c) arama başı maliyet. Gecikme hedefini (p95 < 1,8 sn tur) tutturan modeller arasından en yüksek başarı oranına sahip olan seçilir; başarı eşitse daha ucuz olan seçilir.

## Notlar

- Vapi üzerinden kullanılabilen Anthropic modelleri ve parametreleri (effort, thinking) Vapi'nin desteğine bağlıdır. Faz 1'de doğrulanacak. Desteklenmeyen bir parametre gerekiyorsa Vapi'nin "custom LLM" seçeneğiyle kendi uç noktamızdan Anthropic SDK çağrılabilir.
- Karar ölçümden sonra bu belgeye işlenir ve durum `Kabul edildi` olur.
