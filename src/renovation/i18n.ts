/**
 * Client-facing wording for the start page and the renovation wizard, in
 * English and Arabic (owner decision Q4: both, right-to-left for Arabic).
 *
 * The Arabic is Modern Standard Arabic written for a Gulf homeowner. It has
 * not been reviewed by a native-speaking copywriter yet (ASSUMPTIONS 15.4).
 */

import type { BudgetTier, BuildingAge, FloorLike, Lang, Mood, MustStay, Occupancy, PaletteId, Problem, PropertyType, RoomType, SizeClass, StartWhen, StyleId, Work } from './model.ts';

export interface Strings {
  readonly dir: 'ltr' | 'rtl';
  readonly langName: string;
  readonly otherLang: string;
  readonly appTitle: string;
  readonly theme: string;
  // Start page
  readonly startTitle: string;
  readonly startLead: string;
  readonly tiles: Readonly<Record<'cctv' | 'renovation' | 'build' | 'fix' | 'unsure', { title: string; detail: string }>>;
  readonly comingSoon: string;
  readonly unsureBody: string;
  readonly staffLink: string;
  // Wizard chrome
  readonly steps: readonly string[];
  readonly stepOf: (n: number, total: number) => string;
  readonly progress: string;
  readonly back: string;
  readonly next: string;
  readonly skip: string;
  readonly change: string;
  readonly remove: string;
  readonly save: string;
  readonly cancel: string;
  readonly optional: string;
  readonly required: string;
  // Step 1
  readonly s1Lead: string;
  readonly placeQ: string;
  readonly property: Readonly<Record<PropertyType, string>>;
  readonly occupancyQ: string;
  readonly occupancy: Readonly<Record<Occupancy, string>>;
  readonly aboutYou: string;
  readonly name: string;
  readonly phone: string;
  readonly phoneHelp: string;
  readonly email: string;
  readonly city: string;
  readonly ageQ: string;
  readonly age: Readonly<Record<BuildingAge, string>>;
  readonly phoneMissing: string;
  // Step 2
  readonly worksQ: string;
  readonly worksHint: string;
  readonly works: Readonly<Record<Work, string>>;
  readonly worksMissing: string;
  // Step 3
  readonly roomsLead: string;
  readonly noRooms: string;
  readonly addRoom: string;
  readonly addAnotherRoom: string;
  readonly yourRooms: string;
  readonly roomsMissing: string;
  readonly roomTypeQ: string;
  readonly roomType: Readonly<Record<RoomType, string>>;
  readonly roomNameQ: string;
  readonly roomNameHelp: string;
  readonly roomWorksQ: string;
  readonly sizeQ: string;
  readonly sizeModes: Readonly<Record<'class' | 'typed' | 'engineer', string>>;
  readonly sizeClass: Readonly<Record<SizeClass, string>>;
  readonly sizeTypical: (l: number, w: number) => string;
  readonly length: string;
  readonly width: string;
  readonly height: string;
  readonly metres: string;
  readonly heightHelp: string;
  readonly photosQ: string;
  readonly photosHint: string;
  readonly photoGuideTitle: string;
  readonly photoGuide: readonly string[];
  readonly addPhotos: string;
  readonly photoFacing: string;
  readonly facing: readonly string[];
  readonly photoCount: (n: number) => string;
  readonly photoPrivacy: string;
  readonly problemsQ: string;
  readonly problems: Readonly<Record<Problem, string>>;
  readonly roomNote: string;
  readonly saveRoom: string;
  readonly editRoomTitle: (name: string) => string;
  readonly addRoomTitle: string;
  readonly roomSummary: (photos: number) => string;
  readonly noPhotoWarning: string;
  // Step 4
  readonly styleQ: string;
  readonly styleHint: string;
  readonly styles: Readonly<Record<StyleId, { title: string; words: string }>>;
  readonly paletteQ: string;
  readonly palettes: Readonly<Record<PaletteId, string>>;
  readonly moodQ: string;
  readonly moods: Readonly<Record<Mood, string>>;
  readonly floorsQ: string;
  readonly floors: Readonly<Record<FloorLike, string>>;
  readonly loveHateQ: string;
  readonly loveHateHelp: string;
  readonly inspirationQ: string;
  readonly mustStayQ: string;
  readonly mustStay: Readonly<Record<MustStay, string>>;
  readonly mustStayOther: string;
  readonly styleMissing: string;
  readonly pickUpTo: (n: number) => string;
  // Step 5
  readonly budgetQ: string;
  readonly budget: Readonly<Record<BudgetTier, { title: string; detail: string }>>;
  readonly budgetRange: string;
  readonly budgetFrom: string;
  readonly budgetTo: string;
  readonly budgetMissing: string;
  // Step 6
  readonly startQ: string;
  readonly start: Readonly<Record<StartWhen, string>>;
  readonly finishByQ: string;
  readonly restrictionsQ: string;
  readonly restrictionsHelp: string;
  readonly startMissing: string;
  // Step 7
  readonly planLead: string;
  readonly planChoose: string;
  readonly planChooseAgain: string;
  readonly planFormats: string;
  readonly planRemove: string;
  readonly planAdded: (name: string) => string;
  // Step 8
  readonly estimateLabel: string;
  readonly estimateSentence: (walls: number, floors: number, days: number) => string;
  readonly estimateNote: string;
  readonly measuredLater: (n: number) => string;
  readonly noPrice: string;
  readonly yourAnswers: string;
  readonly reviewPlace: string;
  readonly reviewWorks: string;
  readonly reviewRooms: (n: number) => string;
  readonly reviewStyle: string;
  readonly reviewBudget: string;
  readonly reviewTiming: string;
  readonly reviewPlan: string;
  readonly none: string;
  readonly privacyTitle: string;
  readonly privacy: readonly string[];
  readonly consentPhotos: string;
  readonly consentMarketing: string;
  readonly consentMarketingHelp: string;
  readonly consentMissing: string;
  readonly sendTitle: string;
  readonly sendSteps: readonly string[];
  readonly saveFile: string;
  readonly saved: (file: string) => string;
  readonly linkInstead: string;
  readonly linkNoPhotos: string;
  readonly copyLink: string;
  readonly linkCopied: string;
  readonly linkTooLong: string;
  readonly nothingSent: string;
  readonly draftKeptNote: string;
}

const en: Strings = {
  dir: 'ltr',
  langName: 'English',
  otherLang: 'العربية',
  appTitle: 'Plan your renovation',
  theme: 'Theme',
  startTitle: 'What can we help you with?',
  startLead: 'Pick what you need. Each takes a few minutes on your phone, and nothing is sent until you choose to send it.',
  tiles: {
    cctv: { title: 'Security & CCTV', detail: 'Cameras and recording for a home, shop or site.' },
    renovation: { title: 'Renovate', detail: 'Repaint, new floors, ceilings, kitchens, bathrooms or a full makeover.' },
    build: { title: 'Build', detail: 'A new room, an extension or a villa.' },
    fix: { title: 'Fix something', detail: 'AC, power, water leaks, cracks or damp.' },
    unsure: { title: 'Not sure — tell us what you need', detail: 'We will call you back.' },
  },
  comingSoon: 'Coming soon — call or message ContracTech for now.',
  unsureBody: 'Call or message your ContracTech contact and tell us in your own words. You can also start the renovation questionnaire and choose “Not sure”.',
  staffLink: 'ContracTech staff: open the design tool',
  steps: ['About you and the place', 'What do you want to do?', 'Rooms', 'Your style', 'Budget', 'Timing', 'Floor plan', 'Review and send'],
  stepOf: (n, t) => `Step ${n} of ${t}`,
  progress: 'Progress',
  back: 'Back',
  next: 'Next',
  skip: 'Skip',
  change: 'Change',
  remove: 'Remove',
  save: 'Save',
  cancel: 'Cancel',
  optional: 'optional',
  required: 'required',
  s1Lead: 'A few questions about your place. It takes about ten minutes, and there are no wrong answers.',
  placeQ: 'What kind of place is it?',
  property: { apartment: 'Apartment', villa: 'Villa / house', office: 'Office', shop: 'Shop', restaurant: 'Restaurant / café', clinic: 'Clinic', other: 'Other' },
  occupancyQ: 'Is it occupied during the works?',
  occupancy: { occupied: 'We live or work there', empty: 'It will be empty', partly: 'Partly' },
  aboutYou: 'About you',
  name: 'Your name',
  phone: 'Phone',
  phoneHelp: 'So the engineer can arrange a visit. Required.',
  email: 'Email',
  city: 'Area or city',
  ageQ: 'How old is the building, roughly?',
  age: { 'under-5': 'Under 5 years', '5-15': '5–15 years', '15-30': '15–30 years', 'over-30': 'Over 30 years', 'not-sure': 'Not sure' },
  phoneMissing: 'Add a phone number so the engineer can reach you.',
  worksQ: 'What do you want to do?',
  worksHint: 'Pick everything that applies.',
  works: {
    repaint: 'Repaint',
    floors: 'New floors',
    'ceilings-lighting': 'Ceilings and lighting',
    kitchen: 'Kitchen',
    bathroom: 'Bathroom(s)',
    'doors-wardrobes': 'Doors and wardrobes',
    full: 'Full makeover',
    outside: 'Outside of the building',
    repairs: 'Small repairs',
    'not-sure': 'Not sure',
  },
  worksMissing: 'Pick at least one thing, or “Not sure”.',
  roomsLead: 'Add each room you want to change. Photos help us show you the result.',
  noRooms: 'No rooms yet.',
  addRoom: 'Add a room',
  addAnotherRoom: 'Add another room',
  yourRooms: 'Your rooms',
  roomsMissing: 'Add at least one room before you go on.',
  roomTypeQ: 'What room is it?',
  roomType: { living: 'Living room', majlis: 'Majlis', bedroom: 'Bedroom', kitchen: 'Kitchen', bathroom: 'Bathroom', corridor: 'Corridor', balcony: 'Balcony', office: 'Office', 'shop-floor': 'Shop floor', other: 'Other' },
  roomNameQ: 'What do you call it?',
  roomNameHelp: 'For example: Master bedroom, Guest majlis.',
  roomWorksQ: 'What to do in this room',
  sizeQ: 'Roughly how big?',
  sizeModes: { class: 'Small, medium or large', typed: 'I know the size', engineer: 'The engineer will measure' },
  sizeClass: { S: 'Small', M: 'Medium', L: 'Large' },
  sizeTypical: (l, w) => `about ${l} × ${w} m`,
  length: 'Length',
  width: 'Width',
  height: 'Ceiling height (if you know it)',
  metres: 'm',
  heightHelp: 'Leave empty if you are not sure.',
  photosQ: 'Photos of the room',
  photosHint: '2 to 6 photos. We need at least one to show you the room after the works.',
  photoGuideTitle: 'How to take good photos',
  photoGuide: [
    'Stand in a corner, phone at chest height, landscape. Include floor and ceiling.',
    'Take one photo from each corner of the room (two at least).',
    'Turn on the lights and open the curtains.',
    'For a problem (a crack, a stain): one close-up with a coin for scale, and one wide shot showing where it is.',
  ],
  addPhotos: 'Add photos',
  photoFacing: 'Taken from',
  facing: ['From the door', 'From a corner', 'From the window', 'Close-up of a problem'],
  photoCount: (n) => `${n} photo${n === 1 ? '' : 's'}`,
  photoPrivacy: 'Location data is removed from your photos on this phone. Nothing is uploaded.',
  problemsQ: 'Anything wrong in this room?',
  problems: { damp: 'Damp or stains', cracks: 'Cracks', peeling: 'Peeling paint', 'broken-tiles': 'Broken tiles', leaks: 'Leaks', ac: 'AC problems', electrical: 'Electrical problems' },
  roomNote: 'Anything else about this room?',
  saveRoom: 'Save this room',
  editRoomTitle: (name) => `Change “${name}”`,
  addRoomTitle: 'Add a room',
  roomSummary: (n) => (n === 0 ? 'no photos yet' : `${n} photo${n === 1 ? '' : 's'}`),
  noPhotoWarning: 'Without a photo we can describe this room but not show it.',
  styleQ: 'Which of these rooms do you like best?',
  styleHint: 'Pick one or two.',
  styles: {
    'modern-minimal': { title: 'Modern minimal', words: 'clean · calm · simple' },
    'warm-contemporary': { title: 'Warm contemporary', words: 'soft · welcoming · natural' },
    'contemporary-arabic': { title: 'Contemporary Arabic', words: 'arches · pattern · heritage' },
    classic: { title: 'Classic', words: 'mouldings · elegant · timeless' },
    scandinavian: { title: 'Scandinavian', words: 'light · wood · airy' },
    industrial: { title: 'Industrial', words: 'concrete · metal · bold' },
  },
  paletteQ: 'Which colours feel like home?',
  palettes: { 'warm-neutrals': 'Warm neutrals', 'cool-greys': 'Cool greys', earthy: 'Earthy', 'white-wood': 'White and wood', 'bold-accent': 'Bold accent', 'dark-dramatic': 'Dark and dramatic' },
  moodQ: 'How should it feel?',
  moods: { calm: 'Calm', bright: 'Bright', cosy: 'Cosy', luxurious: 'Luxurious', fresh: 'Fresh', practical: 'Practical', 'family-friendly': 'Family-friendly', impressive: 'Impressive for guests' },
  floorsQ: 'Floors you like',
  floors: { 'light-stone': 'Light stone / porcelain', marble: 'Marble look', wood: 'Wood look', concrete: 'Concrete look', keep: 'Keep the existing floors' },
  loveHateQ: 'Anything you love or hate?',
  loveHateHelp: 'In your own words, for example “we want it brighter”.',
  inspirationQ: 'Inspiration photos (up to 5)',
  mustStayQ: 'What must stay as it is?',
  mustStay: { furniture: 'Our furniture', kitchen: 'The kitchen', floors: 'The floors', doors: 'The doors' },
  mustStayOther: 'Something else that must stay',
  styleMissing: 'Pick at least one style, a colour palette and one feeling.',
  pickUpTo: (n) => `Pick up to ${n}.`,
  budgetQ: 'Which fits best?',
  budget: {
    essential: { title: 'Essential refresh', detail: 'Good, durable finishes that make it feel new.' },
    good: { title: 'Good quality', detail: 'Better materials and a few special touches.' },
    premium: { title: 'Premium finish', detail: 'Top materials and details that impress.' },
  },
  budgetRange: 'A budget range, if you have one',
  budgetFrom: 'From',
  budgetTo: 'To',
  budgetMissing: 'Pick the option that fits best.',
  startQ: 'When would you like to start?',
  start: { asap: 'As soon as possible', '1m': 'Within a month', '1-3m': 'In 1–3 months', later: 'Later' },
  finishByQ: 'Any date it must be finished by?',
  restrictionsQ: 'Are there times we can’t work?',
  restrictionsHelp: 'For example prayer times, school hours, Ramadan hours.',
  startMissing: 'Pick when you would like to start.',
  planLead: 'If you have a floor plan or a photo of a paper plan, add it. It helps, but you can skip this.',
  planChoose: 'Choose a picture',
  planChooseAgain: 'Choose a different picture',
  planFormats: 'PNG or JPG (take a screenshot of a PDF)',
  planRemove: 'Remove the picture',
  planAdded: (n) => `Added ${n}.`,
  estimateLabel: 'Preliminary estimate',
  estimateSentence: (w, f, d) => [w > 0 ? `about ${w} m² of walls to paint` : '', f > 0 ? `about ${f} m² of new floor` : '', d > 0 ? `about ${d} working days` : ''].filter(Boolean).join(', ') || 'The engineer will work it out on site',
  estimateNote: 'A first estimate from your answers. It is preliminary until a ContracTech engineer measures on site.',
  measuredLater: (n) => `${n} room${n === 1 ? '' : 's'} will be measured by the engineer and are not counted yet.`,
  noPrice: 'You will receive a price range after the engineer’s review, and a firm price after the site survey.',
  yourAnswers: 'Your answers',
  reviewPlace: 'Your place',
  reviewWorks: 'What you want to do',
  reviewRooms: (n) => `Rooms (${n})`,
  reviewStyle: 'Your style',
  reviewBudget: 'Budget',
  reviewTiming: 'Timing',
  reviewPlan: 'Floor plan',
  none: 'None',
  privacyTitle: 'Your photos and privacy',
  privacy: [
    'Your photos are used only to prepare your proposal and the “after” pictures.',
    'Location data was removed from your photos on this phone. Nothing is uploaded: you send the file yourself.',
    'ContracTech may use an image tool to prepare the “after” pictures; they are illustrations, not a promise.',
  ],
  consentPhotos: 'I agree that ContracTech may use these photos to prepare my proposal.',
  consentMarketing: 'ContracTech may also show my before and after pictures in its marketing, without my address.',
  consentMarketingHelp: 'Optional and separate. You can say no and still get your proposal.',
  consentMissing: 'Please agree to the use of your photos for the proposal, or remove the photos.',
  sendTitle: 'Send it to ContracTech',
  sendSteps: ['Save your answers and photos as a file with the button below.', 'Send the file to your ContracTech engineer by email or WhatsApp.', 'They open it and contact you to arrange the site visit.'],
  saveFile: 'Save my answers',
  saved: (f) => `Saved ${f}. Now send it to your ContracTech engineer.`,
  linkInstead: 'Or send a link instead.',
  linkNoPhotos: 'A link cannot carry photos or a plan — send the file so the engineer gets them.',
  copyLink: 'Copy a link',
  linkCopied: 'Link copied. Paste it into a message to your ContracTech engineer.',
  linkTooLong: 'Your answers are too long for a link; please send the file.',
  nothingSent: 'Nothing is sent anywhere automatically: your answers stay on this device until you send them.',
  draftKeptNote: 'Your answers and photos are kept on this device while you fill this in.',
};

const ar: Strings = {
  dir: 'rtl',
  langName: 'العربية',
  otherLang: 'English',
  appTitle: 'خطّط لتجديد منزلك',
  theme: 'المظهر',
  startTitle: 'كيف يمكننا مساعدتك؟',
  startLead: 'اختر ما تحتاجه. يستغرق كل خيار بضع دقائق على هاتفك، ولا يُرسل شيء حتى تختار إرساله.',
  tiles: {
    cctv: { title: 'الأمن والمراقبة', detail: 'كاميرات وتسجيل للمنزل أو المحل أو الموقع.' },
    renovation: { title: 'التجديد', detail: 'دهان، أرضيات جديدة، أسقف، مطابخ، دورات مياه أو تجديد كامل.' },
    build: { title: 'البناء', detail: 'غرفة جديدة أو توسعة أو فيلا.' },
    fix: { title: 'إصلاح عطل', detail: 'التكييف، الكهرباء، تسرّب المياه، التشققات أو الرطوبة.' },
    unsure: { title: 'غير متأكد — أخبرنا بما تحتاجه', detail: 'سنتواصل معك.' },
  },
  comingSoon: 'قريبًا — تواصل مع ContracTech حاليًا بالاتصال أو الرسائل.',
  unsureBody: 'اتصل أو راسل مسؤول التواصل في ContracTech وأخبرنا بكلماتك. يمكنك أيضًا بدء استبيان التجديد واختيار «غير متأكد».',
  staffLink: 'موظفو ContracTech: افتحوا أداة التصميم',
  steps: ['عنك وعن المكان', 'ماذا تريد أن تفعل؟', 'الغرف', 'ذوقك', 'الميزانية', 'التوقيت', 'المخطط', 'المراجعة والإرسال'],
  stepOf: (n, t) => `الخطوة ${n} من ${t}`,
  progress: 'التقدّم',
  back: 'السابق',
  next: 'التالي',
  skip: 'تخطٍّ',
  change: 'تعديل',
  remove: 'حذف',
  save: 'حفظ',
  cancel: 'إلغاء',
  optional: 'اختياري',
  required: 'مطلوب',
  s1Lead: 'بعض الأسئلة عن مكانك. يستغرق ذلك نحو عشر دقائق، ولا توجد إجابات خاطئة.',
  placeQ: 'ما نوع المكان؟',
  property: { apartment: 'شقة', villa: 'فيلا / منزل', office: 'مكتب', shop: 'محل', restaurant: 'مطعم / مقهى', clinic: 'عيادة', other: 'أخرى' },
  occupancyQ: 'هل سيكون المكان مأهولًا أثناء الأعمال؟',
  occupancy: { occupied: 'نسكن أو نعمل فيه', empty: 'سيكون خاليًا', partly: 'جزئيًا' },
  aboutYou: 'عنك',
  name: 'اسمك',
  phone: 'رقم الجوال',
  phoneHelp: 'ليتمكن المهندس من ترتيب زيارة. مطلوب.',
  email: 'البريد الإلكتروني',
  city: 'الحي أو المدينة',
  ageQ: 'كم عمر المبنى تقريبًا؟',
  age: { 'under-5': 'أقل من 5 سنوات', '5-15': 'من 5 إلى 15 سنة', '15-30': 'من 15 إلى 30 سنة', 'over-30': 'أكثر من 30 سنة', 'not-sure': 'غير متأكد' },
  phoneMissing: 'أضف رقم جوال ليتمكن المهندس من التواصل معك.',
  worksQ: 'ماذا تريد أن تفعل؟',
  worksHint: 'اختر كل ما ينطبق.',
  works: {
    repaint: 'إعادة الدهان',
    floors: 'أرضيات جديدة',
    'ceilings-lighting': 'الأسقف والإضاءة',
    kitchen: 'المطبخ',
    bathroom: 'دورات المياه',
    'doors-wardrobes': 'الأبواب والخزائن',
    full: 'تجديد كامل',
    outside: 'واجهة المبنى',
    repairs: 'إصلاحات صغيرة',
    'not-sure': 'غير متأكد',
  },
  worksMissing: 'اختر شيئًا واحدًا على الأقل، أو «غير متأكد».',
  roomsLead: 'أضف كل غرفة تريد تغييرها. تساعدنا الصور على أن نريك النتيجة.',
  noRooms: 'لا توجد غرف بعد.',
  addRoom: 'إضافة غرفة',
  addAnotherRoom: 'إضافة غرفة أخرى',
  yourRooms: 'غرفك',
  roomsMissing: 'أضف غرفة واحدة على الأقل قبل المتابعة.',
  roomTypeQ: 'ما هذه الغرفة؟',
  roomType: { living: 'غرفة المعيشة', majlis: 'مجلس', bedroom: 'غرفة نوم', kitchen: 'مطبخ', bathroom: 'دورة مياه', corridor: 'ممر', balcony: 'شرفة', office: 'مكتب', 'shop-floor': 'صالة المحل', other: 'أخرى' },
  roomNameQ: 'ماذا تسمّيها؟',
  roomNameHelp: 'مثلًا: غرفة النوم الرئيسية، مجلس الضيوف.',
  roomWorksQ: 'ما المطلوب في هذه الغرفة',
  sizeQ: 'ما حجمها تقريبًا؟',
  sizeModes: { class: 'صغيرة أو متوسطة أو كبيرة', typed: 'أعرف المقاسات', engineer: 'سيقيسها المهندس' },
  sizeClass: { S: 'صغيرة', M: 'متوسطة', L: 'كبيرة' },
  sizeTypical: (l, w) => `نحو ${l} × ${w} م`,
  length: 'الطول',
  width: 'العرض',
  height: 'ارتفاع السقف (إن كنت تعرفه)',
  metres: 'م',
  heightHelp: 'اتركه فارغًا إن لم تكن متأكدًا.',
  photosQ: 'صور الغرفة',
  photosHint: 'من 2 إلى 6 صور. نحتاج صورة واحدة على الأقل لنريك الغرفة بعد التجديد.',
  photoGuideTitle: 'كيف تلتقط صورًا جيدة',
  photoGuide: [
    'قف في زاوية، والهاتف بمستوى الصدر وبالوضع الأفقي. أظهر الأرضية والسقف.',
    'التقط صورة من كل زاوية في الغرفة (صورتان على الأقل).',
    'أشعل الأنوار وافتح الستائر.',
    'لأي مشكلة (شرخ أو بقعة): صورة قريبة مع عملة معدنية للمقياس، وصورة واسعة تُظهر مكانها.',
  ],
  addPhotos: 'إضافة صور',
  photoFacing: 'التُقطت من',
  facing: ['من الباب', 'من زاوية', 'من النافذة', 'صورة قريبة لمشكلة'],
  photoCount: (n) => (n === 1 ? 'صورة واحدة' : n === 2 ? 'صورتان' : `${n} صور`),
  photoPrivacy: 'تُزال بيانات الموقع من صورك على هذا الهاتف. لا يُرفع أي شيء.',
  problemsQ: 'هل توجد مشكلة في هذه الغرفة؟',
  problems: { damp: 'رطوبة أو بقع', cracks: 'تشققات', peeling: 'تقشّر الدهان', 'broken-tiles': 'بلاط مكسور', leaks: 'تسرّب', ac: 'مشكلات التكييف', electrical: 'مشكلات كهربائية' },
  roomNote: 'أي شيء آخر عن هذه الغرفة؟',
  saveRoom: 'حفظ هذه الغرفة',
  editRoomTitle: (name) => `تعديل «${name}»`,
  addRoomTitle: 'إضافة غرفة',
  roomSummary: (n) => (n === 0 ? 'لا توجد صور بعد' : n === 1 ? 'صورة واحدة' : n === 2 ? 'صورتان' : `${n} صور`),
  noPhotoWarning: 'من دون صورة يمكننا وصف هذه الغرفة لكن لا يمكننا إظهارها.',
  styleQ: 'أيّ هذه الغرف تعجبك أكثر؟',
  styleHint: 'اختر واحدة أو اثنتين.',
  styles: {
    'modern-minimal': { title: 'عصري بسيط', words: 'نظيف · هادئ · بسيط' },
    'warm-contemporary': { title: 'معاصر دافئ', words: 'ناعم · مرحِّب · طبيعي' },
    'contemporary-arabic': { title: 'عربي معاصر', words: 'أقواس · نقوش · تراث' },
    classic: { title: 'كلاسيكي', words: 'زخارف · أناقة · خالد' },
    scandinavian: { title: 'إسكندنافي', words: 'فاتح · خشب · رحب' },
    industrial: { title: 'صناعي', words: 'خرسانة · معدن · جريء' },
  },
  paletteQ: 'أيّ الألوان تشعرك بالبيت؟',
  palettes: { 'warm-neutrals': 'محايدة دافئة', 'cool-greys': 'رماديات باردة', earthy: 'ترابية', 'white-wood': 'أبيض وخشب', 'bold-accent': 'لمسة جريئة', 'dark-dramatic': 'داكنة ومميّزة' },
  moodQ: 'كيف تريد أن يكون الإحساس؟',
  moods: { calm: 'هادئ', bright: 'مشرق', cosy: 'دافئ ومريح', luxurious: 'فاخر', fresh: 'منعش', practical: 'عملي', 'family-friendly': 'مناسب للعائلة', impressive: 'لافت للضيوف' },
  floorsQ: 'الأرضيات التي تعجبك',
  floors: { 'light-stone': 'حجر / بورسلان فاتح', marble: 'بمظهر الرخام', wood: 'بمظهر الخشب', concrete: 'بمظهر الخرسانة', keep: 'إبقاء الأرضيات الحالية' },
  loveHateQ: 'شيء تحبه أو لا تحبه؟',
  loveHateHelp: 'بكلماتك، مثلًا «نريده أكثر إشراقًا».',
  inspirationQ: 'صور للإلهام (حتى 5)',
  mustStayQ: 'ما الذي يجب أن يبقى كما هو؟',
  mustStay: { furniture: 'أثاثنا', kitchen: 'المطبخ', floors: 'الأرضيات', doors: 'الأبواب' },
  mustStayOther: 'شيء آخر يجب أن يبقى',
  styleMissing: 'اختر طرازًا واحدًا على الأقل، ومجموعة ألوان، وإحساسًا واحدًا.',
  pickUpTo: (n) => `اختر حتى ${n}.`,
  budgetQ: 'أيّها يناسبك أكثر؟',
  budget: {
    essential: { title: 'تجديد أساسي', detail: 'تشطيبات جيدة ومتينة تجعله يبدو جديدًا.' },
    good: { title: 'جودة جيدة', detail: 'مواد أفضل وبعض اللمسات المميزة.' },
    premium: { title: 'تشطيب فاخر', detail: 'أفضل المواد وتفاصيل تُبهر.' },
  },
  budgetRange: 'نطاق الميزانية، إن وُجد',
  budgetFrom: 'من',
  budgetTo: 'إلى',
  budgetMissing: 'اختر الخيار الأنسب لك.',
  startQ: 'متى تودّ أن نبدأ؟',
  start: { asap: 'في أقرب وقت', '1m': 'خلال شهر', '1-3m': 'خلال شهر إلى ثلاثة أشهر', later: 'لاحقًا' },
  finishByQ: 'هل يوجد تاريخ يجب الانتهاء قبله؟',
  restrictionsQ: 'هل توجد أوقات لا يمكننا العمل فيها؟',
  restrictionsHelp: 'مثل أوقات الصلاة أو ساعات المدرسة أو ساعات رمضان.',
  startMissing: 'اختر متى تودّ أن نبدأ.',
  planLead: 'إن كان لديك مخطط للمنزل أو صورة لمخطط ورقي فأضفه. يساعدنا ذلك، ويمكنك تخطّي هذه الخطوة.',
  planChoose: 'اختر صورة',
  planChooseAgain: 'اختر صورة أخرى',
  planFormats: 'PNG أو JPG (التقط لقطة شاشة من ملف PDF)',
  planRemove: 'إزالة الصورة',
  planAdded: (n) => `تمت إضافة ${n}.`,
  estimateLabel: 'تقدير مبدئي',
  estimateSentence: (w, f, d) => [w > 0 ? `نحو ${w} م² من الجدران للدهان` : '', f > 0 ? `نحو ${f} م² من الأرضيات الجديدة` : '', d > 0 ? `نحو ${d} يوم عمل` : ''].filter(Boolean).join('، ') || 'سيحدّد المهندس ذلك في الموقع',
  estimateNote: 'تقدير أولي من إجاباتك، ويبقى مبدئيًا حتى يقيس مهندس ContracTech في الموقع.',
  measuredLater: (n) => `سيقيس المهندس ${n === 1 ? 'غرفة واحدة' : `${n} غرف`} ولم تُحسب بعد.`,
  noPrice: 'ستصلك تقديرات سعرية بعد مراجعة المهندس، وسعر نهائي بعد زيارة الموقع.',
  yourAnswers: 'إجاباتك',
  reviewPlace: 'مكانك',
  reviewWorks: 'ما تريد عمله',
  reviewRooms: (n) => `الغرف (${n})`,
  reviewStyle: 'ذوقك',
  reviewBudget: 'الميزانية',
  reviewTiming: 'التوقيت',
  reviewPlan: 'المخطط',
  none: 'لا يوجد',
  privacyTitle: 'صورك وخصوصيتك',
  privacy: [
    'تُستخدم صورك فقط لإعداد عرضك وصور «ما بعد التجديد».',
    'أُزيلت بيانات الموقع من صورك على هذا الهاتف. لا يُرفع أي شيء: أنت من يرسل الملف.',
    'قد تستخدم ContracTech أداة صور لإعداد صور «ما بعد التجديد»، وهي صور توضيحية وليست وعدًا.',
  ],
  consentPhotos: 'أوافق على أن تستخدم ContracTech هذه الصور لإعداد عرضي.',
  consentMarketing: 'يمكن لـ ContracTech أيضًا عرض صور قبل وبعد التجديد في تسويقها، من دون عنواني.',
  consentMarketingHelp: 'اختياري ومنفصل. يمكنك الرفض وستحصل على عرضك.',
  consentMissing: 'يُرجى الموافقة على استخدام صورك لإعداد العرض، أو حذف الصور.',
  sendTitle: 'أرسلها إلى ContracTech',
  sendSteps: ['احفظ إجاباتك وصورك في ملف بالزر أدناه.', 'أرسل الملف إلى مهندس ContracTech بالبريد أو واتساب.', 'يفتحه المهندس ويتواصل معك لترتيب زيارة الموقع.'],
  saveFile: 'حفظ إجاباتي',
  saved: (f) => `تم حفظ ${f}. أرسله الآن إلى مهندس ContracTech.`,
  linkInstead: 'أو أرسل رابطًا بدلًا من ذلك.',
  linkNoPhotos: 'لا يمكن للرابط أن يحمل الصور أو المخطط — أرسل الملف ليصلها المهندس.',
  copyLink: 'نسخ رابط',
  linkCopied: 'تم نسخ الرابط. الصقه في رسالة إلى مهندس ContracTech.',
  linkTooLong: 'إجاباتك أطول من أن يحملها رابط؛ يُرجى إرسال الملف.',
  nothingSent: 'لا يُرسل شيء تلقائيًا: تبقى إجاباتك على هذا الجهاز حتى ترسلها.',
  draftKeptNote: 'تُحفظ إجاباتك وصورك على هذا الجهاز أثناء التعبئة.',
};

export const STRINGS: Readonly<Record<Lang, Strings>> = { en, ar };
