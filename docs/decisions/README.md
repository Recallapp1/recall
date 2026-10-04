# Mimari Karar Kayıtları (ADR)

Önemli ve geri dönmesi maliyetli teknik kararlar burada kayıt altına alınır.

| #                                          | Karar                                                           | Durum                                                         |
| ------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------- |
| [001](ADR-001-stack.md)                    | Uygulama stack'i: Next.js + Postgres (Neon) + Drizzle + Vercel  | Kabul edildi                                                  |
| [002](ADR-002-voice-platform.md)           | Ses platformu: Vapi (yönetilen) + Türk SIP trunk                | Yerini aldı: 004                                              |
| [003](ADR-003-llm-model.md)                | Sesli asistan LLM'i: Claude, model seçimi gecikme ölçümüne göre | Önerildi (Faz 1'de Retell model listesine göre güncellenecek) |
| [004](ADR-004-retell-voice-platform.md)    | Ses platformu: Retell AI, klinik başına senkronize ajan         | Kabul edildi                                                  |
| [005](ADR-005-design-system.md)            | Tek tasarım kaynağı: DESIGN.md                                  | Kabul edildi                                                  |
| [006](ADR-006-email-provider.md)           | E-posta: Resend (adaptör arkasında, hasta verisi yok)           | Kabul edildi                                                  |
| [007](ADR-007-navy-palette-and-landing.md) | Lacivert + beyaz palet (DESIGN.md v2), yeni tanıtım sayfası     | Kabul edildi                                                  |

## Yeni ADR

1. [TEMPLATE.md](TEMPLATE.md) dosyasını `ADR-00X-kisa-baslik.md` olarak kopyala.
2. Durum `Önerildi` ile başlar; karar verilince `Kabul edildi` olur.
3. Bir ADR geçersiz olursa silinmez; durumu `Yerini aldı: ADR-00Y` olarak güncellenir.
