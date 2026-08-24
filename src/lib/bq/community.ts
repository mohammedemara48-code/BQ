import type { Intent, Role } from "./types";

export type CommunitySeed = {
  id: string;
  name: string;
  bio: string;
  pronouns: string;
  city: string;
  lookingFor: string;
  interests: string[];
  photoUrl: string;
  online: boolean;
  role: Role;
  intent: Intent;
  latitude: number;
  longitude: number;
  hasPrivatePhotos: boolean;
  replies: string[];
};

export const COMMUNITY: CommunitySeed[] = [
  {
    id: "bq-noura",
    name: "نورة",
    bio: "بصوّر الليل والسهر في القاهرة. بحب القهوة السادة والأغاني الهادية.",
    pronouns: "هي / her",
    city: "القاهرة",
    lookingFor: "مواعدة",
    interests: ["تصوير", "موسيقى", "مشي ليلي"],
    photoUrl: "/people/noura.jpg",
    online: true,
    role: "تبادل",
    intent: "مواعدة",
    latitude: 30.0444,
    longitude: 31.2357,
    hasPrivatePhotos: true,
    replies: [
      "إيه الأخبار؟ نورت الشات.",
      "شكل يومك كان تقيل، صح؟",
      "لو في معرض الأسبوع ده تعالى نروح.",
      "ضحكتني دلوقتي.",
      "تمام، كلّمني وأنت فاضي.",
    ],
  },
  {
    id: "bq-karim",
    name: "كريم",
    bio: "DJ في إسكندرية. بحب البحر أول الصبح والبيت قبل الزحمة.",
    pronouns: "هو / him",
    city: "الإسكندرية",
    lookingFor: "دردشة",
    interests: ["دي جي", "بحر", "طبخ"],
    photoUrl: "/people/karim.jpg",
    online: true,
    role: "موجب",
    intent: "دردشة",
    latitude: 31.2001,
    longitude: 29.9187,
    hasPrivatePhotos: false,
    replies: [
      "عامل إيه يا نجم.",
      "لو نازل الإسكندرية قولي.",
      "عندي سيشن الخميس لو حابب تسمع.",
      "مزاجك إيه النهاردة؟",
      "حاضر، هرد عليك بعد الشغل.",
    ],
  },
  {
    id: "bq-lina",
    name: "لينا",
    bio: "مصممة. بهتم بالتفاصيل الصغيرة وبجمع كتب قديمة.",
    pronouns: "هي / her",
    city: "الجيزة",
    lookingFor: "مواعدة",
    interests: ["تصميم", "كتب", "مقاهي"],
    photoUrl: "/people/lina.jpg",
    online: false,
    role: "سالب",
    intent: "مواعدة",
    latitude: 30.0131,
    longitude: 31.2089,
    hasPrivatePhotos: true,
    replies: [
      "صباح هادي عليك.",
      "بعتّلك صورة من مشروعي لو حابب تشوف.",
      "عندك وقت نتكلم بليل؟",
      "حسيت إن كلامك دافي.",
      "هرد أول ما أخلّص الشغل.",
    ],
  },
  {
    id: "bq-samer",
    name: "سامر",
    bio: "شيف. باكل التجربة قبل الوصفة، وبحب الناس اللي بتحكي وهي بتاكل.",
    pronouns: "هو / him",
    city: "القاهرة",
    lookingFor: "مقابلة",
    interests: ["طبخ", "سينما", "سوق"],
    photoUrl: "/people/samer.jpg",
    online: true,
    role: "تبادل",
    intent: "مقابلة",
    latitude: 30.0626,
    longitude: 31.2497,
    hasPrivatePhotos: false,
    replies: [
      "تعال نجرب مطعم جديد الأسبوع ده.",
      "أنا داخل المطبخ دلوقتي، هكلمك بعدين.",
      "ضحكة رسالتك وصلت.",
      "لو جعان قولي أجهز حاجة.",
      "تمام يا صاحبي.",
    ],
  },
  {
    id: "bq-yasmin",
    name: "ياسمين",
    bio: "بكتب قصص قصيرة وبلبس اللي يريّحني. مش بدوّر على تمثيل.",
    pronouns: "هم / they",
    city: "المنصورة",
    lookingFor: "دردشة",
    interests: ["كتابة", "أزياء", "قطط"],
    photoUrl: "/people/yasmin.jpg",
    online: true,
    role: "تبادل",
    intent: "دردشة",
    latitude: 31.0409,
    longitude: 31.3785,
    hasPrivatePhotos: true,
    replies: [
      "قلت حاجة لمستني.",
      "لو عايز نكمل الكلام بجد، أنا هنا.",
      "هبعتلك مقطع من حاجة بكتبها.",
      "نهاري كان غريب، وأنت؟",
      "خد وقتك، مفيش استعجال.",
    ],
  },
  {
    id: "bq-adam",
    name: "آدم",
    bio: "مهندس معماري. برسم مدن على الورق وأدور على سكينة جواها.",
    pronouns: "هو / him",
    city: "القاهرة الجديدة",
    lookingFor: "مواعدة",
    interests: ["عمارة", "سكيتش", "شاي"],
    photoUrl: "/people/adam.jpg",
    online: false,
    role: "موجب",
    intent: "مواعدة",
    latitude: 30.0074,
    longitude: 31.4913,
    hasPrivatePhotos: false,
    replies: [
      "فكرة حلوة، رسمتها في بالي.",
      "لو نخرج نمشي في التجمع قولي.",
      "بشتغل على بلان، هرد كمان شوية.",
      "رسالتك رتّبت يومي.",
      "موافق.",
    ],
  },
  {
    id: "bq-hala",
    name: "هالة",
    bio: "بدّرب حركة وهدوء. المكان الآمن أهم من الكلام الكبير.",
    pronouns: "هي / her",
    city: "المعادي",
    lookingFor: "مقابلة",
    interests: ["يوجا", "حدائق", "شموع"],
    photoUrl: "/people/hala.jpg",
    online: true,
    role: "سالب",
    intent: "مقابلة",
    latitude: 29.9602,
    longitude: 31.2569,
    hasPrivatePhotos: true,
    replies: [
      "خد نفس. أنا سامعاك.",
      "لو حابب نتمشى الصبح أنا فاضية الجمعة.",
      "كلامك محترم، وده نادر.",
      "هرد بعد الجلسة.",
      "اتفضّل، أكمل.",
    ],
  },
  {
    id: "bq-ziad",
    name: "زياد",
    bio: "بلعب كورة وبشتغل فريلانس. بخفّف الدنيا من غير ما أستهتر.",
    pronouns: "هو / him",
    city: "٦ أكتوبر",
    lookingFor: "دردشة",
    interests: ["كورة", "جيم", "سفر قصير"],
    photoUrl: "/people/ziad.jpg",
    online: false,
    role: "موجب",
    intent: "دردشة",
    latitude: 29.9285,
    longitude: 30.9188,
    hasPrivatePhotos: false,
    replies: [
      "يا عم تمام، إيه الخطّة؟",
      "لو في ماتش ننزل نشوفه.",
      "ضحكت من رسالتك.",
      "هكلمك بعد التمرين.",
      "ماشي، عدّي عليا.",
    ],
  },
];

export function communityById(id: string): CommunitySeed | undefined {
  return COMMUNITY.find((p) => p.id === id);
}

export function isCommunityId(id: string): boolean {
  return id.startsWith("bq-");
}
