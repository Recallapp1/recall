# PRD: Recall

| | |
|---|---|
| Durum | Taslak v0.1 |
| Sahip | Ürün |
| Son güncelleme | 2026-10-04 |

## 1. Problem

Türkiye'deki diş, sağlık ve güzellik klinikleri randevularının büyük kısmını telefonla alır. Bu süreç:

- **Kaçan aramalar:** Sekreter meşgulken, öğle arasında ve mesai dışında gelen aramalar cevapsız kalır. Cevapsız her arama, büyük ihtimalle rakibe giden bir hastadır.
- **Pahalı ve tekrarlayıcı iş:** Sekreter zamanının önemli bir bölümünü "Yarın öğleden sonra boş var mı?" gibi tekrarlayan sorulara harcar.
- **Dağınık kayıt:** Randevular deftere, Excel'e veya birbirinden kopuk yazılımlara girilir. Çifte rezervasyon ve unutulan randevular yaşanır.
- **Gelmeyen hastalar (no-show):** Hatırlatma sistemli yapılmadığı için boş kalan koltuk saatleri oluşur.

## 2. Çözüm

Recall, kliniğin telefon numarasına bağlanan, **kliniğe özel yapılandırılmış Türkçe bir sesli asistandır**:

1. Hasta kliniği arar; arama Recall'a yönlenir.
2. Asistan kliniğin adıyla karşılar, ihtiyacı anlar (yeni randevu, iptal, erteleme, bilgi).
3. Kliniğin gerçek takvimine bakarak uygun saatleri önerir ve randevuyu oluşturur.
4. Hastaya SMS onayı gönderilir; randevu anında kliniğin paneline düşer.
5. Asistanın çözemediği durumlar insana devredilir veya geri arama notu bırakılır.

## 3. Hedef kitle

- **Birincil:** 1–10 hekimli bağımsız diş klinikleri (yüksek telefon trafiği, net randevu süreleri).
- **İkincil:** Estetik/güzellik klinikleri, fizyoterapi, psikolojik danışmanlık, veteriner klinikleri.
- **Kapsam dışı (şimdilik):** Hastaneler ve büyük zincirler (HBYS entegrasyonu gerektirir).

Detay: [USER-PERSONAS.md](USER-PERSONAS.md)

## 4. MVP kapsamı

### Dahil
- Kliniğe özel sesli asistan: karşılama, hizmet ve hekim bilgisi, çalışma saatleri.
- Randevu **oluşturma, iptal ve erteleme** (telefon numarası ile hasta tanıma).
- Gerçek zamanlı müsaitlik hesabı (hekim çalışma saatleri, izinler, mevcut randevular, hizmet süresi).
- İnsana devretme (mesai içinde) ve geri arama notu (mesai dışında).
- Klinik paneli: takvim, randevu listesi, arama kayıtları (özet ve transkript), klinik ayarları.
- SMS ile randevu onayı ve randevudan 24 saat önce hatırlatma.
- KVKK: arama başında aydınlatma anonsu, veri saklama politikası.

### Hariç (V1+)
- Dış takvim/klinik yazılımı entegrasyonları (Google Calendar, Dentsoft vb.).
- Giden arama (hatırlatma için asistanın araması).
- Çoklu dil (İngilizce, Arapça; sağlık turizmi için).
- Ödeme ve kapora alma.
- WhatsApp kanalı.

## 5. Başarı metrikleri

| Metrik | MVP hedefi |
|---|---|
| Asistanın insana devretmeden tamamladığı arama oranı | ≥ %70 |
| Randevu talebi olan aramalarda randevu oluşturma oranı | ≥ %80 |
| Yanıt gecikmesi (hasta konuşmayı bitirdikten sonra ilk ses) | p50 < 1,0 sn, p95 < 1,8 sn |
| Yanlış randevu (yanlış saat/hekim/hizmet) | < %1 |
| Kaçan arama | ~%0 (7/24 cevap) |
| Klinik memnuniyeti (NPS) | ≥ 40 |

## 6. Kısıtlar ve riskler

| Risk | Etki | Önlem |
|---|---|---|
| Türkçe STT, isim ve tıbbi terimlerde hata yapar | Yanlış kayıt | Telaffuz sözlüğü, kritik bilgiyi geri okuyarak teyit, SMS onayı. Bkz. [VOICE-AND-LANGUAGE.md](../02-voice-agent/VOICE-AND-LANGUAGE.md) |
| Gecikme doğallığı bozar | Hasta kapatır | Düşük gecikmeli model ve sağlayıcı seçimi, bölge yakınlığı. Bkz. [AGENT-DESIGN.md](../02-voice-agent/AGENT-DESIGN.md) |
| Asistanın tıbbi tavsiye vermesi | Hukuki ve sağlık riski | Katı kapsam, acil durumda 112 yönlendirmesi. Bkz. [ESCALATION.md](../02-voice-agent/ESCALATION.md) |
| KVKK: sağlık verisi özel nitelikli kişisel veridir | Ceza, itibar | Aydınlatma, açık rıza, veri minimizasyonu, AB bölgesi. Bkz. [KVKK.md](../05-compliance/KVKK.md) |
| Türk numaralarının SIP ile bağlanması | Lansman gecikmesi | Erken operatör seçimi ve POC. Bkz. [TELEPHONY.md](../03-telephony/TELEPHONY.md) |
| Dakika başı maliyet | Kâr marjı | Maliyet modeli ve izleme. Bkz. [COST-MODEL.md](../06-operations/COST-MODEL.md) |

## 7. Açık sorular

- [ ] Hangi Türk operatörü (Netgsm, Verimor, diğer) SIP trunk sağlayacak? POC gerekli.
- [ ] Ses kaydı varsayılan olarak açık mı olacak, kliniğin seçimine mi bırakılacak?
- [ ] Fiyat bilgisi asistan tarafından söylenebilir mi? (Klinik bazlı ayar olarak planlandı.)
- [ ] Hasta kimliği için sadece telefon numarası yeterli mi, doğum yılı teyidi istenecek mi?
