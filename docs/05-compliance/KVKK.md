# KVKK Uyumu

> ⚠️ Bu belge teknik ve operasyonel bir çerçevedir, **hukuki görüş değildir**. Canlıya geçmeden önce KVKK konusunda uzman bir avukatla gözden geçirilmelidir.

## Roller

| Taraf | KVKK rolü |
|---|---|
| Klinik | **Veri sorumlusu**: hasta verisinin işlenme amacını belirler |
| Recall | **Veri işleyen**: kliniğin talimatıyla, onun adına işler |
| Vapi, STT/TTS/LLM sağlayıcıları, Neon, Vercel, Netgsm | **Alt veri işleyenler** |

→ Her klinikle bir **Veri İşleme Sözleşmesi (DPA)** imzalanır. Alt işleyenler listesi sözleşmenin ekidir ve değişiklikler bildirilir.

## İşlenen veriler

| Veri | Kategori | Neden |
|---|---|---|
| Ad soyad, telefon | Kimlik, iletişim | Randevu |
| Randevu (hizmet, hekim, tarih) | **Sağlık verisi** sayılabilir (ör. "kanal tedavisi") | Randevu |
| Ses kaydı, transkript | Kimlik + potansiyel **sağlık verisi** (hasta şikâyetini anlatabilir) | Hizmet kalitesi, ihtilaf çözümü |
| Arama meta verisi (numara, süre) | İletişim | Faturalandırma, izleme |

Sağlık verisi KVKK m.6 kapsamında **özel nitelikli kişisel veri**dir ve daha sıkı kurallara tabidir.

## Hukuki dayanak ve rıza

- Randevu işlemleri için hukuki dayanak ve sağlık verisi işleme şartları (açık rıza gerekip gerekmediği; sağlık hizmeti sunan kişi ve kuruluşlara tanınan istisnalar) **avukatla netleştirilecek**.
- Ses kaydı, randevu için zorunlu değildir. Bu yüzden:
  - Arama başında **kayıt anonsu** yapılır.
  - Klinik ses kaydını tamamen kapatabilir (`settings.assistant.recordCalls=false`).
  - Faz 2 seçeneği: Kayıt sadece transkript olarak tutulur, ses dosyası saklanmaz.

## Aydınlatma yükümlülüğü

1. **Arama başında kısa anons** (firstMessage içinde):
   > "Hizmet kalitesi için görüşmemiz kaydedilmektedir. Kişisel verilerinize ilişkin aydınlatma metnine kliniğimizin web sitesinden ulaşabilirsiniz."
2. **Tam aydınlatma metni** kliniğin web sitesinde yayınlanır. Recall bir şablon sağlar (veri sorumlusu, amaçlar, aktarım, haklar, başvuru yolu).
3. Hasta onay SMS'inde aydınlatma metni linki (Faz 2).

## Yurt dışı aktarım

STT, TTS, LLM ve Vapi sağlayıcıları büyük ihtimalle **yurt dışında** veri işler. KVKK m.9 (2024 değişikliği sonrası) kapsamında yurt dışı aktarım için uygun mekanizmalar (yeterlilik kararı, standart sözleşme, bildirim yükümlülükleri) değerlendirilmelidir.

**Teknik önlemler:**
- Veritabanı ve uygulama **AB bölgesinde** (Neon Frankfurt, Vercel `fra1`).
- Sağlayıcılarda veri saklamayı kapatma ve eğitimde kullanmama seçenekleri açılır (sağlayıcı izin verdiği ölçüde).
- Sağlayıcı seçiminde AB veya Türkiye bölgesi sunanlar tercih edilir.
- Yerli veri barındırma zorunluluğu çıkarsa: mimari, DB'nin Türkiye'deki bir sağlayıcıya taşınmasına izin verir (standart Postgres).

## İlgili kişi hakları (m.11)

| Talep | Uygulama |
|---|---|
| Bilgi talebi | Panelden hasta kaydının dışa aktarımı (JSON/PDF), Faz 2 |
| Düzeltme | Panelden düzenleme |
| Silme / yok etme | Panelde "Anonimleştir": isim ve telefon silinir, transkript ve kayıt silinir, randevu istatistiği anonim kalır |
| İtiraz | Klinik üzerinden; Recall klinik talimatıyla uygular |

Talepler veri sorumlusu olarak **kliniğe** yapılır; Recall kliniğe teknik destek verir.

## VERBİS

Veri sorumlusu olarak kliniğin VERBİS kaydı kendi yükümlülüğüdür. Recall'un veri işleyen olarak durumu avukatla netleştirilecek.

## Veri ihlali

72 saat içinde Kurul'a bildirim yükümlülüğü kliniğe aittir. Recall, ihlali **gecikmeksizin** kliniğe bildirir (DPA maddesi). Prosedür: [SECURITY.md](SECURITY.md#olay-müdahalesi).

## Yapılacaklar

- [ ] Avukat incelemesi: hukuki dayanak, açık rıza, yurt dışı aktarım
- [ ] DPA şablonu
- [ ] Aydınlatma metni şablonu (klinik web sitesi için)
- [ ] Alt işleyenler listesi ve her biri için veri saklama/eğitim ayarları
- [ ] Panelde anonimleştirme ve dışa aktarma
