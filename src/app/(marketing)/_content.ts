import {
  BellRing,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  Clock3,
  Dog,
  FileLock2,
  Headset,
  HeartPulse,
  KeyRound,
  type LucideIcon,
  MessageSquareText,
  Mic,
  PhoneCall,
  PhoneMissed,
  Repeat,
  ServerCog,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Smile,
  Sparkles,
  Stethoscope,
  UserRoundCheck,
  Users,
} from "lucide-react";

/**
 * Landing page copy. Claims stay factual: no customer logos, testimonials or
 * statistics we cannot source (the product is pre-pilot).
 */

export const nav = [
  { href: "#nasil-calisir", label: "Nasıl çalışır" },
  { href: "#ozellikler", label: "Özellikler" },
  { href: "#guvenlik", label: "Güvenlik" },
  { href: "#paketler", label: "Paketler" },
  { href: "#sss", label: "SSS" },
];

export const hero = {
  eyebrow: "Kliniklere özel yapay zekâ asistanı",
  title: "Kliniğinizin yeni nesil sekreteri",
  lead: "Yapay zekâ destekli sesli asistan ile gelen aramaları karşılayın, randevuları yönetin ve ekibinize zaman kazandırın.",
  highlights: ["Doğal Türkçe konuşur", "7/24 aramaları karşılar", "KVKK odaklı altyapı"],
};

export const clinicTypes: { icon: LucideIcon; label: string }[] = [
  { icon: Smile, label: "Diş klinikleri" },
  { icon: Sparkles, label: "Estetik ve güzellik" },
  { icon: HeartPulse, label: "Fizyoterapi" },
  { icon: Stethoscope, label: "Poliklinik ve muayenehane" },
  { icon: Users, label: "Psikolojik danışmanlık" },
  { icon: Dog, label: "Veteriner klinikleri" },
];

export const problems: { icon: LucideIcon; title: string; problem: string; solution: string }[] = [
  {
    icon: PhoneMissed,
    title: "Cevapsız kalan aramalar",
    problem: "Öğle arasında, mesai dışında ve yoğun saatlerde telefonlar açılamıyor.",
    solution: "Asistan her aramayı 7/24, ilk çalışta karşılar.",
  },
  {
    icon: Clock3,
    title: "Telefona bağlı ekip",
    problem: "Sekreter, kapıdaki hasta ile telefon arasında bölünüyor.",
    solution: "Rutin randevu aramaları asistanda; ekip hastaya odaklanır.",
  },
  {
    icon: Repeat,
    title: "Tekrarlayan sorular",
    problem: "Adres, çalışma saatleri ve uygun gün soruları günde onlarca kez soruluyor.",
    solution: "Kliniğinizin bilgileriyle tutarlı ve doğru yanıt verilir.",
  },
];

export const steps = [
  {
    title: "Hasta kliniğinizi arar",
    body: "Mevcut numaranız Recall'a yönlenir. Asistan kliniğinizin adıyla karşılar ve kayıt anonsunu yapar.",
  },
  {
    title: "Asistan dinler ve anlar",
    body: "Hizmeti, hekim tercihini ve uygun günü doğal bir konuşmayla öğrenir.",
  },
  {
    title: "Takviminize bakar",
    body: "Çalışma saatleri, izinler ve dolu randevularla uygun saatleri hesaplar, seçenek sunar.",
  },
  {
    title: "Randevuyu oluşturur",
    body: "Bilgileri geri okuyup onay alır. Randevu panelinize düşer, hastaya SMS onayı gider.",
  },
];

export const features: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: CalendarCheck,
    title: "Gerçek takvimden randevu",
    body: "Hekimlerin çalışma saatleri, izinleri ve mevcut randevular anlık hesaplanır. Çifte rezervasyon veritabanı seviyesinde engellenir.",
  },
  {
    icon: CalendarClock,
    title: "İptal ve erteleme",
    body: "Hasta kendi randevusunu telefonla iptal eder veya başka bir güne taşır; kliniğinizin iptal kuralları uygulanır.",
  },
  {
    icon: Headset,
    title: "Gerektiğinde ekibe aktarır",
    body: "Hasta insanla görüşmek isterse mesai saatlerinde aramayı ekibinize aktarır, değilse geri arama notu bırakır.",
  },
  {
    icon: MessageSquareText,
    title: "SMS onay ve hatırlatma",
    body: "Randevu oluşturulduğunda onay, randevudan önce hatırlatma mesajı gönderilir.",
  },
  {
    icon: ClipboardList,
    title: "Arama özetleri",
    body: "Her aramanın kısa Türkçe özeti ve sonucu panelinizde. Hangi aramanın randevuya dönüştüğünü görürsünüz.",
  },
  {
    icon: Settings2,
    title: "Kliniğinize özel",
    body: "Asistanın adı, sesi, karşılama cümlesi, hizmetleri, sık sorulan sorular ve fiyat politikası tamamen size göre.",
  },
];

export const conversation: { speaker: "patient" | "assistant"; text: string; note?: string }[] = [
  {
    speaker: "assistant",
    text: "Gülüş Diş Kliniği, merhaba! Ben Elif, kliniğin dijital asistanıyım. Size nasıl yardımcı olabilirim?",
  },
  { speaker: "patient", text: "Yarın öğleden sonra diş temizliği için randevu almak istiyorum." },
  {
    speaker: "assistant",
    text: "Yarın saat on dört otuz veya on altıda uygun yerimiz var. Hangisini tercih edersiniz?",
    note: "Gerçek takvimden uygun saatler",
  },
  { speaker: "patient", text: "On dört otuz olsun." },
  {
    speaker: "assistant",
    text: "Teyit ediyorum: yarın saat on dört otuzda diş taşı temizliği. Onaylıyor musunuz?",
    note: "İşlemden önce geri okuma ve onay",
  },
  { speaker: "patient", text: "Evet." },
  {
    speaker: "assistant",
    text: "Randevunuz oluşturuldu, bilgileri SMS ile gönderdim. Başka bir konuda yardımcı olabilir miyim?",
    note: "Randevu panele düştü, SMS gönderildi",
  },
];

export const assistantPrinciples = [
  "Tıbbi tavsiye vermez, muayene randevusu önerir",
  "Acil bir durum anlatılırsa 112'ye yönlendirir",
  "Bilmediği bir şeyi uydurmaz, geri arama notu bırakır",
  "Başka bir hastanın bilgisini paylaşmaz",
];

export const security: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    title: "KVKK odaklı tasarım",
    body: "Aydınlatma anonsu, veri minimizasyonu ve tanımlı saklama süreleri sürecin parçasıdır.",
  },
  {
    icon: ServerCog,
    title: "Avrupa'da barındırma",
    body: "Uygulama ve veritabanı Avrupa Birliği bölgesindeki sunucularda çalışır.",
  },
  {
    icon: FileLock2,
    title: "Şifreli iletişim",
    body: "Tüm bağlantılar şifrelidir; sesli asistandan gelen her istek imzayla doğrulanır.",
  },
  {
    icon: KeyRound,
    title: "Kliniğe özel veri",
    body: "Her kliniğin verisi ayrı tutulur; bir klinik başka bir kliniğin verisine erişemez.",
  },
  {
    icon: UserRoundCheck,
    title: "Rol bazlı erişim",
    body: "Ekibinizden kimin hangi bilgiyi göreceğini siz belirlersiniz.",
  },
  {
    icon: ShieldAlert,
    title: "Güvenli sınırlar",
    body: "Asistan tıbbi tavsiye vermez; acil durumlarda arayanı 112'ye yönlendirir.",
  },
];

export const onboarding: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: PhoneCall,
    title: "Tanışma görüşmesi",
    body: "Hizmetlerinizi, hekimlerinizi, çalışma saatlerinizi ve kurallarınızı birlikte konuşuruz.",
  },
  {
    icon: Settings2,
    title: "Asistanınızı kurarız",
    body: "Kliniğinize özel asistanı ve panelinizi sizin yerinize yapılandırırız.",
  },
  {
    icon: Mic,
    title: "Birlikte test ederiz",
    body: "Canlıya geçmeden önce gerçek senaryolarla deneme aramaları yaparız.",
  },
  {
    icon: BellRing,
    title: "Canlıya geçiş",
    body: "Telefon yönlendirmesini açarız; ilk günlerde aramaları birlikte takip ederiz.",
  },
];

export const plans = [
  {
    name: "Başlangıç",
    audience: "1–2 hekimli klinikler",
    features: [
      "300 dakika / ay",
      "1 telefon hattı",
      "SMS onay ve hatırlatma",
      "3 panel kullanıcısı",
    ],
  },
  {
    name: "Profesyonel",
    audience: "3–6 hekimli klinikler",
    features: [
      "1.000 dakika / ay",
      "1 telefon hattı",
      "SMS onay ve hatırlatma",
      "10 panel kullanıcısı",
      "Haftalık rapor",
    ],
    featured: true,
  },
  {
    name: "Klinik+",
    audience: "7+ hekim ve çoklu şube",
    features: [
      "3.000 dakika / ay",
      "3 telefon hattı",
      "SMS onay ve hatırlatma",
      "Sınırsız panel kullanıcısı",
      "Öncelikli destek",
    ],
  },
];

export const faq = [
  {
    q: "Hastalar bir yapay zekâ ile konuştuğunu anlar mı?",
    a: "Asistan kendini kliniğin dijital asistanı olarak tanıtır. Doğal ve akıcı Türkçe konuşur; hasta isterse ekibinize aktarılır veya geri arama notu bırakılır.",
  },
  {
    q: "Mevcut telefon numaramızı değiştirmemiz gerekir mi?",
    a: "Hayır. Mevcut numaranızda yönlendirme kurulur; isterseniz tüm aramalar, isterseniz yalnızca meşgul, cevapsız veya mesai dışı aramalar asistana gelir.",
  },
  {
    q: "Asistan tıbbi soruları cevaplar mı?",
    a: "Hayır. Teşhis, tedavi veya ilaç önerisi vermez; hastaya muayene randevusu önerir. Acil bir durum anlatılırsa 112'ye yönlendirir.",
  },
  {
    q: "Randevular nerede görünür?",
    a: "Asistanın oluşturduğu her randevu anında Recall panelinize düşer. Panelde takvim, randevu listesi, arama özetleri ve geri aranacaklar listesi bulunur.",
  },
  {
    q: "Kişisel veriler nasıl korunuyor?",
    a: "Altyapı KVKK gözetilerek tasarlandı: aramalarda kayıt anonsu yapılır, uygulama ve veritabanı Avrupa'da barındırılır, kliniklerin verileri birbirinden ayrıdır ve saklama süreleri tanımlıdır.",
  },
  {
    q: "Kurulum ne kadar sürer?",
    a: "Kurulumu sizin yerinize biz yaparız. Tanışma görüşmesinin ardından asistanınızı yapılandırır, birlikte test eder ve hazır olduğunuzda canlıya alırız.",
  },
  {
    q: "Asistanı kendi kliniğimize göre değiştirebilir miyiz?",
    a: "Evet. Asistanın adı, sesi, karşılama cümlesi, hizmetleriniz, sık sorulan sorular ve fiyat bilgisi verip vermeyeceği tamamen size göre ayarlanır.",
  },
];
