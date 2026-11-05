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
 *  - Draft for the GM to approve: vision and mission wording.
 *  - Fill in: everything in [square brackets] on the projects slide.
 */

const ar = {
  lang: 'ar-SA',
  rtl: true,
  deckTitle: 'كونتراكتك — الملف التعريفي',
  cover: {
    title: 'الملف التعريفي',
    subtitle: 'المقاولات العامة والحلول التقنية',
    line: 'المملكة العربية السعودية · 2026',
  },
  about: {
    title: 'من نحن',
    paras: [
      'كونتراكتك شركة سعودية للخدمات المهنية، تعمل في قطاعين متكاملين: المقاولات العامة والحلول التقنية.',
      'يصمّم قطاع الحلول التقنية أنظمة كاميرات المراقبة والبنية الشبكية والأنظمة الأمنية ويركّبها ويصونها وفق متطلبات الامتثال الحكومية.',
      'ويقدّم قطاع المقاولات أعمال الإنشاء والصيانة، من عقود الصيانة الدورية إلى التنفيذ الكامل لنطاقات إنشائية محددة للمشاريع التجارية والخاصة والصناعية.',
      'يتعامل العميل مع جهة واحدة مسؤولة عن المبنى وعن الأنظمة التي تشغّله وتحميه.',
      'نخدم عملاءنا في جميع مناطق المملكة، بما فيها المدن الصغيرة البعيدة والمناطق النائية، وتنتقل فرقنا إلى موقع المشروع أينما كان.',
    ],
  },
  vision: {
    title: 'رؤيتنا ورسالتنا',
    items: [
      ['رؤيتنا', 'أن نكون الشريك الموثوق للمقاولات والحلول التقنية في كل مناطق المملكة.'],
      ['رسالتنا', 'نقدّم أعمال مقاولات وحلولاً تقنية مصمَّمة هندسياً، ننفّذها في موعدها، بتواصل واضح مع عملائنا، وبجودة نلتزم بها من التصميم حتى الصيانة.'],
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
  divisions: {
    title: 'قطاعاتنا',
    cols: [
      { photo: 'div_gc', head: 'المقاولات العامة', items: ['أعمال الإنشاءات', 'الأنظمة الكهربائية والميكانيكية', 'ترميم وتجديد المنشآت والمواقع', 'خدمات الصيانة'] },
      { photo: 'div_tech', head: 'الحلول التقنية', items: ['أنظمة كاميرات المراقبة', 'حلول تقنية المعلومات والشبكات', 'أنظمة الإنذار ومكافحة التسلل', 'صيانة الأنظمة'] },
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
  technology: {
    title: 'الحلول التقنية',
    items: [
      ['أنظمة كاميرات المراقبة', 'تصميم أنظمة المراقبة وتوريدها وتركيبها وفق متطلبات الامتثال، بالعلامة التجارية التي يحددها المشروع.'],
      ['حلول تقنية المعلومات والشبكات', 'تمديدات الكابلات المنظمة والمحوّلات وشبكات الواي فاي والبنية الشبكية لاتصال موثوق.'],
      ['أنظمة الإنذار ومكافحة التسلل', 'أنظمة كشف وإنذار تؤمّن المحيط ونقاط الدخول والمناطق الحساسة.'],
      ['صيانة الأنظمة', 'صيانة وقائية ودعم سريع للحفاظ على جاهزية أنظمة الأمن والشبكات.'],
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
      ['التزام بالمواعيد', 'برنامج زمني واضح ومتابعة مستمرة.'],
      ['ما بعد التسليم', 'تقارير مصوّرة وخدمات صيانة.'],
    ],
  },
  projects: {
    title: 'من أعمالنا',
    items: [
      { photo: 'proj1', name: '[اسم المشروع]', meta: '[الجهة] · [المدينة] · [السنة]', scope: '[نطاق العمل]' },
      { photo: 'proj2', name: '[اسم المشروع]', meta: '[الجهة] · [المدينة] · [السنة]', scope: '[نطاق العمل]' },
      { photo: 'proj3', name: '[اسم المشروع]', meta: '[الجهة] · [المدينة] · [السنة]', scope: '[نطاق العمل]' },
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
    subtitle: 'General Contracting and Technology Solutions',
    line: 'Kingdom of Saudi Arabia · 2026',
  },
  about: {
    title: 'About ContracTech',
    paras: [
      'ContracTech is a Saudi professional services company working in two complementary divisions: General Contracting and Technology Solutions.',
      'Our Technology division designs, installs and maintains CCTV, network infrastructure and security systems that meet government compliance requirements.',
      'Our Contracting division delivers construction and maintenance works, from routine maintenance contracts to full execution of defined construction scopes for commercial, private and industrial projects.',
      'Clients get one accountable partner for both the building and the systems that run and protect it.',
      'We serve the whole Kingdom, including distant minor cities and remote areas. Our teams mobilise to the site wherever the project is.',
    ],
  },
  vision: {
    title: 'Vision and Mission',
    items: [
      ['Vision', 'To be the trusted partner for contracting and technology solutions in every region of the Kingdom.'],
      ['Mission', 'We deliver engineered contracting and technology solutions, on time, with clear communication and quality we stand behind from design to maintenance.'],
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
  divisions: {
    title: 'Our Divisions',
    cols: [
      { photo: 'div_gc', head: 'General Contracting', items: ['Construction works', 'Electrical and mechanical systems', 'Facility and site renovation', 'Maintenance services'] },
      { photo: 'div_tech', head: 'Technology Solutions', items: ['CCTV systems', 'IT and network solutions', 'Intrusion and alarm systems', 'Systems maintenance'] },
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
  technology: {
    title: 'Technology Solutions',
    items: [
      ['CCTV Systems', 'Surveillance design, supply and installation to compliance standards, in the brand you specify.'],
      ['IT and Network Solutions', 'Structured cabling, switching, Wi-Fi and network infrastructure for reliable connectivity.'],
      ['Intrusion and Alarm Systems', 'Detection and alarm systems that secure perimeters, entry points and critical areas.'],
      ['Systems Maintenance', 'Preventive maintenance and fast support to keep security and network systems operational.'],
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
      ['On time', 'A clear programme and regular follow-up.'],
      ['After handover', 'Photo reports and maintenance services.'],
    ],
  },
  projects: {
    title: 'Selected Projects',
    items: [
      { photo: 'proj1', name: '[Project name]', meta: '[Client] · [City] · [Year]', scope: '[Scope of work]' },
      { photo: 'proj2', name: '[Project name]', meta: '[Client] · [City] · [Year]', scope: '[Scope of work]' },
      { photo: 'proj3', name: '[Project name]', meta: '[Client] · [City] · [Year]', scope: '[Scope of work]' },
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
  cover: 'Cover. Logo, title and year only, per the brand rules.',
  about: 'Photo frame: replace with a real photo of the team on site (right-click the gray frame > Change Picture).',
  vision: 'DRAFT wording for the General Manager to approve or rewrite. Not taken from an existing company document.',
  values: 'The four values and their one-line explanations are from the GM\'s own profile (November 2026).',
  divisions: 'Photo frames: one contracting project photo and one CCTV installation photo (right-click > Change Picture).',
  contracting: 'Service descriptions are general on purpose. Add a named reference project per service when available.',
  technology: 'Wording from the GM\'s own profile. Brand-neutral on purpose: ContracTech installs whichever camera brand the project or the client\'s standards specify. Do not claim any manufacturer partner level until it is confirmed in writing. Name the compliance requirements met (e.g. which authority) when a client asks.',
  cctv: 'Source: docs/about-the-portal-services.md, section 4. Every point is something the design portal does today.',
  renovation: 'Source: docs/about-the-portal-services.md, section 3.5. Say "illustrative visuals", never "photos of your finished home". Replace the before/after frames with a real job.',
  process: 'Seven steps, read right to left in Arabic.',
  why: 'Each claim here is backed by the portal or the brand facts. Do not add numbers (years, projects) until confirmed.',
  projects: 'FILL IN: three real projects with photo, client (only if they agreed to be named), city, year and scope. Duplicate the slide for more, or delete it if none can be shown yet.',
  contact: 'Phone numbers are written left-to-right inside the Arabic layout so they do not flip.',
};

module.exports = { ar, en, notes };
