# Ses ve Dil

## Dil

- MVP: **Türkçe (tr-TR)**.
- Hitap: "siz". Ton: sıcak, profesyonel, kısa.
- V2: İngilizce, Arapça, Almanca (sağlık turizmi). Dil, ilk cümleden algılanıp asistan değiştirilecek.

## STT (konuşmadan metne)

STT'yi Retell çalıştırır. Ajan dili **yalnızca `tr-TR`** olarak ayarlanır: Retell topluluğunun gözlemine göre çok dilli mod Türkçe tanımayı zayıflatıyor. Retell'de Türkçe destekleyen ASR sağlayıcıları (2026-10): **Deepgram, Azure, Soniox, AssemblyAI**. F1.8'de **aynı test kayıtlarıyla** karşılaştırılacaklar.

Klinik adları, hekim adları, hizmet adları ve eş anlamlılar senkron sırasında ajanın `boosted_keywords` alanına otomatik eklenir.

**Ölçüm kriterleri:**

- Kelime hata oranı (WER): genel konuşmada, **isimlerde** ve **tarih/saat ifadelerinde** ayrı ayrı
- Gecikme (final transcript)
- Telefon kalitesinde (8 kHz) performans
- Gürültülü ortam (sokak, araba)

**Test seti:** 50 kayıt. Farklı yaş, cinsiyet ve aksanlardan (İstanbul, Ege, Doğu, Karadeniz) konuşmalar; isim, tarih ve hizmet adı içeren cümleler.

## TTS (metinden konuşmaya)

Retell'de Türkçe destekleyen TTS sağlayıcıları (2026-10): **ElevenLabs, Cartesia, OpenAI, MiniMax, Fish Audio** ve Retell'in kendi sesleri. Sesler `pnpm voice:voices` ile listelenir; önizleme bağlantısından dinlenerek seçilir.

- **Varsayılan ses:** `RETELL_VOICE_ID` (tüm klinikler)
- **Kliniğe özel ses:** `settings.assistant.voiceId` (panelden, F5). Varsayılanın önüne geçer.
- F1.8'de 3–4 aday ses Türkçe doğallık, isim ve sayı telaffuzu, gecikme açısından karşılaştırılır; panelde sunulacak hazır sesler bu listeden seçilir.

## Telaffuz ve normalizasyon

### Asistanın söyledikleri (TTS girdisi)

LLM'e verilen kural: saat ve tarihleri **konuşma diliyle yaz**. Ek güvence olarak sunucu, tool sonuçlarında hem makine (`"14:30"`) hem de sözlü (`"saat on dört otuz"`) biçimi döner.

| Yazılı     | Söylenmesi gereken           |
| ---------- | ---------------------------- |
| 14:30      | "on dört otuz" / "iki buçuk" |
| 05.11.2026 | "5 Kasım Çarşamba"           |
| Dt.        | "Diş hekimi"                 |
| Uzm. Dr.   | "Uzman doktor"               |
| ₺1.500     | "bin beş yüz lira"           |

### Asistanın duydukları (STT çıktısı)

- Hizmet eşleştirme `services.aliases` ile yapılır. Örnek: "detertraj", "taş temizliği", "temizlik" → _Diş Taşı Temizliği_.
- Klinik özel terimler STT'nin anahtar kelime listesine (keywords/boost) eklenir: hekim adları, hizmet adları, mahalle ve semt adları.

## Telefon numaraları

- Hastadan alınan numara E.164'e normalize edilir: "0532 123 45 67" → `+905321234567` (`src/lib/phone.ts`).
- Asistan numarayı geri okurken ikili ve üçlü gruplar kullanır: "beş yüz otuz iki, yüz yirmi üç, kırk beş, altmış yedi".
