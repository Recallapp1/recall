# Sesli Asistan Tasarımı

## Temel ilke

> Asistan bir **resepsiyonisttir**, doktor değildir. Görevi: dinlemek, anlamak, takvime bakmak, randevuyu doğru kaydetmek ve gerektiğinde insana bırakmak.

## Pipeline

```
Hasta sesi → [VAD/endpointing] → STT (tr) → LLM (Claude + tool'lar) → TTS (tr) → Hasta
                                              ↕
                                    Recall webhook (tool'lar)
```

Pipeline Retell tarafından yönetilir ([ADR-004](../decisions/ADR-004-retell-voice-platform.md)). Biz şunları kontrol ederiz:

- **Ajan yapılandırması:** Klinik verisinden üretilip Retell'e senkronize edilir ([`agent-spec.ts`](../../src/server/voice/providers/retell/agent-spec.ts), [`sync.ts`](../../src/server/voice/providers/retell/sync.ts)). Dil `tr-TR`, saat dilimi kliniğinki, STT için klinik adları ve hizmetleri `boosted_keywords` olarak verilir.
- **Arama anı değişkenleri:** Inbound webhook `transfer_available` ve `clinic_status` gönderir; saat, takvim ve arayan numara Retell'in yerleşik değişkenlerinden gelir.
- **System prompt:** Klinik verisinden üretilir. Bkz. [SYSTEM-PROMPT.md](SYSTEM-PROMPT.md).
- **Tool'lar:** Bkz. [TOOLS.md](TOOLS.md).

## Konuşma tasarımı

### Kısa ve sözlü

- Cevaplar 1–2 cümle. Telefonda uzun paragraf dinlenmez.
- Liste okunmaz; **en fazla 2–3 seçenek** sunulur: "Yarın 10:00 ya da 14:30 uygun, hangisini istersiniz?"
- Markdown, emoji, madde işareti kullanılmaz (TTS bunları okur).
- Sayılar ve saatler konuşma diliyle söylenir: "14:30" yerine "iki buçuk" ya da "on dört otuz". Tarih "5 Kasım Çarşamba" biçiminde söylenir.

### Teyit (read-back)

Kalıcı bir işlemden önce (randevu oluşturma, iptal, erteleme) asistan bilgileri **geri okur** ve açık onay alır:

> "Teyit ediyorum: Ayşe Yılmaz adına, 5 Kasım Çarşamba saat 14:30'da Dt. Can Demir ile diş taşı temizliği. Onaylıyor musunuz?"

### İsimler

- STT isimlerde hata yapabilir. İsim alındıktan sonra tekrar edilir: "Ayşe Yılmaz, doğru mu?"
- Emin olunamazsa harf harf istenmez (telefonda yorucudur). İsim olduğu gibi kaydedilir; SMS ve panel düzeltme imkânı verir.

### Söz kesme (barge-in)

Hasta asistan konuşurken söze girerse asistan durur ve dinler. Retell'de varsayılan olarak açıktır; hassasiyet ajan ayarı `interruption_sensitivity` ile değiştirilir (F1.8'de Türkçe için ayarlanacak).

### Sessizlik

- Uygulanan: Retell varsayılanıyla 10 sn sessizlikte model bir kez konuşmaya yönlendirilir (`reminder_trigger_ms` ayarlanmamış; ne söyleyeceği prompt'ta yazmıyor); 20 sn sessizlikte Retell aramayı sonlandırır (`end_call_after_silence_ms`). Öneri: [PROMPT-RECOVERY-RULES.md](../proposals/PROMPT-RECOVERY-RULES.md).
- Hedef (henüz yok): 6 sn sessizlikte "Orada mısınız?", ardından kibar kapanış.

### Bekleme sesleri

Tool çağrısı sürerken asistan kısa bir dolgu cümlesi söyler ("Hemen bakıyorum…"). Retell tool tanımında `speak_during_execution` ve `execution_message_description` ile yapılandırılır.

## Kapsam sınırları

| Yapar                                              | Yapmaz                                  |
| -------------------------------------------------- | --------------------------------------- |
| Randevu oluşturma, iptal, erteleme                 | Tıbbi tavsiye, teşhis, ilaç önerisi     |
| Hizmet, hekim, saat, adres bilgisi                 | Config'de olmayan bilgiyi uydurmak      |
| Fiyat (sadece klinik izin verdiyse, aralık olarak) | Kesin fiyat taahhüdü, indirim pazarlığı |
| İnsana devretme, geri arama notu                   | Başka hastanın bilgisini paylaşmak      |
| Acil durumda 112 yönlendirmesi                     | Acil durumu geçiştirmek                 |

Ayrıntılar: [ESCALATION.md](ESCALATION.md)

## Gecikme

| Kaldıraç                   | Etki                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| LLM seçimi ve effort ayarı | En büyük etken. Bkz. [ADR-003](../decisions/ADR-003-llm-model.md)                              |
| Kısa system prompt         | İlk token süresini düşürür                                                                     |
| Endpointing ayarı          | Agresif olursa hastanın sözü kesilir, gevşek olursa yavaş hissettirir. Türkçe için ayarlanmalı |
| Tool webhook süresi        | Hedef < 300 ms: aynı bölge, indeksli sorgular, soğuk başlatma yok (Fluid Compute)              |
| TTS streaming              | Retell varsayılanı                                                                             |

Ölçüm: Retell'in `call_ended` olayında raporladığı gecikmeler (uçtan uca, ASR, LLM, TTS; p50, p90, max) `CALL_LATENCY_STORE` açıkken `calls.latency` kolonuna yazılır (kapalıyken saklanmaz; Retell panelinden okunur). İzleme panosu henüz yok. Bkz. [MONITORING.md](../06-operations/MONITORING.md).

## Durum yönetimi

Konuşma durumu LLM'in bağlamındadır. Kalıcı durum (randevu, hasta) **sadece tool'lar aracılığıyla** değişir. Asistan "randevunuz oluşturuldu" demeden önce `book_appointment` sonucunda `ok: true` görmüş olmalıdır. Bu kural prompt'ta açıkça yer alır.
