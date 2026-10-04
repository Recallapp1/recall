# Telefon Altyapısı

## Sorun

Türkiye'deki klinikler için **Türk numarası** gerekir. Çözüm: Türk operatöründen alınan numarayı **elastic SIP trunk** ile Retell'e bağlamak ve numarayı Retell'e içe aktarmak (Import Phone Number). Bkz. [Retell custom telephony](https://docs.retellai.com/deploy/custom-telephony).

```
Hasta → PSTN → Türk operatör (Netgsm/Verimor) → SIP trunk → sip:sip.retellai.com → Retell → Recall
```

## Operatör seçenekleri

| Operatör                       | Not                                                     |
| ------------------------------ | ------------------------------------------------------- |
| **Netgsm**                     | Yaygın; sanal santral ve SIP trunk; SMS de aynı hesapta |
| **Verimor**                    | Bulut santral ve SIP; geliştirici dostu API             |
| Diğer yerel VoIP sağlayıcıları | Değerlendirilebilir                                     |

**Seçim kriterleri:** Elastic SIP trunk (origination ve termination URI), TCP veya TLS taşıma, Retell IP aralıklarını izin listesine alabilme, codec G.711, dakika fiyatı, numara tipi (0850, coğrafi 0212/0216/0232…), numara taşıma, caller ID iletimi, BTK uyumu.

> **F2 görevi:** Netgsm ile uçtan uca bağlantı ve en az bir alternatifle karşılaştırma ([IMPLEMENTATION-PLAN.md → F2](../IMPLEMENTATION-PLAN.md#f2-telefon-sip-ve-sms-netgsm-ve-alternatiflerin-testi)).

## Numara stratejileri

| Strateji                          | Nasıl                                                                                                                   | Artı                                         | Eksi                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| **A. Yönlendirme (önerilen MVP)** | Klinik mevcut numarasında operatör üzerinden "meşgulse / cevap yoksa / her zaman" yönlendirmesi kurar → Recall numarası | Klinik numarasını değiştirmez; hızlı kurulum | Yönlendirme ücreti kliniğe yansıyabilir; caller ID'nin korunması operatöre bağlı |
| **B. Yeni numara**                | Recall kliniğe yeni bir numara verir                                                                                    | Tam kontrol                                  | Klinik, numarasını değiştirmek istemez                                           |
| **C. Numara taşıma**              | Kliniğin numarası Recall operatörüne taşınır                                                                            | En temiz çözüm                               | Bürokrasi ve süre; güven gerektirir                                              |

Detay: [CALL-ROUTING.md](CALL-ROUTING.md)

## Retell yapılandırması (F2)

1. **Operatörde:** Origination (gelen) SIP URI = `sip:sip.retellai.com` (TCP önerilir; TLS için `sip:sip.retellai.com;transport=tls`). Retell IP aralıkları izin listesine alınır (güncel liste Retell dokümanında).
2. **Retell'de numara içe aktarma** (API veya panel): `phone_number` (E.164), `termination_uri` (giden aramalar için operatörün adresi), `transport`, gerekiyorsa `sip_trunk_auth_username/password`, `inbound_webhook_url = https://<app>/api/voice/retell/inbound`.
3. **Bizde:** Numara `phone_numbers` tablosuna kliniğe bağlı olarak eklenir (`e164`, `provider = retell`, `carrier = netgsm`). Inbound webhook her aramada numaradan kliniği bulur ve kliniğin ajanını atar; numaraya sabit ajan bağlamak gerekmez.
4. Retell'in **Test SIP Connection** özelliğiyle termination doğrulanır, ardından test aramaları yapılır.

## Caller ID

- Hasta tanıma arayan numaraya dayanır. Yönlendirme senaryosunda operatörün **orijinal arayan numarasını** iletmesi gerekir. POC'ta doğrulanmalı.
- Numara gizli gelirse asistan telefon numarasını sorar (S08).

## Kalite

- Codec: G.711 (A-law, Türkiye standardı).
- Gecikme: Operatör SIP sunucusu ile Retell arasındaki RTT ölçülmeli (F2).
- Yedek: SIP trunk çökerse operatör seviyesinde kliniğin devir numarasına yönlendirme kuralı tanımlanır (fail-open).
