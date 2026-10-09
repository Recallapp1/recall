# Görüşme başı anons metni

> **DRAFT, not reviewed by a lawyer.** TASLAK — avukat incelemesinden geçmedi. Asistanın aramanın başında söylediği metin. Bugünkü üründe karşılama, "Hizmet kalitesi için görüşmemiz kaydedilmektedir." cümlesini kayıt açıkken ekler ([src/server/voice/prompt.ts](../../src/server/voice/prompt.ts) `buildFirstMessage`). **Bu taslaklar canlı asistana uygulanmadı.**

## Kısa sürüm (önerilen; 8–10 saniye)

> "[Klinik adı], merhaba! Ben [asistan adı], kliniğin yapay zekâ asistanıyım. Görüşmemiz hizmet kalitesi için kaydedilmektedir; kişisel verilerinizle ilgili bilgi kliniğimizin web sitesinde yer alıyor. Size nasıl yardımcı olabilirim?"

## Kayıt kapalıysa

> "[Klinik adı], merhaba! Ben [asistan adı], kliniğin yapay zekâ asistanıyım. Kişisel verilerinizle ilgili bilgi kliniğimizin web sitesinde yer alıyor. Size nasıl yardımcı olabilirim?"

## Arayan kayda itiraz ederse (güçlendirilmiş prompt, kapalı)

> "Anlıyorum. Görüşme kaydı hizmet kalitesi için yapılıyor. İsterseniz klinik ekibimiz sizi kayıtsız bir hattan geri arasın; bunun için yalnızca adınızı ve numaranızı alayım."

## Avukata açık sorular

1. "Yapay zekâ asistanı" ifadesi yeterli mi, yoksa daha açık bir ifade mi gerekir?
2. Kısa anons + web sitesindeki tam metin aydınlatma yükümlülüğünü karşılar mı?
3. Açık rıza gerekiyorsa, sesli onay nasıl alınmalı ve ispatlanmalı?
4. Kayda itiraz eden arayana hizmet vermeye devam etmek (kaydı durdurmak) gerekir mi; teknik olarak kayıt yalnızca görüşmenin tamamı için açılıp kapatılabiliyor.
