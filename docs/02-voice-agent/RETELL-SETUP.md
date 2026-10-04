# Retell Kurulumu: Adım Adım

Bu rehber, demo klinik ("Gülüş Diş Kliniği") için Retell'de sesli asistanı oluşturup **tarayıcıdan konuşarak test etmeyi** anlatır. Gerçek telefon numarası bağlama F2'dedir.

> **Önemli: Retell panelinde ajanı elle oluşturmuyorsunuz.** Ajanı, kliniğin veritabanındaki bilgilerden (hizmetler, hekimler, saatler, SSS, ses, kurallar) `pnpm voice:sync` komutu oluşturur. Yüzlerce kliniğin her biri için ayrı ajanı elle kurmak ve güncel tutmak mümkün olmadığından sistem bu şekilde tasarlandı ([ADR-004](../decisions/ADR-004-retell-voice-platform.md)). Retell panelinde ajan üzerinde yapılan elle değişiklikler bir sonraki senkronda **ezilir**.

## Özet

| #   | Adım                                 | Nerede          | Süre  |
| --- | ------------------------------------ | --------------- | ----- |
| 1   | Retell hesabı                        | Tarayıcı        | 2 dk  |
| 2   | API anahtarını `.env.local`'a yazmak | Retell + editör | 2 dk  |
| 3   | Lokal veritabanı                     | Terminal 1      | 1 dk  |
| 4   | Ses seçmek                           | Terminal        | 5 dk  |
| 5   | Tünel açmak                          | Terminal 2      | 2 dk  |
| 6   | Uygulamayı çalıştırmak               | Terminal 3      | 1 dk  |
| 7   | Ajanı oluşturmak (`voice:sync`)      | Terminal        | 1 dk  |
| 8   | Tarayıcıdan test araması             | Retell paneli   | 10 dk |

Komutlar proje klasöründe (`C:\Users\ev\Desktop\RECALL`) çalıştırılır.

---

## 1. Retell hesabı

1. https://dashboard.retellai.com adresinde oturum açın.
2. Test aramaları ücretlidir; hesapta kredi veya ödeme yöntemi olduğundan emin olun (plan ve fiyat Retell panelinde).

## 2. API anahtarı

1. Retell panelinde **API Keys** bölümünü açın (sol menüde veya Settings altında).
2. Anahtarlar arasında **webhook rozeti (webhook badge)** taşıyan anahtarı kullanın. Retell webhook imzalarını bu anahtarla atar; biz de gelen her isteği bununla doğrularız. Rozetli anahtar yoksa yeni anahtar oluştururken webhook için işaretleyin.
3. Proje klasöründeki `.env.local` dosyasını açın ve anahtarı yazın:

   ```
   RETELL_API_KEY=key_xxxxxxxxxxxxxxxx
   ```

> 🔒 Anahtarı sohbete, e-postaya veya koda yazmayın. `.env.local` git'e girmez (`.gitignore`). Anahtar sızarsa Retell panelinden hemen silip yenisini oluşturun.

## 3. Lokal veritabanı

Ayrı bir terminalde veritabanını başlatın ve açık bırakın:

```bash
pnpm db:local
```

İkinci bir terminalde tabloları oluşturup demo kliniği yükleyin:

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

Çıktıda `Seeded "Gülüş Diş Kliniği" … on +902120000000` görmelisiniz.

## 4. Ses seçimi

Retell hesabındaki sesleri listeleyin:

```bash
pnpm voice:voices --provider elevenlabs
```

Her satırda ses kimliği, sağlayıcı, ad ve önizleme bağlantısı vardır. **Türkçe için** ElevenLabs, Cartesia veya OpenAI seslerinden seçin (çok dilli sağlayıcılar). Önizleme bağlantılarını dinleyin; kadın ve erkek birer aday seçmeniz önerilir. Diğer sağlayıcılar için `--provider cartesia` veya `--provider openai`; hepsi için parametresiz çalıştırın.

Seçtiğiniz kimliği `.env.local` dosyasına yazın:

```
RETELL_VOICE_ID=11labs-xxxxxxxx
```

Ses beğenilmezse kimliği değiştirip 7. adımı tekrar çalıştırmanız yeterlidir.

## 5. Tünel

Retell, ajan konuşurken bizim sunucumuzu çağırır (müsaitlik, randevu). Lokal bilgisayarınıza internetten erişilebilmesi için bir tünel gerekir. Cloudflare Tunnel ücretsizdir ve hesap gerektirmez.

Kurulum (bir kez):

```bash
winget install --id Cloudflare.cloudflared
```

Ayrı bir terminalde tüneli açın ve açık bırakın:

```bash
cloudflared tunnel --url http://localhost:3000
```

Çıktıdaki `https://….trycloudflare.com` adresini kopyalayıp `.env.local` dosyasına yazın:

```
APP_URL=https://kelime-kelime-kelime.trycloudflare.com
```

> Hızlı tünel adresi **her açılışta değişir.** Adres değişince `APP_URL`'i güncelleyin, `pnpm dev`'i yeniden başlatın ve 7. adımı tekrarlayın (ajanın çağırdığı adresler güncellenir).

## 6. Uygulamayı çalıştırın

Üçüncü bir terminalde:

```bash
pnpm dev
```

Kontrol: tünel adresinizin sonuna `/api/health` ekleyip tarayıcıda açın. `{"status":"ok","db":"ok",…}` görmelisiniz.

## 7. Ajanı oluşturun

```bash
pnpm voice:sync --clinic gulus-dis
```

Beklenen çıktı:

```
✓ gulus-dis: created · agent agent_xxxxxxxx (v0)
  https://dashboard.retellai.com/agents/agent_xxxxxxxx
```

Bu komut Retell'de **bir LLM ve bir ajan** oluşturur ve bağlantıyı veritabanına (`voice_agents`) kaydeder. Tekrar çalıştırıldığında:

| Durum                                      | Sonuç                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| Klinik bilgisi değişmedi                   | `unchanged`: Retell'e istek gitmez                                       |
| Klinik bilgisi, ses veya `APP_URL` değişti | `updated`: aynı ajan güncellenir (yeni ajan açılmaz)                     |
| Retell panelinde elle değişiklik yapıldı   | `pnpm voice:sync --clinic gulus-dis --force` ile bizim tanıma geri döner |
| Tüm klinikler                              | `pnpm voice:sync --all`                                                  |

### Komutun Retell'de oluşturduğu ayarlar

Bilgi için; bunları elle girmeniz gerekmez. Kaynak: [`agent-spec.ts`](../../src/server/voice/providers/retell/agent-spec.ts).

**Retell LLM**

| Ayar                        | Değer                                                                                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`                     | `RETELL_LLM_MODEL` (varsayılan `claude-5-sonnet`, [ADR-003](../decisions/ADR-003-llm-model.md))                                                                                                                                                   |
| `model_temperature`         | `0` (tutarlı, tahmin edilebilir yanıtlar)                                                                                                                                                                                                         |
| `start_speaker`             | Ajan (ilk konuşan asistan)                                                                                                                                                                                                                        |
| `begin_message`             | "Gülüş Diş Kliniği, merhaba! Ben Elif, … Hizmet kalitesi için görüşmemiz kaydedilmektedir. Size nasıl yardımcı olabilirim?"                                                                                                                       |
| `general_prompt`            | Klinik bilgisi, akışlar, konuşma kuralları ve güvenlik sınırları ([SYSTEM-PROMPT.md](SYSTEM-PROMPT.md))                                                                                                                                           |
| `general_tools`             | 6 custom function (`check_availability`, `find_appointments`, `book_appointment`, `cancel_appointment`, `reschedule_appointment`, `create_callback_request`) → `APP_URL/api/voice/retell/tools`; `end_call`; devir numarası varsa `transfer_call` |
| `default_dynamic_variables` | `transfer_available = hayır`, `clinic_status = active`                                                                                                                                                                                            |

**Retell Agent**

| Ayar                        | Değer                                                          |
| --------------------------- | -------------------------------------------------------------- |
| `agent_name`                | `Recall · Gülüş Diş Kliniği`                                   |
| `language`                  | `tr-TR` (yalnızca Türkçe; çok dilli mod Türkçeyi zayıflatıyor) |
| `voice_id`                  | Kliniğin sesi, yoksa `RETELL_VOICE_ID`                         |
| `timezone`                  | Kliniğin saat dilimi (`Europe/Istanbul`)                       |
| `boosted_keywords`          | Hekim adları, hizmet adları ve eş anlamlılar (STT doğruluğu)   |
| `webhook_url`               | `APP_URL/api/voice/retell/events`                              |
| `webhook_events`            | `call_started`, `call_ended`, `call_analyzed`                  |
| `end_call_after_silence_ms` | 20 sn sessizlikte kapanış                                      |
| `max_call_duration_ms`      | 15 dk                                                          |

## 8. Tarayıcıdan test araması

1. 7. adımdaki bağlantıyı açın (veya Retell panelinde **Agents → "Recall · Gülüş Diş Kliniği"**).
2. Ajan sayfasındaki **Test** (web call) düğmesine basın, mikrofona izin verin ve konuşun.
3. Önerilen ilk senaryo: _"Merhaba, yarın diş taşı temizliği için randevu almak istiyorum."_ Asistan uygun saatleri söyleyecek, adınızı ve (web aramasında arayan numara olmadığı için) telefon numaranızı soracak, bilgileri geri okuyup onay isteyecek.
4. Kontrol:
   - `pnpm dev` terminalinde `{"msg":"tool.completed","tool":"check_availability",…,"ok":true}` satırları
   - Veritabanında randevu: `pnpm db:studio` → `appointments` (kaynak `voice`)
   - SMS: lokalde gönderilmez, `pnpm dev` terminaline `[sms:console]` olarak yazılır
5. Diğer senaryolar: [CONVERSATION-SCENARIOS.md](CONVERSATION-SCENARIOS.md) (iptal, erteleme, bilinmeyen bilgi, acil durum, tıbbi tavsiye talebi).

> Retell panelindeki test aramalarında gelen arama webhook'u çalışmaz. Bu yüzden aktarım kapalı (`transfer_available = hayır`) ve klinik açık (`clinic_status = active`) kabul edilir. Gerçek numarayla yapılan aramalarda bu değerler sunucumuzdan gelir.

---

## Sorun giderme

| Belirti                                                        | Neden ve çözüm                                                                                                                                                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RETELL_API_KEY is not set`                                    | 2. adım. `.env.local` kaydedildi mi?                                                                                                                                                                 |
| `cloudflared` tanınmıyor ("is not recognized")                 | Kurulum, açık olan terminalin PATH'ine yansımaz. Terminali kapatıp yenisini açın veya tam yolu kullanın: `& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000` |
| Herhangi bir komutta `Invalid environment variables … APP_URL` | `APP_URL` boş veya geçersiz. Tünel adresini yazın; tünel yokken geçici olarak `http://localhost:3000` yazabilirsiniz                                                                                 |
| `RETELL_VOICE_ID` `agent_` ile başlıyor                        | Ses kimliği yerine ajan kimliği yazılmış. Ses kimlikleri `11labs-…`, `cartesia-…`, `openai-…` biçimindedir (`pnpm voice:voices`)                                                                     |
| Retell panelinde elle ajan oluşturuldu                         | Gerekmez ve kullanılmaz; silinebilir. Ajanı `pnpm voice:sync` oluşturur                                                                                                                              |
| `No voice configured`                                          | 4. adım: `RETELL_VOICE_ID` boş                                                                                                                                                                       |
| `APP_URL must be a public https URL`                           | 5. adım: `APP_URL` hâlâ `http://localhost:3000`                                                                                                                                                      |
| `voice:sync` Retell hatası (`400 …`)                           | Mesaj Retell'in kendi açıklamasıdır (ör. geçersiz ses kimliği veya model). Düzeltip tekrar çalıştırın; yarım kalan ilerleme korunur, çift ajan oluşmaz                                               |
| Asistan konuşuyor ama "sistemde sorun var" diyor               | Tool çağrısı sunucuya ulaşmadı: tünel kapandı, adres değişti (7. adımı tekrarla) veya `pnpm dev` kapalı                                                                                              |
| `pnpm dev` loglarında `401` / `Invalid signature`              | Kullanılan anahtar webhook rozetli değil veya bilgisayar saati yanlış (5 dk tolerans)                                                                                                                |
| Tool çağrısı `404 CLINIC_NOT_FOUND`                            | Test edilen ajan Retell panelinde elle oluşturulmuş. Sadece `voice:sync` ile oluşturulan ajanı kullanın                                                                                              |
| Türkçe anlamada zorluk                                         | F1.8'de ASR sağlayıcıları karşılaştırılacak; isim ve hizmet adları zaten `boosted_keywords` içinde                                                                                                   |

## Sonraki adımlar

- **F1.8:** Model, ses ve ASR karşılaştırması; 20 senaryo testi; gecikme ölçümü.
- **F2:** Netgsm ile gerçek Türk numarası: numara Retell'e içe aktarılır, inbound webhook `https://<adres>/api/voice/retell/inbound` olarak ayarlanır ([TELEPHONY.md](../03-telephony/TELEPHONY.md)).
- **F5:** Klinik ayarları panelden değiştikçe senkron otomatik çalışır; komut gerekmez.
