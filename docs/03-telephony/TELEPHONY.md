# Telefon Altyapısı

## Sorun

Vapi'nin ücretsiz ve hazır numaraları ABD ile sınırlıdır. Türkiye'deki klinikler için **Türk numarası** gerekir. Çözüm: Türk operatöründen alınan numarayı **SIP trunk** ile Vapi'ye bağlamak (BYO SIP Trunk).

```
Hasta → PSTN → Türk operatör (Netgsm/Verimor) → SIP trunk → Vapi → Recall
```

## Operatör seçenekleri

| Operatör                       | Not                                                     |
| ------------------------------ | ------------------------------------------------------- |
| **Netgsm**                     | Yaygın; sanal santral ve SIP trunk; SMS de aynı hesapta |
| **Verimor**                    | Bulut santral ve SIP; geliştirici dostu API             |
| Diğer yerel VoIP sağlayıcıları | Değerlendirilebilir                                     |

**Seçim kriterleri:** SIP trunk desteği (Vapi ile uyumlu SIP INVITE, codec G.711), sabit IP veya kimlik doğrulama, dakika fiyatı, numara tipi (0850, coğrafi 0212/0216/0232…), numara taşıma desteği, BTK uyumu.

> **Faz 1 görevi:** En az bir operatörle Vapi BYO SIP bağlantısının uçtan uca POC'u.

## Numara stratejileri

| Strateji                          | Nasıl                                                                                                                   | Artı                                         | Eksi                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| **A. Yönlendirme (önerilen MVP)** | Klinik mevcut numarasında operatör üzerinden "meşgulse / cevap yoksa / her zaman" yönlendirmesi kurar → Recall numarası | Klinik numarasını değiştirmez; hızlı kurulum | Yönlendirme ücreti kliniğe yansıyabilir; caller ID'nin korunması operatöre bağlı |
| **B. Yeni numara**                | Recall kliniğe yeni bir numara verir                                                                                    | Tam kontrol                                  | Klinik, numarasını değiştirmek istemez                                           |
| **C. Numara taşıma**              | Kliniğin numarası Recall operatörüne taşınır                                                                            | En temiz çözüm                               | Bürokrasi ve süre; güven gerektirir                                              |

Detay: [CALL-ROUTING.md](CALL-ROUTING.md)

## Vapi yapılandırması

1. Vapi'de **SIP Trunk credential** oluşturulur (operatörün SIP sunucusu, kimlik bilgileri, IP izin listesi).
2. Numara Vapi'ye **BYO phone number** olarak eklenir ve credential'a bağlanır.
3. Numaranın `assistantId` alanı **boş** bırakılır, **Server URL** = `https://<app>/api/voice/vapi`. Böylece her aramada `assistant-request` gelir ve kliniğe özel asistan dinamik üretilir.
4. Aynı numara `clinics.phone_number` alanına E.164 olarak girilir.

## Caller ID

- Hasta tanıma arayan numaraya dayanır. Yönlendirme senaryosunda operatörün **orijinal arayan numarasını** iletmesi gerekir. POC'ta doğrulanmalı.
- Numara gizli gelirse asistan telefon numarasını sorar (S08).

## Kalite

- Codec: G.711 (A-law, Türkiye standardı).
- Gecikme: Operatör SIP sunucusu ile Vapi arasındaki RTT ölçülmeli. Vapi'nin bölge seçeneği varsa AB bölgesi tercih edilir.
- Yedek: SIP trunk çökerse operatör seviyesinde kliniğin devir numarasına yönlendirme kuralı tanımlanır (fail-open).
