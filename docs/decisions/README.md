# Mimari Karar Kayıtları (ADR)

Önemli ve geri dönmesi maliyetli teknik kararlar burada kayıt altına alınır.

| # | Karar | Durum |
|---|---|---|
| [001](ADR-001-stack.md) | Uygulama stack'i: Next.js + Postgres (Neon) + Drizzle + Vercel | Kabul edildi |
| [002](ADR-002-voice-platform.md) | Ses platformu: Vapi (yönetilen) + Türk SIP trunk | Kabul edildi |
| [003](ADR-003-llm-model.md) | Sesli asistan LLM'i: Claude, model seçimi gecikme ölçümüne göre | Önerildi |

## Yeni ADR

1. [TEMPLATE.md](TEMPLATE.md) dosyasını `ADR-00X-kisa-baslik.md` olarak kopyala.
2. Durum `Önerildi` ile başlar; karar verilince `Kabul edildi` olur.
3. Bir ADR geçersiz olursa silinmez; durumu `Yerini aldı: ADR-00Y` olarak güncellenir.
