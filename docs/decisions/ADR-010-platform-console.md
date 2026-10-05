# ADR-010: Recall yönetim konsolu ve platform rolü

- **Durum:** Kabul edildi
- **Tarih:** 2026-10-05
- **İlgili:** [ADR-009](ADR-009-accounts-and-roles.md), [IMPLEMENTATION-PLAN F6](../IMPLEMENTATION-PLAN.md), [KVKK.md](../05-compliance/KVKK.md)

## Bağlam

Recall ekibinin klinik açması, numara bağlaması, asistanı oluşturması ve klinikleri izlemesi için kod veya veritabanına dokunmadan çalışan bir konsol gerekiyor (F6). Klinik rolleri (owner, admin…) kliniğe aittir; Recall ekibinin yetkisi bunlardan ayrı olmalıdır.

## Karar

1. **Platform rolü Better Auth admin eklentisiyle:** `users.role = "platform_admin"` (varsayılan `"user"`). Klinik rollerinden tamamen ayrıdır; bir klinik sahibi konsolu göremez.
2. **Kimliğe bürünme (impersonation) hiçbir role verilmez.** Admin eklentisinin `impersonate`, `delete`, `set-password`, `set-email` izinleri platform rolünde yoktur (`src/server/auth/platform.ts`). Gerekçe: hasta verisine erişim yalnızca klinik üyeliğiyle ve denetim kaydıyla olur (F7). Destek gerekirse klinik, Recall çalışanını kendi panelinden davet eder.
3. **Konsol hasta verisi göstermez:** klinik listesi, kontrol listesi, ekip hesapları, numaralar, asistan durumu ve arama metrikleri (adet, dakika, maliyet, sonuç dağılımı). Hasta adı, numarası, döküm ve kayıt yoktur.
4. **İlk platform admini yalnızca CLI ile:** `pnpm platform:admin --email … --name …` (yoksa kullanıcı açar, parola e-postası gönderir). Konsoldan platform admini atanamaz.
5. **Klinik oluşturma tek transaction:** organizasyon + klinik + sektör şablonu hizmetleri (diş, estetik, fizyoterapi, boş) + hafta içi 09:00–18:00 + isteğe bağlı numara; ardından klinik sahibine parola e-postası. Kısa ad ve numara çakışmaları reddedilir, yarım klinik kalmaz.
6. **Asistan konsoldan oluşturulur ve senkronize edilir** (`ensureAssistant`; panel yalnızca mevcut ajanı günceller). Numaranın ses platformuna içe aktarılması ve webhook ayarı şimdilik elle yapılır (numara tedariki F2, Netgsm).
7. Konsol işlemleri denetim kaydına `platform.*` eylemleriyle, ilgili kliniğe bağlı yazılır; klinik kendi denetim kaydında "(Recall)" etiketiyle görür.

## Sonuçlar

- ✅ Yeni klinik birkaç dakikada açılır: form → asistanı oluştur → numara bağla → klinik panelden hekim ve tatilleri girer.
- ✅ Konsol erişimi klinik verisine kestirme yol açmaz.
- ⚠️ Numara içe aktarma ve Retell'de inbound webhook ataması elle; F2'de otomatikleşecek.
- ⏳ Klinik başına aylık fatura görünümü ve uyarılar (senkron hatası, uzun süre arama gelmemesi) sonraki adım.
