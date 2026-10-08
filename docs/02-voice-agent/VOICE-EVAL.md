# Sesli asistan değerlendirmesi

Tekrarlanabilir ses değerlendirmesi: [scripts/voice-eval/](../../scripts/voice-eval/) (senaryolar `scenarios.ts`, çalıştırıcı `run.ts`).

## Nasıl çalışır

- Her senaryo **gerçek bir Retell web aramasıdır**: dev kliniğinin (`gulus-dis`) asistanı, tünel üzerinden lokal uygulama ve Neon **`dev`** dalı. Production'a dokunmaz; çalıştırıcı production uç noktasını veya `recalltr.company` adresini görünce durur.
- Arayan, senaryodaki satırları Windows Türkçe TTS ile seslendirir (`tts.ps1`); ses Playwright Chromium'a mikrofon olarak verilir. Satırlar sabit aralıklarla söylenir, bu yüzden her satır bir turda verilebilecek bilgiyi tam içerir.
- Tarihler çalıştırma anına göre doldurulur: `{tomorrow}`, `{nextMon}` … `{nextSun}` (ör. "on dört Ekim Çarşamba"). Belirsizlik senaryoları ("haftaya Salı") bilerek belirsiz kalır.
- Kontroller: tool çağrıları ve sonuçları (Retell kaydı), asistanın söyledikleri, dev veritabanında oluşan randevular ve iki tohum randevunun durumu.
- Her çalıştırma önce kendi test hastalarını (`0532 900 00 xx`) siler, doğrulama sınırlarını sıfırlar ve iki randevu tohumlar.
- Gecikme Retell'in arama kaydından alınır (`latency.e2e`, `llm`, `asr`, `tts`; ms).
- Web aramasında arayan numara yoktur: tüm senaryolar "gizli numara" durumudur. Arayan numara kuralları entegrasyon testleriyle korunur (`handlers.integration.test.ts`). Webhook tekrarı ve tool döngüsü de entegrasyon testlerindedir.

## Çalıştırma

```bash
pnpm dev
```

```bash
pnpm dev:tunnel
```

```bash
pnpm voice:eval
```

Tek senaryo: `pnpm voice:eval --only book-clear,emergency`. Ham sonuçlar `.voice-eval/results-*.json` (git dışı). Maliyet arama başına yaklaşık 0,15–0,35 $ (Retell).

## Senaryolar (24)

| Kategori                  | Senaryolar                                                                |
| ------------------------- | ------------------------------------------------------------------------- |
| Randevu                   | net istek, belirtilen saat, tekrar onay, iki hizmet, eksik haneli telefon |
| Yanlış duyulan / belirsiz | "çekim" + beyazlatma, belirsiz şikâyet                                    |
| Tarih                     | "haftaya Salı", kapalı gün (Pazar), geçmiş gün                            |
| Kimlik (gizli numara)     | yalnızca numarayı bilen saldırgan, yanlış ad ile erteleme                 |
| Değişiklik                | doğrulanmış iptal, doğrulanmış erteleme                                   |
| Güvenlik                  | acil belirti (112), ilaç sorusu, insanla görüşme isteği                   |
| Prompt enjeksiyonu        | talimatları okutma, yönetici taklidi, kontrolsüz randevu dayatma          |
| Bilgi                     | Cumartesi saatleri, sunulmayan hizmet                                     |
| Dayanıklılık              | Bey/Hanım hitabı, sessiz/yanlış arama                                     |
