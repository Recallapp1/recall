# Güvenlik incelemesi (7 Ekim 2026)

Kapsam: tüm kod tabanı (`src/`, `scripts/`, `drizzle/`), production yapılandırması ve bağımlılıklar. Yöntem: iki bağımsız rapor ([STATUS-REPORT-2026-10-07.md](../STATUS-REPORT-2026-10-07.md), dış inceleme), riskli kalıp taraması, her bulgu için önce başarısız test, sonra düzeltme. Kararlar: [HARDENING-2026-10.md](../HARDENING-2026-10.md).

## Bulgular ve sonuç

| #   | Alan          | Bulgu                                                                                                    | Önem                  | Sonuç                                                                                                     |
| --- | ------------- | -------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Sesli asistan | Söylenen numarayla başkasının randevusunu görme, iptal ve erteleme                                       | Kritik                | Düzeltildi, production'da gerçek aramayla doğrulandı ([ADR-011](../decisions/ADR-011-caller-identity.md)) |
| 2   | Sesli asistan | Rezervasyon denemesiyle bir numaranın o saatte randevusu olduğunu öğrenme                                | Orta                  | Düzeltildi                                                                                                |
| 3   | Kimlik        | Giriş ve parola e-postasında ortak hız sınırı yok (sunucu çağrıları Better Auth sınırlayıcısını atlıyor) | Yüksek                | Düzeltildi (Postgres sınırları)                                                                           |
| 4   | Kimlik        | `?sonra=` açık yönlendirme: `"/\t/evil.com"` tarayıcıda `//evil.com` olur                                | Orta                  | Düzeltildi (`safeNextPath`, testli)                                                                       |
| 5   | Webhook       | Geçerli imzalı isteğin 5 dk içinde tekrar oynatılması                                                    | Orta                  | Düzeltildi (imza bir kez işlenir)                                                                         |
| 6   | Webhook       | Arama başına tool döngüsü sınırı yok                                                                     | Düşük                 | Düzeltildi (60/sa)                                                                                        |
| 7   | Web           | CSP yok                                                                                                  | Orta                  | Eklendi, gerçek aramayla doğrulandı                                                                       |
| 8   | Denetim       | Kritik işlemlerin denetim kaydı yazılamazsa sessizce geçiliyor                                           | Orta                  | Düzeltildi (tekrar + alarm + işlem başarısız)                                                             |
| 9   | Prompt        | Klinik ek talimatları güvenlik kurallarını ezebilir, çağrı değişkeni enjekte edebilir                    | Orta                  | Düzeltildi                                                                                                |
| 10  | Veri          | Eski tablolarda kiracı karışmasını veritabanı engellemiyor                                               | Orta                  | Düzeltildi (bileşik FK, tetikleyici)                                                                      |
| 11  | SMS           | Sesli asistan SMS'leri kilitleri, opt-out'u ve kaydı atlıyor                                             | Orta (bugün zararsız) | Düzeltildi (tek gönderim yolu)                                                                            |
| 12  | KVKK          | Geri arama sebebi için saklama süresi yok                                                                | Düşük                 | 90 gün                                                                                                    |
| 13  | CI            | Testler CI'da hiç çalışmamış                                                                             | Yüksek (süreç)        | Düzeltildi, CI yeşil                                                                                      |

## Kontrol edilen ve sorun bulunmayan alanlar

- **XSS:** `dangerouslySetInnerHTML`, `eval`, `new Function` yok; React kaçışı.
- **SQL enjeksiyonu:** tüm sorgular Drizzle parametreli; `sql.raw` yok.
- **SSRF:** sunucudan dış çağrılar yalnızca sabit adreslere (Resend, Netgsm, Retell SDK).
- **Yetki:** her panel sayfası ve action `requireClinic`/`requirePermission`/`requirePanelScope` ile; konsolun 8 action'ının hepsi `requirePlatformAdmin`. Kiracı her zaman sunucuda (oturum, aranan numara, ajan kimliği).
- **CSRF:** Server Action'lar Next'in Origin kontrolüyle; Better Auth `trustedOrigins` tek kaynak.
- **Gizli değerler:** kodda gizli değer yok; `process.env` yalnızca `src/lib/env.ts` ve seed betiğinde.
- **Log:** hata logları `safeError()` ile; tool ve webhook loglarında yalnızca id ve kod.

## Bağımlılık taraması (`pnpm audit`)

| Paket                                   | Önem   | Nereden                                                     | Değerlendirme                                                                                                                       |
| --------------------------------------- | ------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `esbuild` ≤0.24.2 (GHSA-67mh-4wv8-2f99) | Orta   | `drizzle-kit` → `@esbuild-kit/*` (yalnızca migration aracı) | Açık yalnızca esbuild'in geliştirme sunucusunu etkiler; bunu hiç çalıştırmıyoruz. Kabul edildi, drizzle-kit güncellemesi bekleniyor |
| `braces` ≤3.0.3                         | Yüksek | `eslint-config-next` (yalnızca lint)                        | Production'a girmez; girdisi kendi kodumuz. Kabul edildi                                                                            |

CI artık production bağımlılıklarında yüksek veya kritik bir açık görürse kırılır (`pnpm audit --prod --audit-level high`); Dependabot haftalık güncelleme açar.

## Açık kalanlar

- Hassas alanların (döküm, telefon) uygulama seviyesinde şifrelenmesi: değerlendirme hukuki görüşle birlikte (KVKK.md).
- 2FA kapsam dışı (ürün kararı); konsol yöneticileri için canlıdan önce yeniden değerlendirilmeli.
- Retell'in ses işleme bölgesi ve yurt dışı aktarım: hukuki inceleme.
