# Ses ve Dil

## Dil

- MVP: **Türkçe (tr-TR)**.
- Hitap: "siz". Ton: sıcak, profesyonel, kısa.
- V2: İngilizce, Arapça, Almanca (sağlık turizmi). Dil, ilk cümleden algılanıp asistan değiştirilecek.

## STT (konuşmadan metne)

Faz 1'de aşağıdaki sağlayıcılar **aynı test kayıtlarıyla** karşılaştırılacak:

| Aday | Not |
|---|---|
| Deepgram (Nova serisi, `tr`) | Düşük gecikme; Türkçe doğruluk ölçülecek |
| Azure Speech (`tr-TR`) | Özel kelime listesi (phrase list) desteği |
| ElevenLabs Scribe | Türkçe performansı ölçülecek |
| Google Speech | Alternatif |

**Ölçüm kriterleri:**
- Kelime hata oranı (WER): genel konuşmada, **isimlerde** ve **tarih/saat ifadelerinde** ayrı ayrı
- Gecikme (final transcript)
- Telefon kalitesinde (8 kHz) performans
- Gürültülü ortam (sokak, araba)

**Test seti:** 50 kayıt. Farklı yaş, cinsiyet ve aksanlardan (İstanbul, Ege, Doğu, Karadeniz) konuşmalar; isim, tarih ve hizmet adı içeren cümleler.

## TTS (metinden konuşmaya)

| Aday | Not |
|---|---|
| ElevenLabs (Multilingual / Flash) | Doğallık yüksek; Flash daha düşük gecikmeli |
| Azure Neural TTS (`tr-TR-EmelNeural`, `tr-TR-AhmetNeural`) | Kararlı, SSML desteği |
| Cartesia | Düşük gecikme; Türkçe kalitesi ölçülecek |

Her klinik panelden 3–4 hazır ses arasından seçim yapabilir (`settings.assistant.voiceId`).

## Telaffuz ve normalizasyon

### Asistanın söyledikleri (TTS girdisi)
LLM'e verilen kural: saat ve tarihleri **konuşma diliyle yaz**. Ek güvence olarak sunucu, tool sonuçlarında hem makine (`"14:30"`) hem de sözlü (`"saat on dört otuz"`) biçimi döner.

| Yazılı | Söylenmesi gereken |
|---|---|
| 14:30 | "on dört otuz" / "iki buçuk" |
| 05.11.2026 | "5 Kasım Çarşamba" |
| Dt. | "Diş hekimi" |
| Uzm. Dr. | "Uzman doktor" |
| ₺1.500 | "bin beş yüz lira" |

### Asistanın duydukları (STT çıktısı)
- Hizmet eşleştirme `services.aliases` ile yapılır. Örnek: "detertraj", "taş temizliği", "temizlik" → *Diş Taşı Temizliği*.
- Klinik özel terimler STT'nin anahtar kelime listesine (keywords/boost) eklenir: hekim adları, hizmet adları, mahalle ve semt adları.

## Telefon numaraları

- Hastadan alınan numara E.164'e normalize edilir: "0532 123 45 67" → `+905321234567` (`src/lib/phone.ts`).
- Asistan numarayı geri okurken ikili ve üçlü gruplar kullanır: "beş yüz otuz iki, yüz yirmi üç, kırk beş, altmış yedi".
