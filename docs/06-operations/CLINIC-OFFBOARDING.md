# Klinik kapanışı (offboarding)

Bir klinik Recall'u bıraktığında verisinin dışa aktarılıp silinmesi ([DATA-RETENTION.md](../05-compliance/DATA-RETENTION.md) "Klinik hesabı kapatıldığında": 30 gün içinde). Tam denetim A16.

> **Durum (2026-10-14):** Betik ve domain fonksiyonları hazır, PGlite testleri ve geçici bir yerel veritabanında baştan sona denendi. **Yalnızca dev veritabanında çalışır** (`devDatabaseRefusal`): production'da ilk kullanım, prosedür bir prova kliniğiyle denenip Recall sahibi onayladıktan sonra, ayrı bir değişiklikle açılır.

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
