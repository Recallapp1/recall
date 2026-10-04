const steps = [
  {
    title: "Hasta arar",
    body: "Kliniğinizin numarası Recall'a yönlenir. Asistan, kliniğinizin adıyla ve sizin belirlediğiniz tonla karşılar.",
  },
  {
    title: "Asistan randevuyu alır",
    body: "Gerçek takviminize bakar, uygun saatleri önerir, bilgileri teyit eder ve randevuyu oluşturur.",
  },
  {
    title: "Panelinize düşer",
    body: "Randevu anında panelinizde görünür, hastaya SMS onayı gider. Arama özeti ve kaydı da orada.",
  },
];

const features = [
  "7/24 cevap: öğle arası, mesai dışı ve yoğun saatlerde kaçan arama yok",
  "Randevu oluşturma, iptal ve erteleme",
  "Çifte rezervasyona karşı veritabanı seviyesinde koruma",
  "Gerektiğinde ekibinize aktarma veya geri arama notu",
  "Tıbbi tavsiye vermez; acil durumda 112'ye yönlendirir",
  "KVKK odaklı: AB bölgesinde veri, kayıt anonsu, saklama politikası",
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-24 px-6 py-20 sm:py-28">
      <section className="flex flex-col gap-6">
        <span className="border-border bg-muted text-muted-foreground w-fit rounded-full border px-3 py-1 text-xs font-medium">
          Diş, sağlık ve güzellik klinikleri için
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Telefonlarınızı açan, randevu alan{" "}
          <span className="text-primary">Türkçe sesli asistan</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg text-pretty">
          Recall kliniğinize gelen aramaları karşılar, takviminize bakarak randevu oluşturur ve
          panelinize işler. Sekreteriniz telefon yerine kapıdaki hastaya odaklanır.
        </p>
      </section>

      <section aria-labelledby="how" className="flex flex-col gap-8">
        <h2 id="how" className="text-lg font-medium">
          Nasıl çalışır?
        </h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="border-border flex flex-col gap-3 rounded-xl border p-6"
            >
              <span className="text-primary font-mono text-sm">0{index + 1}</span>
              <h3 className="font-medium">{step.title}</h3>
              <p className="text-muted-foreground text-sm">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="features" className="flex flex-col gap-8">
        <h2 id="features" className="text-lg font-medium">
          Neler yapar?
        </h2>
        <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {features.map((feature) => (
            <li key={feature} className="flex gap-3 text-sm">
              <span aria-hidden className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
              {feature}
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-border text-muted-foreground border-t pt-8 text-sm">
        Recall · Pilot programı yakında
      </footer>
    </main>
  );
}
