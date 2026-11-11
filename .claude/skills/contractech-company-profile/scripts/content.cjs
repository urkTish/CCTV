/**
 * ContracTech company profile: the words on every slide, in Arabic and English.
 *
 * This is the single source of truth for the profile. Change wording here, then
 * rebuild both decks with build_profile.cjs so the two languages never drift.
 *
 * Fact status (see SKILL.md):
 *  - Confirmed: divisions and services, coverage, core values, contacts
 *    (from the ContracTech brand skill and the GM's own 7-slide profile,
 *    November 2026), and the CCTV and renovation methods (from
 *    docs/about-the-portal-services.md). ContracTech is brand-neutral: it
 *    installs whichever camera brand the project specifies.
 *  - Confirmed (November 2026): Eng. Kamal Asif's low-current and electrical
 *    service list (the profile of his former company, reworded; fire alarm
 *    removed on the GM's instruction) and his 30+ years of experience.
 *  - Approved by the GM (5 November 2026): the purpose statement and the slogan
 *    "Say it once." (slide 3 and the cover).
 *  - Approved by the GM (5 November 2026): Eng. Kamal Asif's title and the
 *    Arabic spelling of his name (كمال آصف).
 *  - Projects: edit the five clients and scopes under `projects`; logos live in assets/clients/.
 */

const ar = {
  lang: 'ar-SA',
  rtl: true,
  deckTitle: 'كونتراكتك — الملف التعريفي',
  cover: {
    title: 'الملف التعريفي',
    slogan: 'قُلها مرةً واحدة.',
    subtitle: 'المقاولات العامة والحلول التقنية',
    line: '2026',
  },
  about: {
    title: 'من نحن',
    paras: [
      'كونتراكتك شركة سعودية للخدمات المهنية، تعمل في قطاعين متكاملين: المقاولات العامة والحلول التقنية.',
      'قطاع الحلول التقنية جهة متكاملة لأنظمة التيار الخفيف: يصمّم ويورّد ويركّب ويختبر ويشغّل ويصون أنظمة كاميرات المراقبة والتحكم في الدخول والإذاعة الداخلية والتلفزيون والهاتف والشبكات، وفق متطلبات الامتثال الحكومية.',
      'ويقدّم قطاع المقاولات أعمال الإنشاء والأعمال الكهربائية للجهد المنخفض والصيانة، من عقود الصيانة الدورية إلى التنفيذ الكامل لنطاقات إنشائية محددة للمشاريع التجارية والخاصة والصناعية.',
      'يتعامل العميل مع جهة واحدة مسؤولة عن المبنى وعن الأنظمة التي تشغّله وتحميه، بفريق تتجاوز خبرته 30 عاماً في الأنظمة الأمنية والتيار الخفيف.',
      'نخدم عملاءنا في جميع مناطق المملكة، بما فيها المدن الصغيرة البعيدة والمناطق النائية، وتنتقل فرقنا إلى موقع المشروع أينما كان.',
    ],
  },
  vision: {
    title: 'غايتنا',
    items: [
      ['غايتنا', 'أن نكون الفريق الواحد الذي يأتمنه العميل على المبنى وكل ما يشغّله ويحميه.'],
      ['شعارنا', 'قُلها مرةً واحدة. تصف احتياجك مرة واحدة، لجهة واحدة، فتتولى المبنى وأنظمته من التصميم إلى الصيانة.'],
    ],
  },
  values: {
    title: 'قيمنا',
    items: [
      ['الاحترافية', 'فرق مؤهلة وأعمال منفّذة وفق المعايير.'],
      ['التنفيذ في الوقت المحدد', 'جداول زمنية نلتزم بها ونسلّم في موعدنا.'],
      ['التواصل الفعّال مع العملاء', 'إطلاع واضح للعميل في كل مرحلة من مراحل العمل.'],
      ['جودة الخدمة', 'نقف خلف جودة أعمالنا بعد التسليم.'],
    ],
  },
  team: {
    title: 'فريقنا',
    people: [
      { name: 'م. تركي التركي', role: 'المدير العام', desc: 'تطوير الأعمال والعلاقات مع العملاء، والتصميم الهندسي والعروض الفنية.' },
      { name: 'م. كمال آصف', role: 'مسؤول أنظمة التيار الخفيف والأنظمة الكهربائية', desc: 'أكثر من 30 عاماً في الأنظمة الأمنية وأنظمة التيار الخفيف والأعمال الكهربائية للجهد المنخفض: تصميم وتوريد وتركيب واختبار وتشغيل.' },
      { name: 'م. محمود رشاد', role: 'مدير الإنشاءات', desc: 'أكثر من 10 أعوام في أعمال الإنشاء والترميم والصيانة في الموقع.' },
    ],
  },
  divisions: {
    title: 'قطاعاتنا',
    cols: [
      { photo: 'div_gc', head: 'المقاولات العامة', items: ['أعمال الإنشاءات', 'الأنظمة الكهربائية والميكانيكية', 'ترميم وتجديد المنشآت والمواقع', 'خدمات الصيانة'] },
      { photo: 'div_tech', head: 'الحلول التقنية', items: ['كاميرات المراقبة والأنظمة الأمنية', 'التيار الخفيف: الإذاعة والتلفزيون والهاتف', 'الشبكات والكابلات المنظمة', 'صيانة الأنظمة'] },
    ],
  },
  contracting: {
    title: 'المقاولات العامة',
    items: [
      ['أعمال الإنشاءات', 'تنفيذ نطاقات إنشائية محددة للمشاريع التجارية والخاصة والصناعية.'],
      ['الأنظمة الكهربائية والميكانيكية', 'تركيب وتحديث وإصلاح الأنظمة الكهربائية والتكييف والسباكة والأنظمة الميكانيكية.'],
      ['ترميم وتجديد المنشآت والمواقع', 'تجهيز وتجديد وتطوير المباني والمواقع القائمة: دهانات، وبلاط، وأسقف جبسية.'],
      ['خدمات الصيانة', 'عقود صيانة وقائية وتصحيحية تحافظ على جاهزية المنشآت، مع تقارير بالملاحظات والتوصيات.'],
    ],
  },
  electrical: {
    title: 'الأعمال الكهربائية للجهد المنخفض',
    items: [
      ['الطاقة والإنارة', 'دوائر الطاقة والإنارة والتحكم بالإنارة، والمقابس والمفاتيح ومفاتيح الفصل، واختبار العزل.'],
      ['كابلات الجهد المنخفض والتيار الخفيف', 'مدّ وسحب وتوصيل واختبار وترقيم الكابلات: البيانات والهاتف والفيديو والصوتيات والتحكم.'],
      ['مسارات الكابلات وتنظيمها', 'حوامل الكابلات والسلالم والمجاري، ومجاري القضبان، والمغذيات الرأسية، والمواسير المعدنية والبلاستيكية، والترنكات.'],
      ['التأريض والحماية من الصواعق', 'أنظمة التأريض بالقضبان والألواح والشبكات، والحماية من الصواعق، واللحام الحراري، ومعالجة التربة، وقياس مقاومة الأرضي.'],
      ['التوزيع والتحكم', 'لوحات التوزيع ومراكز التحكم بالمحركات، والقواطع الهوائية، ومفاتيح التحويل اليدوية والتلقائية، ومجاري القضبان، وأنظمة UPS والبطاريات.'],
    ],
  },
  elv: {
    title: 'أنظمة التيار الخفيف',
    lead: 'جهة واحدة لكل أنظمة التيار الخفيف في المبنى: تصميم وتوريد وتركيب واختبار وتشغيل وصيانة، بالعلامات التجارية التي يحددها مشروعك.',
    groups: [
      { head: 'الأنظمة الأمنية', items: ['المراقبة بالكاميرات', 'التحكم في الدخول والحضور والانصراف', 'كشف التسلل'] },
      { head: 'الاتصالات', items: ['الإذاعة الداخلية والموسيقى الخلفية', 'الهاتف التناظري وهاتف VoIP', 'نداء التمريض والاتصال الداخلي', 'الساعات المركزية'] },
      { head: 'التلفزيون والأنظمة المرئية', items: ['البث الفضائي المركزي (SMATV)', 'التلفزيون عبر الشبكة (IPTV)', 'الأنظمة الصوتية والمرئية'] },
      { head: 'الشبكات', items: ['الكابلات المنظمة', 'شبكات البيانات', 'غرف الحاسب والخوادم'] },
    ],
  },
  security: {
    title: 'الأنظمة الأمنية',
    items: [
      ['المراقبة بالكاميرات', 'كاميرات عالية الدقة ومسجلات فيديو (NVR) وبرامج إدارة الفيديو والتحليلات الذكية، من مكتب صغير إلى منشأة متعددة المواقع.'],
      ['التحكم في الدخول والحضور', 'قارئات البطاقات والبصمة والبوابات الدوّارة والأقفال الذكية، لباب واحد أو لمجمّع كامل، مرتبطة بالكاميرات والحضور والانصراف.'],
      ['كشف التسلل والإنذار', 'أنظمة كشف وإنذار تؤمّن المحيط ونقاط الدخول والمناطق الحساسة.'],
      ['منظومة أمنية متكاملة', 'الكاميرات والتحكم في الدخول وكشف التسلل والاتصال الداخلي تعمل كنظام واحد: تشغيل أسهل وتكلفة أقل.'],
    ],
  },
  comms: {
    title: 'الاتصالات والأنظمة الصوتية والمرئية',
    items: [
      ['الإذاعة الداخلية والموسيقى الخلفية', 'نداء حسب المناطق، وموسيقى خلفية، وإعلانات الطوارئ، بصوت واضح في كل مكان.'],
      ['التلفزيون عبر الشبكة والبث الفضائي', 'بث مباشر وفيديو حسب الطلب وقنوات خاصة بدقة HD و4K، مع الربط بنظام إدارة الفندق والشاشات الرقمية.'],
      ['الهاتف عبر الإنترنت VoIP', 'مكالمات صوتية ومرئية عبر شبكة واحدة، داخل الموقع أو سحابياً، مع إدارة المكالمات وتسجيلها.'],
      ['نداء التمريض والاتصال الداخلي', 'نداء المريض للتمريض والاتصال الداخلي في المستشفيات والعيادات والمباني السكنية.'],
      ['الساعات المركزية', 'توقيت موحّد لجميع ساعات المبنى.'],
      ['الأنظمة الصوتية والمرئية', 'الصوت والعرض والشاشات لقاعات الاجتماعات والمناسبات.'],
    ],
  },
  networks: {
    title: 'الشبكات وغرف الحاسب',
    items: [
      ['الكابلات المنظمة', 'كابلات نحاسية وألياف ضوئية للهاتف والبيانات والفيديو: تصميم وتركيب وترقيم واختبار واعتماد.'],
      ['شبكات البيانات', 'المحوّلات وشبكات الواي فاي والخزائن والمكوّنات النشطة والخاملة، لشبكات موثوقة قابلة للتوسع.'],
      ['غرف الحاسب والخوادم', 'الأرضيات المرتفعة، ومسارات الكابلات، وتحديد سعة UPS، والتحكم البيئي، والتمديدات الكهربائية، وتأمين الغرفة بالتحكم في الدخول والكاميرات، والتوثيق الكامل.'],
    ],
  },
  cctv: {
    title: 'منهجيتنا في أنظمة المراقبة',
    lead: 'نصمّم حسب ما تحتاج أن تراه، لا حسب عدد الكاميرات أو العلامة التجارية.',
    items: [
      'نحدّد المطلوب في كل منطقة: مراقبة عامة، أو تمييز الأشخاص، أو التعرّف على الوجوه، أو قراءة لوحات السيارات، وفق المعيار الدولي IEC 62676-4.',
      'نختار الكاميرا المناسبة لكل منطقة حسب ارتفاع التركيب والمسافة والإضاءة الليلية، مع بدائل وسبب واضح لكل اختيار.',
      'نحسب سعة التخزين ومسجّل الفيديو (NVR) والأقراص حسب مدة الاحتفاظ بالتسجيل.',
      'نصمّم شبكة PoE وتمديدات الكابلات ضمن حدود معيار TIA-568، مع حصر دقيق للكابلات والملحقات.',
      'نسلّم عرضاً فنياً يتضمن مخطط الموقع وجدول المواد وروابط النشرات الفنية للمصنّع، ويُختم عند اعتماده.',
    ],
  },
  renovation: {
    title: 'خدمة الترميم والتجديد',
    lead: 'شاهِد النتيجة قبل التنفيذ، واعرف سبب كل تكلفة.',
    items: [
      'استبيان سهل من الجوال بالعربية أو الإنجليزية: صور الغرف، والنمط المفضّل، والألوان.',
      'مسح هندسي للموقع يشمل العيوب والإجراء الموصى به، مع قائمة سلامة إلزامية.',
      'صور توضيحية للنتيجة المتوقعة، وجدول تشطيبات بأكواد ألوان حقيقية.',
      'جدول كميات مسعّر، وبرنامج زمني بأيام العمل، وجدول دفعات.',
      'تقرير تسليم بصور قبل التنفيذ وأثناءه وبعده، مع توقيع العميل على كل بند.',
    ],
    before: 'قبل',
    after: 'بعد',
  },
  process: {
    title: 'كيف نعمل',
    lead: 'من أول تواصل حتى ما بعد التسليم.',
    steps: [
      ['نستمع لاحتياجك', 'نفهم المطلوب والميزانية والموعد.'],
      ['نمسح الموقع', 'المقاسات والحالة ومتطلبات السلامة.'],
      ['نصمّم ونحسب', 'تصميم هندسي وجدول كميات لكل رقم فيه مصدر.'],
      ['نقدّم عرضاً واضحاً', 'عرض فني ومالي مفصّل قبل البدء.'],
      ['ننفّذ', 'وفق البرنامج الزمني مع متابعة مستمرة.'],
      ['نسلّم', 'بتقرير مصوّر وتوقيع العميل.'],
      ['نتابع', 'صيانة ودعم بعد التسليم.'],
    ],
  },
  why: {
    title: 'لماذا كونتراكتك',
    items: [
      ['جهة واحدة لمشروعك', 'المقاولات والحلول التقنية تحت إدارة واحدة.'],
      ['نصل إلى كل موقع', 'جميع مناطق المملكة، بما فيها المناطق النائية.'],
      ['تصميم هندسي موثّق', 'كل رقم في عروضنا له معادلة أو مصدر من المصنّع.'],
      ['تكلفة واضحة', 'جدول كميات مفصّل يوضّح سبب كل تكلفة.'],
      ['فريق خبير', 'أكثر من 30 عاماً في الأنظمة الأمنية والتيار الخفيف، وأكثر من 10 أعوام في الإنشاءات.'],
      ['ما بعد التسليم', 'تقارير مصوّرة وخدمات صيانة.'],
    ],
  },
  projects: {
    title: 'مشاريع مختارة',
    // logo: file at assets/clients/<logo>.png; mark: the name shown in its place when there is no file.
    items: [
      { logo: 'swissotel', mark: 'Swissôtel', client: 'سويسوتيل ليفينج جدة', scope: 'أعمال كهربائية للجهد المنخفض' },
      { logo: 'uqu', mark: 'جامعة أم القرى', client: 'جامعة أم القرى', scope: 'أنظمة الجهد المنخفض والتيار الخفيف' },
      { logo: 'media', mark: 'وزارة الإعلام', client: 'وزارة الإعلام', scope: 'أعمال ميكانيكية وكهربائية وتكييف في عدة عقود' },
      { logo: 'jd', mark: 'JD Logistics', client: 'جي دي لوجستكس', scope: 'كاميرات مراقبة وأعمال صيانة وترميم' },
      { logo: 'ajex', mark: 'AJEX', client: 'أجيكس للخدمات اللوجستية', scope: 'كاميرات مراقبة وأعمال صيانة مدنية' },
    ],
  },
  contact: {
    title: 'تواصل معنا',
    lead: 'يسعدنا تواصلكم',
    people: [
      { name: 'م. تركي التركي', role: 'المدير العام', phone: '+966 555 755 039', email: 'Turki@contractech.sa' },
      { name: 'م. محمود رشاد', role: 'مدير الإنشاءات', phone: '+966 549 203 907', email: 'Mahmoud@contractech.sa' },
    ],
    coverage: 'نخدم جميع مناطق المملكة العربية السعودية، بما فيها المدن الصغيرة البعيدة والمناطق النائية.',
  },
  numerals: ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'],
};

const en = {
  lang: 'en-US',
  rtl: false,
  deckTitle: 'ContracTech — Company Profile',
  cover: {
    title: 'Company Profile',
    slogan: 'Say it once.',
    subtitle: 'General Contracting and Technology Solutions',
    line: '2026',
  },
  about: {
    title: 'About ContracTech',
    paras: [
      'ContracTech is a Saudi professional services company working in two complementary divisions: General Contracting and Technology Solutions.',
      'Our Technology division is a full low-current (ELV) integrator: CCTV, access control, public address, IPTV, telephony and networks, designed, installed, commissioned and maintained to government compliance requirements.',
      'Our Contracting division delivers construction, low-voltage electrical and maintenance works, from routine maintenance contracts to complete construction scopes.',
      'Clients get one accountable partner for the building and the systems that run and protect it, backed by more than 30 years of team experience in security and low-current systems.',
      'We serve the whole Kingdom, including distant minor cities and remote areas, and go wherever the project is.',
    ],
  },
  vision: {
    title: 'Our Purpose',
    items: [
      ['Purpose', 'To be the one team a client trusts with the building and everything that runs and protects it.'],
      ['Our line', 'Say it once. You describe what you need once, to one partner, and we take the building and its systems from design to maintenance.'],
    ],
  },
  values: {
    title: 'Our Values',
    items: [
      ['Professionalism', 'Qualified teams and work done to standard.'],
      ['Timely Execution', 'Committed schedules, delivered on time.'],
      ['Effective Client Communication', 'Clear updates at every stage of the work.'],
      ['Quality of Service', 'Workmanship we stand behind after handover.'],
    ],
  },
  team: {
    title: 'Our Team',
    people: [
      { name: 'Eng. Turki AlTurki', role: 'General Manager', desc: 'Business development, client relationships, engineering design and proposals.' },
      { name: 'Eng. Kamal Asif', role: 'Low-Current and Electrical Systems Lead', desc: 'More than 30 years in security, low-current (ELV) and low-voltage electrical systems: design, supply, installation, testing and commissioning.' },
      { name: 'Eng. Mahmoud Rashad', role: 'Construction Manager', desc: 'More than 10 years in construction, renovation and maintenance works on site.' },
    ],
  },
  divisions: {
    title: 'Our Divisions',
    cols: [
      { photo: 'div_gc', head: 'General Contracting', items: ['Construction works', 'Electrical and mechanical systems', 'Facility and site renovation', 'Maintenance services'] },
      { photo: 'div_tech', head: 'Technology Solutions', items: ['CCTV and security systems', 'Low-current: PA, IPTV, telephony', 'Networks and structured cabling', 'Systems maintenance'] },
    ],
  },
  contracting: {
    title: 'General Contracting',
    items: [
      ['Construction Works', 'Execution of defined construction scopes for commercial, private and industrial projects.'],
      ['Electrical and Mechanical Systems', 'Installation, upgrade and repair of electrical, HVAC, plumbing and mechanical systems.'],
      ['Facility and Site Renovation', 'Fit-out, refurbishment and upgrade of existing buildings and sites: painting, tiling and gypsum ceilings.'],
      ['Maintenance Services', 'Planned and corrective maintenance contracts that keep facilities running, with reports of findings and recommendations.'],
    ],
  },
  electrical: {
    title: 'Electrical Works (Low Voltage)',
    items: [
      ['Power and Lighting', 'Power, lighting and lighting-control circuits; sockets, switches and isolators; insulation testing.'],
      ['LV and ELV Cabling', 'Laying, pulling, terminating, testing and labelling cables for data, voice, video, sound and control.'],
      ['Cable Containment', 'Cable trays, ladders, raceways, bus ducts, riser feeders, EMT and PVC conduit, and trunking.'],
      ['Earthing and Lightning Protection', 'Rod, plate and mat earthing, lightning protection, exothermic welding, soil treatment and earth-resistance tests.'],
      ['LV Distribution and Control', 'Distribution panels, MCCs, air circuit breakers, manual and automatic transfer switches, busways, UPS and batteries.'],
    ],
  },
  elv: {
    title: 'Low-Current (ELV) Systems',
    lead: 'One integrator for every low-current system in the building: design, supply, installation, testing, commissioning and maintenance, in the brands your project specifies.',
    groups: [
      { head: 'Security', items: ['CCTV surveillance', 'Access control and time attendance', 'Intrusion detection'] },
      { head: 'Communication', items: ['Public address and background music', 'Analog and VoIP telephony', 'Nurse call and intercom', 'Master clock systems'] },
      { head: 'TV and audio-visual', items: ['Central satellite TV (SMATV)', 'IPTV', 'Audio-visual and sound systems'] },
      { head: 'Networks', items: ['Structured cabling', 'Data networking', 'Computer and server rooms'] },
    ],
  },
  security: {
    title: 'Security Systems',
    items: [
      ['CCTV Surveillance', 'High-resolution cameras, recorders (NVR), video management software and analytics, from a small office to a multi-site enterprise.'],
      ['Access Control and Time Attendance', 'Card readers, biometrics, turnstiles and smart locks, for one door or a whole campus, linked to CCTV and time attendance.'],
      ['Intrusion Detection', 'Detection and alarm systems that secure perimeters, entry points and critical areas.'],
      ['One Integrated Platform', 'CCTV, access control, intrusion and intercom working as one system: simpler to run and less costly to operate.'],
    ],
  },
  comms: {
    title: 'Communication, TV and Audio-Visual',
    items: [
      ['Public Address and Background Music', 'Zoned paging, background music and emergency announcements, with clear sound everywhere.'],
      ['IPTV and SMATV', 'Live TV, video on demand and custom channels in HD and 4K, linked to the hotel PMS and digital signage.'],
      ['IP Telephony and VoIP', 'Voice and video calls over one network, on site or in the cloud, with call management and recording.'],
      ['Nurse Call and Intercom', 'Patient-to-nurse calling and building intercom for hospitals, clinics and residences.'],
      ['Master Clock', 'One synchronised time on every clock in the building.'],
      ['Audio-Visual and Sound', 'Sound, projection and displays for meeting rooms and halls.'],
    ],
  },
  networks: {
    title: 'Networks and Computer Rooms',
    items: [
      ['Structured Cabling', 'Copper and fibre for voice, data and video: design, installation, labelling, testing and certification.'],
      ['Data Networking', 'Switching, Wi-Fi, racks and cabinets, active and passive components, for reliable networks that grow with you.'],
      ['Computer and Server Rooms', 'Raised floors, cable containment, UPS sizing, environmental control, electrical wiring, room security (access control and CCTV) and full documentation.'],
    ],
  },
  cctv: {
    title: 'How We Design CCTV Systems',
    lead: 'We design around what you need to see, not around a camera count or one brand.',
    items: [
      'We set what each area must achieve (general watch, recognising people, identifying faces or reading number plates) to the international standard IEC 62676-4.',
      'We choose the right camera for each area from mounting height, distance and night-time lighting, with alternatives and a clear reason for each choice.',
      'We size storage, the video recorder (NVR) and drives to the retention period required.',
      'We design the PoE network and cabling within TIA-568 limits, with an exact count of cable and accessories.',
      "We deliver a technical proposal with a site map, bill of materials and links to the manufacturer's datasheets, stamped once approved.",
    ],
  },
  renovation: {
    title: 'Renovation',
    lead: 'See it before we build it, and see why it costs what it costs.',
    items: [
      'A simple phone questionnaire in Arabic or English: room photos, preferred style and colours.',
      "An engineer's site survey: defects, the recommended action and a mandatory safety checklist.",
      'Illustrative visuals of the expected result, and a finishes schedule with real colour codes.',
      'A priced bill of quantities, a programme in working days and a payment schedule.',
      'A handover report with before, during and after photos, signed off by the client item by item.',
    ],
    before: 'Before',
    after: 'After',
  },
  process: {
    title: 'How We Work',
    lead: 'From the first call to after handover.',
    steps: [
      ['We listen', 'Your needs, budget and timing.'],
      ['Site survey', 'Sizes, condition and safety checks.'],
      ['Design', 'Engineered design and quantities, every figure sourced.'],
      ['Clear proposal', 'Detailed technical and commercial offer before work starts.'],
      ['Execution', 'On programme, with regular follow-up.'],
      ['Handover', 'Photo report, signed off by the client.'],
      ['Aftercare', 'Maintenance and support.'],
    ],
  },
  why: {
    title: 'Why ContracTech',
    items: [
      ['One partner', 'Contracting and technology under one management.'],
      ['We reach every site', 'The whole Kingdom, including remote areas.'],
      ['Documented engineering', 'Every figure in our proposals has a formula or a manufacturer source.'],
      ['Clear costs', 'A detailed bill of quantities that shows why each cost is there.'],
      ['Experienced team', 'More than 30 years in security and low-current systems, and more than 10 in construction.'],
      ['After handover', 'Photo reports and maintenance services.'],
    ],
  },
  projects: {
    title: 'Selected Projects',
    items: [
      { logo: 'swissotel', mark: 'Swissôtel', client: 'Swissôtel Living Jeddah', scope: 'Low-voltage electrical works' },
      { logo: 'uqu', mark: 'UQU', client: 'Umm Al-Qura University', scope: 'Low-voltage and low-current systems' },
      { logo: 'media', mark: 'Ministry of Media', client: 'Ministry of Media', scope: 'MEP and HVAC works across several contracts' },
      { logo: 'jd', mark: 'JD Logistics', client: 'JD Logistics', scope: 'CCTV, maintenance and renovation works' },
      { logo: 'ajex', mark: 'AJEX', client: 'AJEX Logistics Services', scope: 'CCTV and civil maintenance works' },
    ],
  },
  contact: {
    title: 'Contact Us',
    lead: 'We would be glad to hear from you',
    people: [
      { name: 'Eng. Turki AlTurki', role: 'General Manager', phone: '+966 555 755 039', email: 'Turki@contractech.sa' },
      { name: 'Eng. Mahmoud Rashad', role: 'Construction Manager', phone: '+966 549 203 907', email: 'Mahmoud@contractech.sa' },
    ],
    coverage: 'We serve every region of the Kingdom of Saudi Arabia, including distant minor cities and remote areas.',
  },
  numerals: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
};

/** Speaker notes, shared by both languages (written in English for the team). */
const notes = {
  cover: 'Cover. Logo, title, the slogan "Say it once." and the year, per the brand rules.',
  about: 'Photo frame: replace with a real photo of the team on site (right-click the gray frame > Change Picture).',
  vision: 'Purpose statement and the slogan "Say it once." approved by the GM on 5 November 2026. The slogan stands alone on the cover; this slide is where it is explained.',
  values: 'The four values and their one-line explanations are from the GM\'s own profile (November 2026).',
  divisions: 'Photo frames: one contracting project photo and one CCTV installation photo (right-click > Change Picture).',
  team: 'Eng. Kamal Asif\'s title and the Arabic spelling of his name were confirmed by the GM (5 Nov 2026). Years of experience as stated by the GM (November 2026). Keep a short CV for each person ready; clients and tenders ask for them. Eng. Mahmoud\'s 10+ years confirmed by the GM (5 Nov 2026).',
  contracting: 'Service descriptions are general on purpose. Add a named reference project per service when available.',
  electrical: 'From Eng. Kamal Asif\'s service list (November 2026), reworded. Fire systems (alarm, cabling, suppression) are not offered.',
  elv: 'From Eng. Kamal Asif\'s service list (November 2026), reworded. Fire alarm is not offered. Brand-neutral: ContracTech installs the brands the project specifies; claim no manufacturer partner level until confirmed in writing.',
  security: 'From Eng. Kamal Asif\'s service list and the GM\'s own profile. Name the compliance requirements met (e.g. which authority) when a client asks.',
  comms: 'From Eng. Kamal Asif\'s service list (November 2026). Relevant to hotels: IPTV with PMS link, PA and background music, telephony. Fire-alarm integration is not offered.',
  networks: 'From Eng. Kamal Asif\'s service list (November 2026). Computer-room fire suppression is not offered.',
  cctv: 'Source: docs/about-the-portal-services.md, section 4. Every point is something the design portal does today.',
  renovation: 'Source: docs/about-the-portal-services.md, section 3.5. Say "illustrative visuals", never "photos of your finished home". Replace the before/after frames with a real job.',
  process: 'Seven steps, read right to left in Arabic.',
  why: 'Each claim here is backed by the portal, the brand facts or the team (30+ years confirmed by the GM, November 2026). Do not add other numbers (years in business, project counts) until confirmed.',
  projects: 'Source: the GM\'s list of past works (11 November 2026): client and scope only. No cities, years or values until the GM confirms them. Ministry of Media is the current name of the former Ministry of Information. Logos: Swissôtel, Umm Al-Qura University and Ministry of Media from Wikimedia Commons, JD Logistics from Wikipedia; a client without a logo file shows its name instead. Check with each client before the deck goes into a tender.',
  contact: 'Phone numbers are written left-to-right inside the Arabic layout so they do not flip.',
};

module.exports = { ar, en, notes };
