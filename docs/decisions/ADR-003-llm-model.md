# ADR-003: Sesli Asistan LLM'i

|       |                                                                                                                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Durum | **Geçerli: `claude-4.5-haiku` + ElevenLabs `eleven_flash_v2_5`** (production). **Seçenek A onaylandı (2026-10-08)**: ayarlar hazır ama kapalı; ölçüm Retell kredisi yüklenince. C için test profilleri hazır; model değişikliği ayrıca onay ister |
| Tarih | 2026-10-04 · güncelleme 2026-10-19                                                                                                                                                                                                                |

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

## Karar 2026-10-08: seçenek A onaylandı

Ürün ekibi A'yı onayladı: model ve ses aynı (Haiku + Flash), Retell sıra alma ayarları **ihtiyatlı** (yavaş konuşanın sözü kesilmez), prompt kısaltılır. Ölçüm Retell kredisi yüklenene kadar yapılmaz. C (Gemini 3.0 Flash, GPT 4.1 mini) yalnızca aynı senaryolarda ölçülmek üzere hazırlanır; **production modeli onaysız değişmez**.

**Uygulama (her biri env ile açılır, silinince eski hâline döner):**

| Ayar                              | Değer (A) | Varsayılan (bugün)        | Not                                                                                                                                                           |
| --------------------------------- | --------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VOICE_PROMPT_VARIANT`            | `compact` | `full`                    | Aynı kurallar, daha az sözcük. Demo klinikte 8.715 → 6.595 karakter (−%24; kural bölümleri yaklaşık −%40). Prompt testlerinin tamamı iki varyantta da çalışır |
| `RETELL_DYNAMIC_RESPONSIVENESS`   | `true`    | tanımsız (Retell: kapalı) | Retell yanıt zamanlamasını arayanın konuşma hızına uyarlar: yavaş konuşanı bekler                                                                             |
| `RETELL_RESPONSIVENESS`           | tanımsız  | tanımsız (Retell: 1)      | **1 zaten Retell'in en hızlı değeri**: daha hızlı yapılamaz, düşürmek yalnızca bekletir. A'da değişmez; ölçümde yavaş konuşan senaryosu düşerse düşürülür     |
| `RETELL_INTERRUPTION_SENSITIVITY` | tanımsız  | tanımsız (Retell: 1)      | Gecikmeyi etkilemez; söz kesme davranışını değiştirmemek için dokunulmadı                                                                                     |

Tanımsız ayarlar Retell'e hiç gönderilmez: kod production'a çıktığında ajanların tanımı (ve özeti) değişmez, yani deploy tek başına hiçbir aramayı etkilemez (testli).

**Beklenti (dürüst):** Ölçülen tur gecikmesinin ~%40'ı LLM, ~%37'si ASR ve uç algılama. Uç algılama zaten en hızlı ayarda; prompt kısalması ilk token süresinde onlarca ila birkaç yüz milisaniyelik kazanç getirebilir. A tek başına p50 < 1.000 ms hedefini büyük olasılıkla tutturmaz; asıl soru C'nin LLM payını ne kadar düşürdüğü.

**Ölçüm planı (kredi yüklenince; dev ajanı, production'a dokunmaz):**

```bash
pnpm voice:eval --plan
```

```bash
pnpm voice:eval --profile baseline
```

```bash
pnpm voice:eval --profile option-a
```

```bash
pnpm voice:eval --profile option-c-gemini
```

```bash
pnpm voice:eval --profile option-c-gpt
```

Her koşu 26 senaryo, ~4,5–5 $ (toplam ~19 $). Profil yalnızca dev kliniğinin ajanını koşu süresince değiştirir ve sonunda env ayarlarına geri döndürür. Yeni iki senaryo (`slow-speaker`, `hesitant-caller`) cümle içinde 1,5 ve 2,5 sn duraksar; asistan araya girerse transkriptteki arayan turu sayısı satır sayısını aşar ve senaryo düşer.

**Production'a alma (ölçüm A'yı doğrularsa):** Vercel'de `VOICE_PROMPT_VARIANT=compact` ve `RETELL_DYNAMIC_RESPONSIVENESS=true` → yeniden deploy (build ajanları senkronlar) → bir test araması. **Geri alma:** iki değişkeni silip yeniden deploy. Karar kesinleşince kullanılmayan prompt varyantı koddan kaldırılır.

## Güncelleme 2026-10-09: güçlendirme varyantı ve kademeli ölçüm

- Yeni değerlendirme profili `option-hardening`: Haiku + tam prompt + `VOICE_PROMPT_HARDENING` (A9: önce değişmez güvenlik kuralları, klinik metni güvenilmeyen veri, kayıt itirazı ve sistem hatası kuralları, örnek ad/numara yok). Hiçbir yerde açık değil; bugünkü prompt bayt bayt aynı kaldı (canlı ajanın özeti değişmedi).
- Ölçüm sırası ve maliyeti: [VOICE-EVAL.md → Kademeli plan](../02-voice-agent/VOICE-EVAL.md). Önce `baseline` ve `option-c-gemini`, sonra kalan profiller. Her koşu Recall Dev çalışma alanının kredisini kullanır.
- Değişmeyenler: production modeli `claude-4.5-haiku`, ses `eleven_flash_v2_5`; seçenek A ayarları ve güçlendirme kapalı. Model değişikliği ürün ekibinin onayını bekler.

## Ölçüm 2026-10-19: tam koşu (Haiku + Flash, dev anahtarları açık)

Kaynak: [VOICE-EVAL.md](../02-voice-agent/VOICE-EVAL.md), 26 senaryo, 23/26 geçti, 99 tur. Dev ajanında yeni talimat ve araç anahtarları açıktı (acil durum, randevu kuralları, hitap, araç ipuçları); model ve ses production ile aynı.

| Ölçü              | Değer   |
| ----------------- | ------- |
| Uçtan uca tur p50 | 1,69 sn |
| Uçtan uca tur p95 | 3,77 sn |
| LLM (Haiku) p50   | 0,67 sn |

Hedef (p50 < 1,0, p95 < 1,8) yine **tutmuyor**; 8 Ekim'deki p50 ≈ 1,55 sn'den biraz yüksek (talimat uzadı, senaryolar farklı). Seçenek A ve C hâlâ ölçülmedi: sıradaki adım kademe 1 (baseline, seçenek A, Gemini Flash) ve `slow-speaker` için Retell sıra alma ayarları, aynı koşuda (~20 $ Recall Dev kredisi). Model, ayar ve pilot için kabul edilecek gecikme eşiği ürün sahibinin kararıdır.
