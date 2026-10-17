# Klinik kapanışı (offboarding)

Bir klinik Recall'u bıraktığında verisinin dışa aktarılıp silinmesi ([DATA-RETENTION.md](../05-compliance/DATA-RETENTION.md) "Klinik hesabı kapatıldığında": 30 gün içinde). Tam denetim A16.

> **Durum (2026-10-17):** Betik ve domain fonksiyonları hazır; PGlite testleri, geçici bir yerel veritabanı ve **Neon `dev` dalında sentetik bir klinikle** baştan sona denendi (aşağıda prova kaydı). **Yalnızca dev veritabanında çalışır** (`devDatabaseRefusal`): production'da ilk kullanım, prosedür bir prova kliniğiyle denenip Recall sahibi onayladıktan sonra, ayrı bir değişiklikle açılır.

## Adımlar

```bash
pnpm clinic:offboard --clinic <slug> --step export
pnpm clinic:offboard --clinic <slug> --step erase --yes
pnpm clinic:offboard --clinic <slug> --step purge --yes
```

| Adım     | Ne yapar                                                                                                                                                                                                                                                                                        | Geri alınır mı |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `export` | Kliniğin ayarları, hekimleri, hizmetleri, çalışma saatleri, izinleri, hastaları, randevuları, aramaları (kayıt bağlantısı hariç), geri arama notları ve takip planları `outputs/offboard-<slug>-<zaman>.json` dosyasına (git dışı). Ekrana yalnızca sayılar yazılır                             | —              |
| `erase`  | Tek işlemde: klinik `paused`, numaraları pasif; her arama Retell silme kuyruğuna (`clinic_closed`) yazılır; hasta, randevu, arama, geri arama, bildirim, takip ve tool kayıtları silinir; `clinic.data_erased` denetim kaydı (yalnızca sayılar). Geç gelen Retell olayları aramayı geri yazamaz | Hayır          |
| `purge`  | Silme kuyruğu tamamen onaylanmadan **reddeder**. Sonra klinik satırı (bağlı her şey, kendi denetim kaydı ve silme kuyruğu dahil) ve Better Auth organizasyonu silinir; platform düzeyinde kişisel veri içermeyen `clinic.purged` makbuzu kalır                                                  | Hayır          |

## Sıra ve kontroller

1. Kliniğin yazılı kapanış talebi; dışa aktarımın kime ve nasıl teslim edileceği (şifreli arşiv, ayrı kanaldan parola).
2. `export` → dosyayı teslim et, teslimi not et; yerel kopyayı sil.
3. `erase`. Retell silmeleri günlük `retention` işiyle yürür (saatlik `/api/cron/provider-deletions` Vercel Pro'yu bekliyor). Bekleyen silme varken `purge` zaten reddeder; o zaman ertesi gün tekrar dene.
4. `purge`. Çıktıdaki makbuzu (klinik kimliği, slug, onaylanan silme sayısı, zaman) kapanış kaydına ekle.

## Betiğin yapmadıkları (elle)

- **Retell ajanı ve numara:** ajanı Retell panelinden sil, numarayı Retell'den ve operatördeki yönlendirmeden kaldır.
- **Kullanıcı hesapları:** organizasyon silinince üyelikler gider; başka kliniği olmayan kullanıcıları konsoldan kaldır.
- **Yedekler:** Neon'un zaman içinde geri yükleme penceresi dolana kadar silinen veri yedekte kalır ([BACKUP-RESTORE.md](BACKUP-RESTORE.md)); talep eden kliniğe bu süre bildirilir.

## Prova kaydı

### 2026-10-17 · Neon `dev` dalı (Claude)

Yalnızca dev dalında (`devDatabaseRefusal` dev uç noktasını kabul etti); canlıya dokunulmadı, Retell'e çağrı yapılmadı.

- **Hazırlık:** bu prova için sentetik bir klinik `kapanis-provasi`: 2 hasta, 2 arama (Retell'de olmayan sahte arama kimlikleri), 1 geri arama notu, 1 numara. Diğer dev kliniklerinin sayıları önce kaydedildi (`gulus-dis`: 14 hasta, 29 arama, 22 randevu, 2 geri arama notu; `deneme-fizik-tedavi`: boş).
- **İlk deneme başarısız, veri kaybı yok:** dev dalında 19 migration vardı (canlıda 21); `0019` ve `0020` eksikti, `erase` olmayan `calls.latency` kolonunda durdu. İşlem tek transaction olduğu için hiçbir satır silinmedi. İki ekleyici migration dev dalına uygulandı (`pnpm db:migrate`, dev uç noktası); dev artık 21 migration. **Bu, C5'i de bozardı:** dev ajanının arama olayları aynı kolon yüzünden yazılamazdı.
- **İkinci deneme, her adım beklendiği gibi:**

| Adım                           | Sonuç                                                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `erase` (`--yes` olmadan)      | Reddedildi: önce export ve `--yes`                                                                                                                                                 |
| `export`                       | 2 hasta, 2 arama, 1 geri arama notu; dosya `outputs/` altına (git dışı), ekranda yalnızca sayılar. Dosya prova sonunda silindi                                                     |
| `purge`, `erase`'den önce      | Reddedildi: "called before erase"                                                                                                                                                  |
| `erase --yes`                  | 2 hasta, 2 arama, 1 geri arama notu silindi; 2 Retell silmesi kuyruğa                                                                                                              |
| `purge`, silmeler onaylanmadan | Reddedildi: "2 provider deletion(s) not confirmed yet"                                                                                                                             |
| Retell onayı                   | **Elle canlandırıldı:** sahte arama kimlikleri Retell'de olmadığından kuyruk satırları veritabanında "tamamlandı" işaretlendi. Gerçek kullanımda bunu günlük `retention` işi yapar |
| `purge --yes`                  | Klinik silindi; makbuz: klinik kimliği, slug, onaylanan silme sayısı (2), zaman                                                                                                    |
| `export`, `purge`'den sonra    | "Clinic not found"                                                                                                                                                                 |

- **Sonrası:** prova kliniğinin numarası, silme kuyruğu, aramaları ve hastaları sıfır. Platform düzeyinde (`clinic_id` boş) bir `clinic.purged` denetim kaydı; içinde yalnızca `clinicId`, `slug`, `providerDeletionsDone`, `purgedAt`, kişisel veri yok. Diğer dev kliniklerinin sayıları değişmedi.
- **Denenmeyenler:** Retell'de gerçekten var olan bir aramanın silinmesi (günlük işin silme yolu ayrıca testli), bir Better Auth organizasyonu ve üyeleri olan klinik (prova kliniğinin organizasyonu yoktu), canlı veritabanı.
- **Canlıda açmak için kalan:** Recall sahibinin onayı, ardından betiğin canlıda yalnızca açık bir onay bayrağıyla çalışmasını sağlayan ayrı bir değişiklik (testli).
