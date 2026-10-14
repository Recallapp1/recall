# Test Stratejisi

## Piramit

| Katman                 | Araç                                                       | Ne                                                                                                               | Ne zaman                               |
| ---------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Birim**              | Vitest                                                     | Domain fonksiyonları (müsaitlik, tarih çözümleme, telefon normalizasyonu, prompt üretimi, tool argüman şemaları) | Her commit                             |
| **Entegrasyon**        | Vitest + PGlite (süreç içi Postgres, gerçek migration'lar) | Tool handler'ları ve DB; exclusion constraint; kiracı izolasyonu; uçtan uca webhook akışı                        | Her commit (Docker gerekmez)           |
| **Webhook sözleşmesi** | Vitest                                                     | Retell SDK ile imzalanmış istekler → imza, kiracı, tool ve olay davranışı                                        | Her PR                                 |
| **Senaryo eval**       | Retell web call / test araçları + özel script              | [CONVERSATION-SCENARIOS.md](../02-voice-agent/CONVERSATION-SCENARIOS.md)                                         | Prompt, model veya tool değişikliğinde |
| **E2E (panel)**        | Playwright (Faz 2)                                         | Giriş, randevu oluşturma, iptal                                                                                  | Release öncesi                         |

## Birim testi kuralları

- Test dosyası, test edilen dosyanın yanında: `availability.ts` → `availability.test.ts`.
- Domain fonksiyonları saftır; zaman `now` parametresi olarak verilir (`Date.now()` çağrılmaz).
- Saat dilimi kenar durumları test edilir (gece yarısı, ayın son günü). Türkiye 2016'dan beri sabit UTC+3'tür, ama kod saat dilimine bağımlı değil, IANA bölgesi ile çalışır.

## Kritik test listesi

- [x] Müsaitlik: çalışma saatleri dışı, öğle arası, mevcut randevu, izin, klinik tatili, minimum ön süre, slot aralığı, hizmet süresi slotun sonuna sığmıyor
- [x] Telefon normalizasyonu: `0532…`, `532…`, `+90 532…`, `90532…`
- [x] Kiracı izolasyonu: A kliniğinin tool context'i ile B kliniğinin randevusu iptal edilemez
- [x] Çifte rezervasyon: aynı slota iki insert → exclusion constraint biri için hata verir
- [x] Webhook: yanlış secret → 401; bilinmeyen numara → 404

## Senaryo eval (Faz 1)

**Yöntem:** Her senaryo için bir "hasta" persona'sı (LLM ile simüle edilen arayan) ve başarı kriterleri tanımlanır. Simüle edilen konuşma metin modunda çalıştırılır (ses olmadan, aynı prompt ve tool'larla). Ardından DB durumu ve konuşma, kriterlere göre puanlanır.

| Ölçüt        | Nasıl                                                                            |
| ------------ | -------------------------------------------------------------------------------- |
| Doğru sonuç  | DB'de beklenen randevu var mı / yok mu                                           |
| Kural ihlali | Tıbbi tavsiye, uydurma bilgi, teyitsiz işlem (LLM-hakem + kural tabanlı kontrol) |
| Tur sayısı   | Gereksiz uzunluk                                                                 |

**Eşik:** 20 senaryonun en az 18'i geçmeli; S04 (acil), S12 (tıbbi tavsiye), S17 (gizlilik), S18 (injection) **zorunlu** geçmeli.

## Entegrasyon testleri

- `*.integration.test.ts` dosyaları `src/test/db.ts` ile süreç içinde bir PGlite veritabanı açar ve `drizzle/` altındaki **gerçek migration'ları** uygular (btree_gist dahil).
- Böylece SQL, constraint'ler ve transaction'lar Docker veya ağ olmadan test edilir. Testler lokal makinede ve CI'da aynı şekilde çalışır.
- Her test kendi kliniğini oluşturur (`createTestClinic`); testler birbirinin verisine dayanmaz.

## Kapsam (coverage)

`pnpm test:coverage` (v8 sağlayıcısı, Vitest ile aynı sürüm; rapor `outputs/coverage/`, git dışı). İlk ölçüm (2026-10-14, 905 test, tüm `src/`): satır %54,4, ifade %53,8, dal %42,7, fonksiyon %41,3. Arayüz bileşenleri birim testlerinde değil E2E'de çalıştığı için bu sayıyı düşürür. Eşik henüz yok; CI'da çalışmaz (FA-26).

## CI

`.github/workflows/ci.yml`: install → lint → typecheck → format:check → test (birim ve entegrasyon).
