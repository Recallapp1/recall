# ADR-002: Ses Platformu

| | |
|---|---|
| Durum | Kabul edildi (Faz 1 POC sonrası yeniden değerlendirilecek) |
| Tarih | 2026-10-04 |

## Bağlam

Gerçek zamanlı telefon görüşmesi için SIP/PSTN bağlantısı, STT, LLM döngüsü, TTS, söz kesme ve sessizlik algılama gerekir. Bu iş uzun süre açık kalan, çift yönlü bir bağlantı ister ve Vercel Functions modeline uymaz. Türk numaraları gerekir.

## Seçenekler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Vapi** | STT, LLM ve TTS bileşen bazında seçilebilir; BYO SIP; `assistant-request` ile dinamik asistan; olgun tool webhook'ları | Platform ücreti; satıcı bağımlılığı |
| Retell AI | Benzer özellikler, iyi gecikme | Bileşen esnekliği daha sınırlı |
| ElevenLabs Agents | Çok iyi Türkçe TTS | LLM ve STT esnekliği daha sınırlı |
| LiveKit Agents (kendimiz host ederiz) | En düşük birim maliyet, tam kontrol | Ayrı altyapı (Fly.io/Railway), SIP ve operasyon yükü; küçük ekip için erken |

## Karar

**MVP için Vapi.** Ses katmanı, `src/server/voice/providers/` altında bir adaptörün arkasında tutulur. Tool'lar, prompt ve klinik config'i sağlayıcıdan bağımsızdır.

## Sonuçlar

- ✅ Haftalar değil günler içinde çalışan bir POC.
- ✅ Türkçe için STT ve TTS sağlayıcılarını bağımsız olarak deneyebiliriz.
- ⚠️ Dakika başı platform ücreti marjı etkiler ([COST-MODEL.md](../06-operations/COST-MODEL.md)).
- 🔁 **Yeniden değerlendirme tetikleyicisi:** Aylık 100.000 dakikayı aşmak veya gecikme hedefinin tutturulamaması → LiveKit Agents ile kendi pipeline'ımızı değerlendir.
