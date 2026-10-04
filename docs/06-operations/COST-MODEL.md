# Maliyet Modeli

> Rakamlar **tahminidir** ve Faz 1'de gerçek arama verisiyle güncellenecek. Sağlayıcı fiyatları değişir; kullanmadan önce güncel fiyat sayfalarından teyit edin.

## Dakika başı değişken maliyet bileşenleri

| Bileşen                   | Birim         | Tahmin (USD/dk) | Not                                         |
| ------------------------- | ------------- | --------------- | ------------------------------------------- |
| Vapi platform ücreti      | dk            | ~0,05           | Plana göre değişir                          |
| STT                       | dk            | 0,005–0,02      | Sağlayıcıya göre                            |
| TTS                       | karakter → dk | 0,02–0,08       | ElevenLabs pahalı uç, Azure ucuz uç         |
| LLM                       | token         | 0,01–0,05       | Aşağıda                                     |
| SIP trunk (Türk operatör) | dk            | ~0,005–0,02     | Gelen arama ücretlendirmesi operatöre bağlı |
| **Toplam**                |               | **~0,09–0,22**  |                                             |

## LLM maliyeti hesabı

Varsayım: 3 dakikalık arama, 10 tur. Her turda system prompt (~2.000 token) + büyüyen geçmiş → tur başı ortalama ~3.500 input token, ~60 output token.

|            | Input token | Output token      |
| ---------- | ----------- | ----------------- |
| Arama başı | ~35.000     | ~600 (+ thinking) |

Anthropic API fiyatları (MTok başına, 2026-09 itibarıyla):

| Model               | Input $/MTok | Output $/MTok | Arama başı (≈) | Dakika başı (≈) |
| ------------------- | ------------ | ------------- | -------------- | --------------- |
| `claude-opus-5-5`   | 4,00         | 20,00         | ~0,15 $        | ~0,05 $         |
| `claude-sonnet-5-5` | 2,00         | 10,00         | ~0,08 $        | ~0,025 $        |
| `claude-haiku-4-5`  | 1,00         | 5,00          | ~0,04 $        | ~0,013 $        |

**Prompt caching:** System prompt her turda aynı olduğu için cache okuma fiyatıyla (input fiyatının küçük bir kısmı) faturalandırılabilir ve input maliyeti belirgin şekilde düşer. Vapi'nin Anthropic entegrasyonunun prompt caching'i destekleyip desteklemediği Faz 1'de doğrulanacak.

Model seçimi: [ADR-003](../decisions/ADR-003-llm-model.md)

## Sabit maliyetler (aylık, tahmini)

| Kalem                         | Tahmin         |
| ----------------------------- | -------------- |
| Vercel Pro                    | 20 $ / üye     |
| Neon (Launch/Scale)           | 20–70 $        |
| Türk numarası (klinik başına) | Operatöre göre |
| Sentry, uptime izleme         | 0–30 $         |

## Birim ekonomi örneği

Profesyonel paket: 1.000 dk/ay dahil ([PRICING.md](../00-product/PRICING.md)).

|                                          |                                              |
| ---------------------------------------- | -------------------------------------------- |
| Değişken maliyet (0,15 $/dk orta tahmin) | 150 $                                        |
| SMS (1.000 adet)                         | Netgsm fiyatına göre                         |
| Numara                                   | Operatöre göre                               |
| **Hedef fiyat (%60 brüt marj)**          | ≥ 375 $ + SMS ve numara maliyetinin 2,5 katı |

## İzleme

- Her aramanın maliyeti `calls.cost_usd` alanına (Vapi raporundan) yazılır.
- Klinik bazında aylık maliyet ve gelir karşılaştırması (iç pano, Faz 2).
