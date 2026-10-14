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

- **XSS:** `eval`, `new Function` yok; React kaçışı. Tek `dangerouslySetInnerHTML` iki adımlı doğrulama kurulumundaki QR görseli: SVG sunucuda kullanıcının kendi TOTP adresinden üretilir, dışarıdan metin içermez (tam denetim, 2026-10-14).
- **SQL enjeksiyonu:** tüm sorgular Drizzle parametreli; uygulama kodunda `sql.raw` kullanılmaz (yalnızca testlerde şema hazırlığı).
- **SSRF:** sunucudan dış çağrılar yalnızca sabit adreslere (Resend, Netgsm, Retell SDK).
- **Yetki:** her panel sayfası ve action `requireClinic`/`requirePermission`/`requirePanelScope` ile; konsolun tüm action'ları (2026-10-14: 11) `requirePlatformAdmin`. Kiracı her zaman sunucuda (oturum, aranan numara, ajan kimliği).
- **CSRF:** Server Action'lar Next'in Origin kontrolüyle; Better Auth `trustedOrigins` tek kaynak.
- **Gizli değerler:** kodda gizli değer yok; uygulamada `process.env` yalnızca `src/lib/env.ts`, `src/instrumentation.ts` ve seed betiğinde; `scripts/` altındaki operasyon betikleri kendi değişkenlerini okur.
- **Log:** hata logları `safeError()` ile; tool ve webhook loglarında yalnızca id ve kod.

## Bağımlılık taraması (`pnpm audit`)

| Paket                                   | Önem     | Nereden                                                     | Değerlendirme                                                                                                                                                                                                                |
| --------------------------------------- | -------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `esbuild` ≤0.24.2 (GHSA-67mh-4wv8-2f99) | Orta     | `drizzle-kit` → `@esbuild-kit/*` (yalnızca migration aracı) | Açık yalnızca esbuild'in geliştirme sunucusunu etkiler; bunu hiç çalıştırmıyoruz. Kabul edildi, drizzle-kit güncellemesi bekleniyor                                                                                          |
| `braces` ≤3.0.3                         | Yüksek   | `eslint-config-next` (yalnızca lint)                        | Production'a girmez; girdisi kendi kodumuz. Kabul edildi                                                                                                                                                                     |
| `uqr` 0.1.3 (yeni, 2026-10-12)          | Açık yok | Doğrudan bağımlılık: iki adımlı giriş kurulumundaki QR kodu | MIT lisanslı, kendi bağımlılığı yok, sürüm sabit (`0.1.3`). Yalnızca sunucuda SVG üretir; ağ, dosya veya `eval` kullanmaz. Girdisi Better Auth'un ürettiği `otpauth://` adresi; çıktı sayfaya SVG olarak konur. Kabul edildi |

CI artık production bağımlılıklarında yüksek veya kritik bir açık görürse kırılır (`pnpm audit --prod --audit-level high`); Dependabot haftalık güncelleme açar.

## Açık kalanlar

- Hassas alanların (döküm, telefon) uygulama seviyesinde şifrelenmesi: değerlendirme hukuki görüşle birlikte (KVKK.md).
- 2FA bu incelemede kapsam dışıydı; sonradan eklendi (Better Auth `twoFactor`, `PANEL_TWO_FACTOR` anahtarıyla; varsayılan kapalı; kurtarma: [TWO-FACTOR-RECOVERY.md](../06-operations/TWO-FACTOR-RECOVERY.md)).
- Retell'in ses işleme bölgesi ve yurt dışı aktarım: hukuki inceleme.
