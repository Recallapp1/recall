# ADR-004: Ses Platformu Olarak Retell AI

|                |                                        |
| -------------- | -------------------------------------- |
| Durum          | Kabul edildi (ADR-002'nin yerini alır) |
| Tarih          | 2026-10-04                             |
| Karar verenler | Ürün ekibi                             |

## Bağlam

ADR-002 ile MVP için Vapi seçilmişti. Ürün ekibi **Vapi'yi kullanmama** ve birincil ses altyapısı olarak **Retell AI Voice Agent API**'yi kullanma kararı aldı. Netgsm (SIP trunk ve SMS) ve benzeri yerel altyapılar test edilerek karşılaştırılacak.

Retell'in ihtiyaçlarımızı karşıladığı doğrulandı (2026-10-04, resmî dokümantasyon):

| İhtiyaç                       | Retell karşılığı                                                                                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Türkçe                        | `tr-TR` dil kodu. ASR: Deepgram, Azure, Soniox, AssemblyAI. TTS: ElevenLabs, Cartesia, OpenAI, MiniMax, Fish Audio. Not: Türkçe tanıma **sadece Türkçe** modunda güvenilir, çok dilli mod kaliteyi düşürür |
| Türk numarası                 | Elastic SIP trunking: operatörün origination adresi `sip:sip.retellai.com`, numara Retell'e "import" edilir                                                                                                |
| Arama başına kiracı çözümleme | **Inbound call webhook** (`call_inbound`): `override_agent_id`, `dynamic_variables`, `metadata`, `reject` dönülebilir. 10 sn zaman aşımı, 3 deneme                                                         |
| Tool çağrıları                | **Custom function**: Retell bizim URL'imize `POST { name, call, args }` gönderir. Yanıt en fazla 15.000 karakter, zaman aşımı ayarlanabilir                                                                |
| Güvenlik                      | `X-Retell-Signature: v={ms},d={hmac}` = HMAC-SHA256(ham gövde + zaman damgası, API anahtarı). 5 dakikalık tazelik penceresi. SDK: `Retell.verify`                                                          |
| Arama kayıtları               | Agent webhook olayları: `call_started`, `call_ended`, `call_analyzed` (+ transfer olayları)                                                                                                                |
| LLM                           | Retell LLM; Claude modelleri listede mevcut (ör. `claude-4.5-sonnet`, `claude-4.5-haiku`, `claude-5-sonnet`; liste değişebilir)                                                                            |
| Yönetim API'si                | Create/Update Retell LLM, Create/Update Agent, Import Phone Number                                                                                                                                         |

## Seçenekler

1. **Retell AI:** Yönetilen pipeline, Türkçe desteği, gelen arama webhook'u ile dinamik değişkenler, API ile ajan yönetimi.
2. **Vapi:** Ürün ekibi tarafından reddedildi.
3. **Kendi pipeline'ımız (LiveKit vb.):** Ayrı altyapı ve operasyon yükü; şu aşama için erken.

## Karar

**Retell AI.** Mimari şöyle olacak:

- **Klinik başına bir Retell LLM ve bir Retell Agent.** Bu ajanlar bizim veritabanımızdan **senkronize edilir** (agent sync). Klinik bilgisi (hizmetler, hekimler, saatler, SSS, ses, kurallar) değiştiğinde ilgili kliniğin ajanı güncellenir. Tek kaynak bizim veritabanımızdır; Retell panelinde elle değişiklik yapılmaz.
- **Arama anı verileri** (bugünün tarihi, saat, arayan numara, aktarım mümkün mü, klinik duraklatılmış mı) inbound webhook ile `dynamic_variables` olarak verilir. Senkronize edilen prompt bu değişkenlere `{{değişken}}` ile başvurur.
- **Tool'lar** sağlayıcıdan bağımsız kalır (`src/server/voice/tools/`). Retell custom function'ları tek bir uç noktaya (`/api/voice/retell/tools`) gelir ve `name` alanına göre dağıtılır.
- **Kiracı kaynağı:** `call.agent_id` → `voice_agents` tablosu → klinik. Inbound webhook'ta `metadata.clinic_id` de yazılır ve iki kaynak çapraz doğrulanır. LLM argümanları kiracı belirlemez (değişmeyen kural).
- Mevcut Vapi adaptörü ve testleri Faz 1'de kaldırılır.

## Sonuçlar

- ✅ Domain katmanı, tool'lar ve prompt üretimi aynen kullanılır; değişen yalnızca sağlayıcı adaptörüdür.
- ✅ Klinik başına ajan, her kliniğe farklı ses, model ve davranış tanımlamayı doğal hâle getirir.
- ⚠️ Ajan senkronizasyonu yeni bir sorumluluktur: hata durumları, yeniden deneme ve "son senkron" durumu panelde görünmeli.
- ⚠️ LLM seçimi Retell'in desteklediği modellerle sınırlıdır. ADR-003 buna göre güncellenmeli (Faz 1 ölçümü).
- ⚠️ Gecikme bütçesi: custom function çağrıları Retell sunucularından Vercel `fra1`'e gelir. Retell'in hangi bölgeden çağırdığı ölçülmeli (Faz 1).
- 🔁 **Yeniden değerlendirme:** Türkçe kalite veya gecikme hedefleri tutturulamazsa ya da aylık dakika maliyeti marjı bozarsa alternatifler (Netgsm'in kendi ses ürünleri, ElevenLabs Agents, kendi pipeline'ımız) karşılaştırılır.

## Kaynaklar

- Inbound call webhook: https://docs.retellai.com/features/inbound-call-webhook
- Custom function: https://docs.retellai.com/build/single-multi-prompt/custom-function
- Webhook güvenliği: https://docs.retellai.com/features/secure-webhook
- Webhook olayları: https://docs.retellai.com/features/webhook
- Dil desteği: https://docs.retellai.com/build/language-support
- Özel telefon altyapısı (SIP): https://docs.retellai.com/deploy/custom-telephony
- Create Retell LLM: https://docs.retellai.com/api-references/create-retell-llm
