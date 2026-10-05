// مصدر بيانات المقرر — منصة لغتي الخالدة
// المصدر التعليمي قبل طبقة العرض البصري. يعدَّل المحتوى هنا أو في قاعدة البيانات المتزامنة معه.

export const COURSE_META = {
  "id": "lugati-eternal-g9",
  "title": "لغتي الخالدة",
  "grade": "ثالث متوسط",
  "locale": "ar-SA",
  "direction": "rtl",
  "version": "2026.10.curriculum-v1",
  "defaultMasteryPercent": 85,
  "minimumCoreObjectivePercent": 80,
  "pointCheckRequiredCorrect": 2,
  "pointCheckQuestionCount": 3
};

export const UNITS = [
  {
    "id": "u1",
    "order": 1,
    "title": "حقوق وواجبات",
    "difficulty": "متدرج",
    "unitGoal": "أن يفهم الطالب الحقوق والواجبات في النصوص المسموعة والمقروءة، ويطبق مهارات الوحدة اللغوية والكتابية والشفهية في سياقات جديدة.",
    "measurableObjectives": [
      "يستخرج الحقوق والواجبات والقيم من نصوص الوحدة مستندًا إلى شواهد.",
      "يميز الأفكار الرئيسة والفرعية ويستخدم الأسئلة لزيادة التركيز والفهم.",
      "يكتب الألف اللينة في الأفعال الثلاثية كتابة صحيحة ويعلل الرسم.",
      "يرسم (ل، لا) بخط الرقعة رسمًا صحيحًا.",
      "يتعرف اسم الفاعل ويصوغه ويوظفه.",
      "يتعرف أسلوب القسم ويحدد أركانه ويوظفه.",
      "يتعرف الحال وصاحبها ويوظف الحال في جملة صحيحة.",
      "يخطط لخطبة محفلية ويكتبها ويراجعها.",
      "يلقي خطبة قصيرة بوضوح وتسلسل وثقة."
    ],
    "expectedOutcome": "طالب قادر على قراءة قضايا الحقوق والواجبات وتحليلها، وتوظيف مهارات الوحدة اللغوية في الكتابة والتواصل.",
    "lessons": [
      {
        "id": "u1-l01",
        "order": 1,
        "type": "unit_entry",
        "title": "مدخل الوحدة: وصية ذي الإصبع العدواني وقصيدة أمية بن أبي الصلت",
        "estimatedMinutes": 20,
        "difficulty": "تمهيدي",
        "summary": "تهيئة موضوعية ولغوية لمجال الحقوق والواجبات وربط خبرة الطالب السابقة بنصوص الوحدة.",
        "objectives": [
          "يحدد موضوع الوحدة من شواهد المدخل.",
          "يستخرج قيمة أو حقًا أو واجبًا من كل نص مع شاهد.",
          "يفرق بين الفكرة الرئيسة والتفصيل الداعم."
        ],
        "prerequisites": [
          "مفاهيم الفكرة الرئيسة والقيمة والسياق"
        ],
        "learningPoints": [
          "مفهوم الحق والواجب",
          "استخراج القيمة من النص",
          "الفكرة الرئيسة والدليل"
        ],
        "activities": [
          "تصنيف بطاقات إلى حقوق/واجبات",
          "تحديد شاهد نصي يدعم قيمة"
        ],
        "resources": [
          "نص مبسط",
          "بطاقات تفاعلية",
          "صوت اختياري"
        ],
        "assessment": {
          "itemCount": 5,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يبدأ الطالب الوحدة بخريطة مفاهيم واضحة للحقوق والواجبات."
      },
      {
        "id": "u1-l02",
        "order": 2,
        "type": "listening",
        "title": "نص الاستماع: فئات تكلؤها عين الشريعة",
        "estimatedMinutes": 22,
        "difficulty": "متوسط",
        "summary": "تنمية الاستماع المركز واستخراج الأفكار والقيم والفئات الواردة في النص.",
        "objectives": [
          "يحدد الفكرة العامة بعد الاستماع.",
          "يصنف الأفكار إلى رئيسة وفرعية.",
          "يستدل من المسموع على قيمة أو حق.",
          "يلخص المسموع في عبارات موجزة."
        ],
        "prerequisites": [
          "آداب الاستماع",
          "تمييز الفكرة الرئيسة"
        ],
        "learningPoints": [
          "الاستماع لغرض محدد",
          "تسجيل الكلمات المفتاحية",
          "تصنيف الأفكار",
          "الاستدلال من المسموع"
        ],
        "activities": [
          "استماع مجزأ مع سؤال بعد كل مقطع",
          "بناء خريطة ذهنية من كلمات مفتاحية"
        ],
        "resources": [
          "تسجيل صوتي قصير",
          "نص بديل مكتوب بعد انتهاء التحقق"
        ],
        "assessment": {
          "itemCount": 6,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يستخرج الطالب المعنى الرئيس والدلالات المهمة من نص مسموع دون الاعتماد على النص المكتوب."
      },
      {
        "id": "u1-l03",
        "order": 3,
        "type": "reading",
        "title": "الفهم القرائي: وقضى ربك",
        "estimatedMinutes": 28,
        "difficulty": "متوسط",
        "summary": "قراءة تحليلية للنص واستخراج الحقوق والأوامر والنواهي والقيم مع الشاهد.",
        "objectives": [
          "يفسر مفردات مختارة من السياق.",
          "يستخرج أمرًا ونهيًا ويبين دلالتهما.",
          "يحدد حقوق الوالدين وذوي القربى وغيرها مع شاهد.",
          "يستنتج قيمة ضمنية من النص ويدعمها بدليل."
        ],
        "prerequisites": [
          "المعنى السياقي",
          "الأمر والنهي بصورة عامة"
        ],
        "learningPoints": [
          "المفردة في السياق",
          "الأوامر والنواهي",
          "الحقوق وشواهدها",
          "الاستنتاج والدليل"
        ],
        "activities": [
          "تظليل الشاهد داخل النص",
          "مطابقة الحق بالشاهد",
          "سؤال استدلال قصير"
        ],
        "resources": [
          "نص قابل للتحديد",
          "قاموس مصغر",
          "منظم أدلة"
        ],
        "assessment": {
          "itemCount": 8,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يحلل الطالب النص ويستشهد منه بدل الاكتفاء بالإجابة العامة."
      },
      {
        "id": "u1-l04",
        "order": 4,
        "type": "reading_strategy",
        "title": "إستراتيجية القراءة: حقوق الأشخاص ذوي الإعاقة",
        "estimatedMinutes": 24,
        "difficulty": "متوسط",
        "summary": "استخدام الأسئلة قبل وأثناء وبعد القراءة لزيادة التركيز والفهم.",
        "objectives": [
          "يحول العنوان أو الفقرة إلى سؤال مناسب.",
          "يجيب عن السؤال من النص بدليل.",
          "يلخص الحقوق الواردة في منظم مختصر.",
          "يميز السؤال الذي تساعد الفقرة على الإجابة عنه."
        ],
        "prerequisites": [
          "تحديد الفكرة الرئيسة",
          "صياغة سؤال واضح"
        ],
        "learningPoints": [
          "سؤال قبل القراءة",
          "سؤال أثناء القراءة",
          "البحث عن الدليل",
          "تلخيص الحقوق"
        ],
        "activities": [
          "مولد أسئلة من العناوين",
          "سحب الدليل إلى السؤال المناسب"
        ],
        "resources": [
          "نص مقسم إلى فقرات",
          "بطاقات أسئلة",
          "منظم تلخيص"
        ],
        "assessment": {
          "itemCount": 6,
          "cognitiveLevels": [
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يستخدم الطالب السؤال أداة للفهم وليس مجرد نشاط بعد القراءة."
      },
      {
        "id": "u1-l05",
        "order": 5,
        "type": "literary",
        "title": "التحليل الأدبي: دَيْن الكريم",
        "estimatedMinutes": 28,
        "difficulty": "متقدم",
        "summary": "فهم الألفاظ والصور والقيم في النص الأدبي وربطها بالمعنى الكلي.",
        "objectives": [
          "يفسر ألفاظًا مختارة من السياق.",
          "يحدد الفكرة أو القيمة التي يعبر عنها البيت.",
          "يستنتج دلالة تعبير أدبي.",
          "يدعم رأيه في معنى البيت بشاهد لفظي."
        ],
        "prerequisites": [
          "المعنى السياقي",
          "الفكرة الرئيسة",
          "أساسيات التذوق الأدبي"
        ],
        "learningPoints": [
          "المفردات",
          "المعنى الإجمالي",
          "القيم",
          "الدلالة الأدبية"
        ],
        "activities": [
          "اختيار المعنى من السياق",
          "ربط البيت بالقيمة",
          "شرح بيت بأسلوب الطالب"
        ],
        "resources": [
          "أبيات مختارة ضمن حدود العرض",
          "صوت إلقاء",
          "معجم مصغر"
        ],
        "assessment": {
          "itemCount": 7,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "ينتقل الطالب من شرح المفردة إلى تفسير دلالة البيت وقيمته."
      },
      {
        "id": "u1-l06",
        "order": 6,
        "type": "spelling",
        "title": "الرسم الإملائي: الألف اللينة في الأفعال الثلاثية",
        "estimatedMinutes": 22,
        "difficulty": "متوسط",
        "summary": "تحديد أصل الألف اللينة في الفعل الثلاثي وكتابتها بالصورة الصحيحة.",
        "objectives": [
          "يميز الألف اللينة في آخر الفعل الثلاثي.",
          "يحدد أصل الألف بطريقة مناسبة.",
          "يكتب الفعل كتابة صحيحة.",
          "يعلل اختيار الألف القائمة أو المقصورة."
        ],
        "prerequisites": [
          "الفعل الماضي والمضارع",
          "تمييز حروف العلة"
        ],
        "learningPoints": [
          "موضع الألف اللينة",
          "كشف الأصل",
          "ا/ى",
          "التعليل"
        ],
        "activities": [
          "تحويل الفعل للكشف عن الأصل",
          "تصحيح كلمات مكتوبة خطأ"
        ],
        "resources": [
          "بطاقات أفعال",
          "جدول قاعدة/مثال"
        ],
        "assessment": {
          "itemCount": 7,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يكتب الطالب الأفعال الثلاثية المستهدفة كتابة صحيحة مع تعليل مختصر."
      },
      {
        "id": "u1-l07",
        "order": 7,
        "type": "handwriting",
        "title": "الرسم الكتابي: رسم (ل، لا) بخط الرقعة",
        "estimatedMinutes": 18,
        "difficulty": "تمهيدي",
        "summary": "التدرب على الشكل الصحيح للحرفين منفصلين ومتصلين وفي موضعهما على السطر.",
        "objectives": [
          "يميز الشكل الصحيح لـ(ل، لا) في خط الرقعة.",
          "يحاكي النموذج بنسبة ضبط مقبولة.",
          "يحافظ على موضع الحرف واتزانه على السطر."
        ],
        "prerequisites": [
          "مسك القلم واتجاه الكتابة",
          "أساسيات خط الرقعة"
        ],
        "learningPoints": [
          "الشكل",
          "الاتصال",
          "موضع السطر"
        ],
        "activities": [
          "تتبع نموذجي",
          "اختيار النموذج الأدق",
          "كتابة قصيرة يراجعها الطالب ذاتيًا"
        ],
        "resources": [
          "نموذج متجه واضح",
          "مساحة كتابة أو ورقة PDF"
        ],
        "assessment": {
          "itemCount": 3,
          "cognitiveLevels": [
            "application"
          ],
          "scoring": "rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true,
          "rubricId": "handwriting"
        },
        "expectedOutcome": "ينتج الطالب كتابة مقروءة ومتزنة للحرفين في كلمات قصيرة."
      },
      {
        "id": "u1-l08",
        "order": 8,
        "type": "morphology",
        "title": "الصنف اللغوي: اسم الفاعل",
        "estimatedMinutes": 28,
        "difficulty": "متوسط",
        "summary": "التعرف على اسم الفاعل وصياغته من الثلاثي وغير الثلاثي وتوظيفه.",
        "objectives": [
          "يعرف اسم الفاعل بوصفه دالًا على من قام بالفعل.",
          "يصوغ اسم الفاعل من الفعل الثلاثي.",
          "يصوغه من الفعل غير الثلاثي.",
          "يستخرجه من سياق ويوظفه في جملة جديدة."
        ],
        "prerequisites": [
          "الفعل الثلاثي وغير الثلاثي",
          "المضارع"
        ],
        "learningPoints": [
          "المفهوم",
          "الثلاثي على وزن فاعل",
          "غير الثلاثي من المضارع",
          "الاستخدام في السياق"
        ],
        "activities": [
          "تحويل أفعال إلى أسماء فاعلين",
          "تمييز اسم الفاعل داخل جمل",
          "بناء جملة"
        ],
        "resources": [
          "مخطط اشتقاق",
          "أمثلة تفاعلية"
        ],
        "assessment": {
          "itemCount": 8,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "لا يكتفي الطالب بالحفظ؛ بل يشتق اسم الفاعل ويستخدمه."
      },
      {
        "id": "u1-l09",
        "order": 9,
        "type": "style",
        "title": "الأسلوب اللغوي: القسم",
        "estimatedMinutes": 22,
        "difficulty": "متوسط",
        "summary": "تمييز أسلوب القسم وتحديد أركانه وبناء جملة قسم صحيحة.",
        "objectives": [
          "يميز جملة القسم من غيرها.",
          "يحدد أداة القسم والمقسم به وجواب القسم.",
          "يفسر وظيفة القسم في سياق قصير.",
          "ينشئ جملة قسم سليمة."
        ],
        "prerequisites": [
          "الجملة الاسمية والفعلية بصورة عامة"
        ],
        "learningPoints": [
          "أداة القسم",
          "المقسم به",
          "جواب القسم",
          "الغرض"
        ],
        "activities": [
          "تلوين أركان القسم",
          "إكمال جملة قسم",
          "إنشاء مثال"
        ],
        "resources": [
          "أمثلة قصيرة",
          "مخطط أركان"
        ],
        "assessment": {
          "itemCount": 6,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يحدد الطالب أركان القسم ويستخدم الأسلوب بصورة صحيحة."
      },
      {
        "id": "u1-l10",
        "order": 10,
        "type": "grammar",
        "title": "الوظيفة النحوية: الحال",
        "estimatedMinutes": 26,
        "difficulty": "متوسط",
        "summary": "فهم الحال بوصفه وصفًا يبين هيئة صاحبه وقت وقوع الفعل.",
        "objectives": [
          "يحدد الحال في جملة.",
          "يحدد صاحب الحال.",
          "يستخدم سؤال «كيف؟» للاستدلال على الحال.",
          "يضع حالًا مناسبًا في سياق جديد."
        ],
        "prerequisites": [
          "الاسم المنصوب بصورة عامة",
          "الفعل والفاعل"
        ],
        "learningPoints": [
          "معنى الحال",
          "صاحب الحال",
          "علامة الاستدلال",
          "التوظيف"
        ],
        "activities": [
          "تحديد الحال وصاحبها",
          "تحويل معنى إلى جملة فيها حال"
        ],
        "resources": [
          "جمل سياقية",
          "مخطط كيف وقع الفعل؟"
        ],
        "assessment": {
          "itemCount": 7,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يستخرج الطالب الحال ويفهم وظيفته الدلالية لا العلامة الشكلية فقط."
      },
      {
        "id": "u1-l11",
        "order": 11,
        "type": "writing_strategy",
        "title": "إستراتيجية الكتابة: العصف الذهني وما قبل الكتابة",
        "estimatedMinutes": 20,
        "difficulty": "متوسط",
        "summary": "توليد أفكار متعددة وتنظيمها قبل الشروع في كتابة الخطبة المحفلية.",
        "objectives": [
          "يحدد موضوع الكتابة وهدفها وجمهورها.",
          "يولد أفكارًا مناسبة باستخدام العصف الذهني.",
          "يصنف الأفكار ويحذف غير المرتبط.",
          "ينظم الأفكار في مخطط أولي."
        ],
        "prerequisites": [
          "تحديد الفكرة الرئيسة",
          "خبرة الوحدة في الحقوق والواجبات"
        ],
        "learningPoints": [
          "تحديد الغرض",
          "العصف الذهني",
          "فرز الأفكار",
          "التخطيط الأولي"
        ],
        "activities": [
          "مؤقت عصف ذهني",
          "سحب الأفكار إلى مقدمة/عرض/خاتمة"
        ],
        "resources": [
          "منظم ما قبل الكتابة",
          "قائمة فحص"
        ],
        "assessment": {
          "itemCount": 4,
          "cognitiveLevels": [
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يمتلك الطالب مخططًا واضحًا صالحًا للانتقال إلى كتابة الخطبة."
      },
      {
        "id": "u1-l12",
        "order": 12,
        "type": "writing",
        "title": "التواصل الكتابي: كتابة خطبة محفلية",
        "estimatedMinutes": 40,
        "difficulty": "متقدم",
        "summary": "التخطيط لخطبة محفلية ثم كتابة مسودة ومراجعتها وتنقيحها.",
        "objectives": [
          "يحدد المناسبة والجمهور والهدف.",
          "ينظم الخطبة إلى مقدمة وعرض وخاتمة.",
          "يوظف شواهد وأفكارًا مرتبطة بموضوع الوحدة.",
          "يراجع المسودة لغويًا وتنظيميًا قبل التسليم."
        ],
        "prerequisites": [
          "بناء الفقرة",
          "علامات الترقيم",
          "أفكار الوحدة"
        ],
        "learningPoints": [
          "ما قبل الكتابة",
          "بنية الخطبة",
          "المسودة",
          "المراجعة والتنقيح"
        ],
        "activities": [
          "عصف ذهني",
          "منظم مقدمة/عرض/خاتمة",
          "مراجعة ذاتية بقائمة فحص"
        ],
        "resources": [
          "قالب تخطيط",
          "روبرك كتابة",
          "نموذج قصير منشأ للمنصة"
        ],
        "assessment": {
          "itemCount": 1,
          "cognitiveLevels": [
            "application",
            "reasoning"
          ],
          "scoring": "rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true,
          "rubricId": "ceremonial_speech_writing"
        },
        "expectedOutcome": "ينتج الطالب خطبة مترابطة تحقق الغرض وتراعي بنية الفن الكتابي."
      },
      {
        "id": "u1-l13",
        "order": 13,
        "type": "speaking",
        "title": "التواصل الشفهي: إلقاء خطبة أمام طلاب المدرسة",
        "estimatedMinutes": 24,
        "difficulty": "متقدم",
        "summary": "تدريب الطالب على الإلقاء الواضح المتزن والتواصل مع الجمهور.",
        "objectives": [
          "يلقي النص بصوت مسموع وواضح.",
          "يوظف الوقفات والتنغيم بما يخدم المعنى.",
          "يحافظ على تسلسل الخطبة.",
          "يتواصل بصريًا ويظهر ثقة مناسبة."
        ],
        "prerequisites": [
          "إتمام الخطبة المكتوبة"
        ],
        "learningPoints": [
          "وضوح الصوت",
          "الوقفات",
          "التسلسل",
          "التواصل مع الجمهور"
        ],
        "activities": [
          "تسجيل تجريبي قصير",
          "تقييم ذاتي قبل التسليم"
        ],
        "resources": [
          "مؤقت",
          "روبرك إلقاء",
          "تعليمات تسجيل"
        ],
        "assessment": {
          "itemCount": 1,
          "cognitiveLevels": [
            "application"
          ],
          "scoring": "rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true,
          "rubricId": "speech_delivery"
        },
        "expectedOutcome": "يقدم الطالب خطبة مفهومة ومنظمة وفق معايير أداء واضحة."
      },
      {
        "id": "u1-l14",
        "order": 14,
        "type": "enrichment",
        "title": "النص الإثرائي: حقوق المرضى ومسؤولياتهم",
        "estimatedMinutes": 18,
        "difficulty": "متوسط",
        "summary": "توسيع فهم مفهوم الحقوق والمسؤوليات في سياق حياتي جديد.",
        "objectives": [
          "يستخرج حقًا ومسؤولية من النص.",
          "يقارن بين الحق والمسؤولية.",
          "ينقل الفكرة إلى موقف حياتي جديد."
        ],
        "prerequisites": [
          "مفاهيم الحقوق والواجبات"
        ],
        "learningPoints": [
          "الحق",
          "المسؤولية",
          "التطبيق الحياتي"
        ],
        "activities": [
          "موقف واتخاذ قرار",
          "مقارنة في جدول"
        ],
        "resources": [
          "نص إثرائي مختصر"
        ],
        "assessment": {
          "itemCount": 4,
          "cognitiveLevels": [
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "ينقل الطالب تعلم الوحدة إلى موقف حياتي جديد."
      }
    ]
  },
  {
    "id": "u2",
    "order": 2,
    "title": "أعلام معاصرون",
    "difficulty": "متدرج",
    "unitGoal": "أن يحلل الطالب سير أعلام معاصرين ونصوصًا مرتبطة بهم، ويطبق مهارات الوحدة في القراءة والصرف والأسلوب والنحو والكتابة.",
    "measurableObjectives": [
      "يفهم نصوص الأعلام المسموعة والمقروءة ويصنف أفكارها.",
      "يستخدم الرسوم الإيضاحية لزيادة التركيز والفهم.",
      "يكتب الألف اللينة في الأفعال غير الثلاثية كتابة صحيحة.",
      "يرسم (ك، م) بخط الرقعة رسمًا صحيحًا.",
      "يتعرف اسم المفعول ويصوغه ويوظفه.",
      "يتعرف أسلوب الشرط ويحدد أركانه ويوظفه.",
      "يتعرف التمييز ويميزه ويوظفه.",
      "يكتب سيرة غيرية منظمة من معلومات موثقة.",
      "يعرض رأيه بلغة مهذبة ودقيقة."
    ],
    "expectedOutcome": "طالب قادر على قراءة السيرة وتحليل الشخصية وكتابة سيرة غيرية موظفًا مهارات لغوية صحيحة.",
    "lessons": [
      {
        "id": "u2-l01",
        "order": 1,
        "type": "unit_entry",
        "title": "مدخل الوحدة: واخالداه!، بنت الشاطئ",
        "estimatedMinutes": 20,
        "difficulty": "تمهيدي",
        "summary": "تهيئة لمجال الأعلام المعاصرين واستكشاف صفات الشخصية المؤثرة.",
        "objectives": [
          "يحدد سمة بارزة لشخصية من شواهد النص.",
          "يفرق بين المعلومة والرأي حول الشخصية.",
          "يربط الإنجاز بالقيمة أو الصفة الداعمة له."
        ],
        "prerequisites": [
          "الفكرة الرئيسة",
          "الدليل"
        ],
        "learningPoints": [
          "العلم المعاصر",
          "السمة والشاهد",
          "المعلومة والرأي"
        ],
        "activities": [
          "بطاقة شخصية",
          "ربط الإنجاز بالصفة"
        ],
        "resources": [
          "نصوص قصيرة",
          "بطاقات"
        ],
        "assessment": {
          "itemCount": 5,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يبني الطالب إطارًا لفهم السيرة والشخصية."
      },
      {
        "id": "u2-l02",
        "order": 2,
        "type": "listening",
        "title": "نص الاستماع: حمد الجاسر علامة الجزيرة",
        "estimatedMinutes": 23,
        "difficulty": "متوسط",
        "summary": "استماع مركز لسيرة علم وتصنيف الأفكار الرئيسة والفرعية والضمنية.",
        "objectives": [
          "يحدد الفكرة العامة.",
          "يصنف الأفكار المسموعة.",
          "يستخرج إنجازًا ودليله.",
          "يستنتج صفة للشخصية من المسموع."
        ],
        "prerequisites": [
          "مهارات الاستماع من الوحدة الأولى"
        ],
        "learningPoints": [
          "الكلمات المفتاحية",
          "تصنيف الأفكار",
          "الإنجاز والدليل",
          "الصفة المستنتجة"
        ],
        "activities": [
          "مخطط أثناء الاستماع",
          "اختيار الدليل المسموع"
        ],
        "resources": [
          "صوت",
          "منظم أفكار"
        ],
        "assessment": {
          "itemCount": 6,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يفهم الطالب السيرة المسموعة ويستدل منها."
      },
      {
        "id": "u2-l03",
        "order": 3,
        "type": "reading",
        "title": "الفهم القرائي: سلمان بن عبد العزيز ملك الحزم والعزم",
        "estimatedMinutes": 30,
        "difficulty": "متوسط",
        "summary": "تحليل نص سيرة واستخراج الأفكار والقيم والإنجازات والعلاقات بين المعلومات.",
        "objectives": [
          "يستخرج الأفكار الرئيسة والفرعية.",
          "يستنتج قيمة أو سمة من الدليل.",
          "يفسر علاقة بين موقف ونتيجة.",
          "يلخص فقرة بأسلوبه."
        ],
        "prerequisites": [
          "الأفكار الرئيسة والفرعية",
          "الدليل"
        ],
        "learningPoints": [
          "بنية السيرة",
          "الإنجاز",
          "السمة",
          "العلاقة والنتيجة"
        ],
        "activities": [
          "خط زمني",
          "دليل ← سمة",
          "تلخيص فقرة"
        ],
        "resources": [
          "نص مقسم",
          "خط زمني تفاعلي"
        ],
        "assessment": {
          "itemCount": 8,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يحلل الطالب السيرة ويبرهن على استنتاجاته من النص."
      },
      {
        "id": "u2-l04",
        "order": 4,
        "type": "reading_strategy",
        "title": "إستراتيجية قراءة: عبد الله بن إدريس، قافية الحياة",
        "estimatedMinutes": 24,
        "difficulty": "متوسط",
        "summary": "تنظيم المعلومات بصريًا باستخدام الرسوم الإيضاحية لزيادة التركيز والفهم.",
        "objectives": [
          "يختار منظمًا بصريًا مناسبًا للمعلومات.",
          "يمثل علاقات النص داخل الرسم.",
          "يسترجع فكرة من الرسم دون الرجوع للنص.",
          "يلخص الشخصية من المنظم."
        ],
        "prerequisites": [
          "تحديد الأفكار",
          "المنظمات البسيطة"
        ],
        "learningPoints": [
          "اختيار الرسم",
          "العلاقات",
          "التلخيص البصري"
        ],
        "activities": [
          "إكمال منظم ناقص",
          "تحويل فقرة إلى رسم"
        ],
        "resources": [
          "قوالب منظمات"
        ],
        "assessment": {
          "itemCount": 5,
          "cognitiveLevels": [
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يستخدم الطالب الرسم أداة للفهم والاسترجاع."
      },
      {
        "id": "u2-l05",
        "order": 5,
        "type": "literary",
        "title": "التحليل الأدبي: الجبل الأشم",
        "estimatedMinutes": 28,
        "difficulty": "متقدم",
        "summary": "تحليل المعاني والصور والقيم في نص أدبي عن شخصية مؤثرة.",
        "objectives": [
          "يفسر مفردات من السياق.",
          "يحدد الفكرة في أبيات مختارة.",
          "يفسر دلالة صورة أو تعبير.",
          "يربط صفة الممدوح بالشاهد."
        ],
        "prerequisites": [
          "التذوق الأدبي الأساسي"
        ],
        "learningPoints": [
          "المفردة",
          "الفكرة",
          "الصورة",
          "الصفة والشاهد"
        ],
        "activities": [
          "شرح بيت",
          "مطابقة الصفة بالشاهد"
        ],
        "resources": [
          "أبيات مختارة",
          "صوت إلقاء"
        ],
        "assessment": {
          "itemCount": 7,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يفسر الطالب المعنى الأدبي ويستدل عليه."
      },
      {
        "id": "u2-l06",
        "order": 6,
        "type": "spelling",
        "title": "الرسم الإملائي: الألف اللينة في الأفعال غير الثلاثية",
        "estimatedMinutes": 22,
        "difficulty": "متوسط",
        "summary": "تطبيق قاعدة رسم الألف اللينة في الأفعال غير الثلاثية.",
        "objectives": [
          "يميز الفعل غير الثلاثي.",
          "يطبق قاعدة رسم الألف اللينة.",
          "يستثني الحالات التي تتطلب انتباهًا.",
          "يصحح الخطأ ويعلله."
        ],
        "prerequisites": [
          "الألف اللينة في الأفعال الثلاثية",
          "تمييز عدد أحرف الفعل"
        ],
        "learningPoints": [
          "غير الثلاثي",
          "القاعدة",
          "الاستثناء",
          "التعليل"
        ],
        "activities": [
          "فرز أفعال",
          "تصحيح إملائي"
        ],
        "resources": [
          "بطاقات",
          "جدول قاعدة"
        ],
        "assessment": {
          "itemCount": 7,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يكتب الطالب الأفعال غير الثلاثية المستهدفة بصورة صحيحة."
      },
      {
        "id": "u2-l07",
        "order": 7,
        "type": "handwriting",
        "title": "الرسم الكتابي: رسم الحرفين (ك، م) بخط الرقعة",
        "estimatedMinutes": 18,
        "difficulty": "متوسط",
        "summary": "ضبط شكل الكاف والميم واتصالهما وموضعهما على السطر.",
        "objectives": [
          "يميز الشكل الصحيح.",
          "يحاكي الحرف منفردًا ومتصلاً.",
          "يحافظ على الاتزان والمسافات."
        ],
        "prerequisites": [
          "أساسيات خط الرقعة"
        ],
        "learningPoints": [
          "الشكل",
          "الاتصال",
          "المسافة والسطر"
        ],
        "activities": [
          "تتبع",
          "كتابة كلمات",
          "تقييم ذاتي"
        ],
        "resources": [
          "نموذج متجه",
          "ورقة PDF"
        ],
        "assessment": {
          "itemCount": 3,
          "cognitiveLevels": [
            "application"
          ],
          "scoring": "rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true,
          "rubricId": "handwriting"
        },
        "expectedOutcome": "ينتج الطالب كتابة رقعة أكثر وضوحًا واتزانًا."
      },
      {
        "id": "u2-l08",
        "order": 8,
        "type": "morphology",
        "title": "الصنف اللغوي: اسم المفعول",
        "estimatedMinutes": 28,
        "difficulty": "متوسط",
        "summary": "التعرف على اسم المفعول وصياغته من الثلاثي وغير الثلاثي وتوظيفه.",
        "objectives": [
          "يعرف دلالة اسم المفعول.",
          "يصوغه من الثلاثي.",
          "يصوغه من غير الثلاثي.",
          "يستخرجه ويوظفه في سياق."
        ],
        "prerequisites": [
          "المبني للمعلوم/المفعول بصورة عامة",
          "المضارع"
        ],
        "learningPoints": [
          "المفهوم",
          "مفعول من الثلاثي",
          "غير الثلاثي",
          "التوظيف"
        ],
        "activities": [
          "اشتقاق",
          "تمييز في جمل",
          "بناء جملة"
        ],
        "resources": [
          "مخطط اشتقاق"
        ],
        "assessment": {
          "itemCount": 8,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يشتق الطالب اسم المفعول ويستخدمه."
      },
      {
        "id": "u2-l09",
        "order": 9,
        "type": "style",
        "title": "الأسلوب اللغوي: الشرط",
        "estimatedMinutes": 25,
        "difficulty": "متوسط",
        "summary": "تمييز أسلوب الشرط وتحديد مكوناته وفهم العلاقة بين الشرط والجواب.",
        "objectives": [
          "يميز أسلوب الشرط.",
          "يحدد أداة الشرط وفعل الشرط وجوابه.",
          "يفسر العلاقة بين الشرط والنتيجة.",
          "ينشئ أسلوب شرط صحيحًا."
        ],
        "prerequisites": [
          "الفعل والجملة"
        ],
        "learningPoints": [
          "الأداة",
          "فعل الشرط",
          "جواب الشرط",
          "العلاقة المنطقية"
        ],
        "activities": [
          "تركيب جملة شرط",
          "مطابقة شرط بنتيجة"
        ],
        "resources": [
          "بطاقات تركيب"
        ],
        "assessment": {
          "itemCount": 7,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يبني الطالب جملة شرط ذات معنى صحيح."
      },
      {
        "id": "u2-l10",
        "order": 10,
        "type": "grammar",
        "title": "الوظيفة النحوية: التمييز",
        "estimatedMinutes": 27,
        "difficulty": "متقدم",
        "summary": "فهم وظيفة التمييز في إزالة الإبهام وتمييزه عن تراكيب قريبة.",
        "objectives": [
          "يحدد التمييز في الجملة.",
          "يبين ما أزال التمييز إبهامه.",
          "يميز التمييز من الحال في أمثلة مناسبة.",
          "يوظف تمييزًا في جملة جديدة."
        ],
        "prerequisites": [
          "الحال",
          "المنصوبات بصورة عامة"
        ],
        "learningPoints": [
          "الإبهام",
          "المميز",
          "التمييز والحال",
          "التوظيف"
        ],
        "activities": [
          "مقارنة حال/تمييز",
          "إكمال جمل"
        ],
        "resources": [
          "جدول مقارنة"
        ],
        "assessment": {
          "itemCount": 7,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يفهم الطالب الوظيفة الدلالية للتمييز ويستخدمه."
      },
      {
        "id": "u2-l11",
        "order": 11,
        "type": "writing_strategy",
        "title": "إستراتيجية الكتابة: التخطيط للموضوع",
        "estimatedMinutes": 22,
        "difficulty": "متوسط",
        "summary": "تحديد موضوع السيرة وهدفها ومصادرها وتنظيم المعلومات قبل الكتابة.",
        "objectives": [
          "يحدد الشخصية وغرض الكتابة.",
          "يحدد معلومات يحتاج إلى جمعها.",
          "يميز المصدر الأنسب للمعلومة.",
          "ينظم المعلومات في مخطط زمني/موضوعي."
        ],
        "prerequisites": [
          "الفكرة الرئيسة",
          "تمييز المصدر الموثوق"
        ],
        "learningPoints": [
          "الموضوع والهدف",
          "جمع المعلومات",
          "المصادر",
          "تنظيم المعلومات"
        ],
        "activities": [
          "اختيار مصدر مناسب",
          "بناء مخطط سيرة"
        ],
        "resources": [
          "قالب تخطيط",
          "بطاقة مصادر"
        ],
        "assessment": {
          "itemCount": 4,
          "cognitiveLevels": [
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "ينتج الطالب خطة سيرة غيرية قابلة للتحويل إلى مسودة."
      },
      {
        "id": "u2-l12",
        "order": 12,
        "type": "writing",
        "title": "التواصل الكتابي: كتابة سيرة غيرية",
        "estimatedMinutes": 45,
        "difficulty": "متقدم",
        "summary": "جمع معلومات موثقة عن علم معاصر وتنظيمها وكتابة سيرة غيرية ومراجعتها.",
        "objectives": [
          "يحدد الشخصية وغرض الكتابة.",
          "يجمع معلومات من مصادر موثوقة.",
          "ينظم الأحداث والمعلومات منطقيًا.",
          "يكتب مسودة سيرة غيرية.",
          "يراجع الدقة واللغة والتسلسل."
        ],
        "prerequisites": [
          "بناء الفقرة",
          "التخطيط الكتابي"
        ],
        "learningPoints": [
          "البحث",
          "التخطيط",
          "التسلسل",
          "المسودة",
          "المراجعة"
        ],
        "activities": [
          "بطاقة مصادر",
          "خط زمني",
          "مراجعة بقائمة فحص"
        ],
        "resources": [
          "قالب سيرة",
          "روبرك"
        ],
        "assessment": {
          "itemCount": 1,
          "cognitiveLevels": [
            "application",
            "reasoning"
          ],
          "scoring": "rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true,
          "rubricId": "biography_writing"
        },
        "expectedOutcome": "ينتج الطالب سيرة غيرية منظمة تستند إلى معلومات موثقة."
      },
      {
        "id": "u2-l13",
        "order": 13,
        "type": "communication",
        "title": "التواصل اللغوي: عرض الرأي والتلطف فيما يكتب",
        "estimatedMinutes": 22,
        "difficulty": "متوسط",
        "summary": "تقديم رأي واضح بلغة مهذبة مع تعليل مناسب.",
        "objectives": [
          "يصوغ رأيًا واضحًا.",
          "يدعم رأيه بسبب أو دليل.",
          "يستخدم عبارات تلطّف مناسبة.",
          "يفرق بين نقد الفكرة والإساءة للشخص."
        ],
        "prerequisites": [
          "التعليل",
          "آداب الحوار"
        ],
        "learningPoints": [
          "الرأي",
          "التعليل",
          "التلطف",
          "الاحترام"
        ],
        "activities": [
          "إعادة صياغة رأي حاد",
          "اختيار أفضل تعبير"
        ],
        "resources": [
          "مواقف قصيرة"
        ],
        "assessment": {
          "itemCount": 5,
          "cognitiveLevels": [
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يعبر الطالب عن رأيه باحترام وحجة."
      },
      {
        "id": "u2-l14",
        "order": 14,
        "type": "enrichment",
        "title": "النص الإثرائي: بين الإبداع والاجتهاد",
        "estimatedMinutes": 18,
        "difficulty": "متوسط",
        "summary": "قراءة إثرائية تربط الإنجاز بالإبداع والاجتهاد.",
        "objectives": [
          "يستخرج الفكرة الرئيسة.",
          "يقارن بين الإبداع والاجتهاد كما يعرضهما النص.",
          "يطبق الفكرة على مثال حياتي."
        ],
        "prerequisites": [
          "المقارنة",
          "الفكرة الرئيسة"
        ],
        "learningPoints": [
          "الإبداع",
          "الاجتهاد",
          "التطبيق"
        ],
        "activities": [
          "مقارنة",
          "موقف حياتي"
        ],
        "resources": [
          "نص إثرائي"
        ],
        "assessment": {
          "itemCount": 4,
          "cognitiveLevels": [
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يربط الطالب فكرة النص بسلوكه وتعلمه."
      }
    ]
  },
  {
    "id": "u3",
    "order": 3,
    "title": "أمن وازدهار",
    "difficulty": "متدرج",
    "unitGoal": "أن يفهم الطالب علاقة الأمن بالازدهار والمسؤولية المجتمعية، ويحلل نصوص الوحدة ويطبق مهاراتها اللغوية والكتابية والشفهية.",
    "measurableObjectives": [
      "يفهم نصوص الأمن والازدهار ويحلل الأفكار والقيم والأدلة.",
      "يستخدم إستراتيجية زيادة التركيز والفهم في نصوص طويلة.",
      "يرسم الكلمات الموصولة خطًّا وفق القاعدة المستهدفة.",
      "يرسم الحرف (هـ) بخط الرقعة رسمًا صحيحًا.",
      "يتعرف صيغ المبالغة ويميزها ويوظفها.",
      "يستخدم أسلوب التفضيل بصورة صحيحة.",
      "يتعرف المستثنى ويحدد أركانه ويوظفه.",
      "يبسط موجزًا إلى نص مترابط محافظًا على الفكرة.",
      "يتحاور مع المجموعة وفق آداب الحوار."
    ],
    "expectedOutcome": "طالب قادر على تحليل قضايا الأمن والمسؤولية وتوظيف مهارات الوحدة في الكتابة والحوار.",
    "lessons": [
      {
        "id": "u3-l01",
        "order": 1,
        "type": "unit_entry",
        "title": "مدخل الوحدة: وطن بلا إرهاب، الأمن مسؤولية الجميع",
        "estimatedMinutes": 22,
        "difficulty": "متوسط",
        "summary": "تهيئة لمفهوم الأمن والمسؤولية ودور الفرد والمجتمع.",
        "objectives": [
          "يستخرج فكرة رئيسة من كل نص.",
          "يفرق بين السلوك الذي يعزز الأمن والذي يهدده.",
          "يربط المسؤولية الفردية بأثرها المجتمعي."
        ],
        "prerequisites": [
          "الفكرة والدليل"
        ],
        "learningPoints": [
          "الأمن",
          "المسؤولية",
          "الأثر المجتمعي"
        ],
        "activities": [
          "تصنيف مواقف",
          "سبب ونتيجة"
        ],
        "resources": [
          "نصان قصيران",
          "بطاقات مواقف"
        ],
        "assessment": {
          "itemCount": 5,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يبني الطالب مفهومًا واضحًا للأمن بوصفه مسؤولية مشتركة."
      },
      {
        "id": "u3-l02",
        "order": 2,
        "type": "listening",
        "title": "نص الاستماع: العمل التطوعي",
        "estimatedMinutes": 22,
        "difficulty": "متوسط",
        "summary": "استخراج أفكار وفوائد وقيم من نص مسموع عن العمل التطوعي.",
        "objectives": [
          "يحدد الفكرة العامة.",
          "يستخرج فائدتين للعمل التطوعي.",
          "يستنتج قيمة من المسموع.",
          "يلخص المسموع."
        ],
        "prerequisites": [
          "مهارات الاستماع السابقة"
        ],
        "learningPoints": [
          "الكلمات المفتاحية",
          "الفوائد",
          "القيم",
          "التلخيص"
        ],
        "activities": [
          "استماع مجزأ",
          "منظم فوائد"
        ],
        "resources": [
          "صوت",
          "نص بديل بعد التحقق"
        ],
        "assessment": {
          "itemCount": 6,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يفهم الطالب المسموع ويحول معلوماته إلى خلاصات."
      },
      {
        "id": "u3-l03",
        "order": 3,
        "type": "reading",
        "title": "الفهم القرائي: ماضٍ عريق وحاضر متألق ومستقبل مشرق",
        "estimatedMinutes": 30,
        "difficulty": "متقدم",
        "summary": "تحليل نص يربط الماضي والحاضر والمستقبل واستخراج العلاقات والأدلة.",
        "objectives": [
          "يحدد الأفكار الرئيسة والفرعية.",
          "يفسر علاقة زمنية أو سببية.",
          "يستنتج قيمة وطنية من دليل.",
          "يلخص تطور الفكرة عبر الماضي والحاضر والمستقبل."
        ],
        "prerequisites": [
          "التلخيص",
          "العلاقات بين الأفكار"
        ],
        "learningPoints": [
          "التسلسل الزمني",
          "السبب والنتيجة",
          "الدليل",
          "التلخيص"
        ],
        "activities": [
          "خط زمني",
          "مطابقة دليل باستنتاج"
        ],
        "resources": [
          "نص مقسم",
          "خط زمني"
        ],
        "assessment": {
          "itemCount": 8,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يحلل الطالب بنية النص والعلاقات بين معلوماته."
      },
      {
        "id": "u3-l04",
        "order": 4,
        "type": "reading_strategy",
        "title": "إستراتيجية زيادة التركيز والفهم: دور المواطن في المحافظة على الأمن",
        "estimatedMinutes": 25,
        "difficulty": "متوسط",
        "summary": "تطبيق إستراتيجية منظمة لقراءة نص وظيفي واستخراج مسؤوليات المواطن.",
        "objectives": [
          "يضع أسئلة أو إشارات تساعده على التركيز.",
          "يحدد مسؤوليات وردت في النص.",
          "يميز الدليل من الرأي.",
          "يلخص دور المواطن في نقاط مرتبة."
        ],
        "prerequisites": [
          "الأسئلة أثناء القراءة",
          "الدليل"
        ],
        "learningPoints": [
          "غرض القراءة",
          "تحديد المسؤولية",
          "الدليل",
          "الملخص"
        ],
        "activities": [
          "قراءة مع توقفات",
          "خريطة مسؤوليات"
        ],
        "resources": [
          "نص",
          "منظم"
        ],
        "assessment": {
          "itemCount": 6,
          "cognitiveLevels": [
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يستخدم الطالب إستراتيجية قراءة قابلة للنقل إلى نصوص أخرى."
      },
      {
        "id": "u3-l05",
        "order": 5,
        "type": "literary",
        "title": "التحليل الأدبي: ضوء الأمن",
        "estimatedMinutes": 27,
        "difficulty": "متقدم",
        "summary": "تحليل نص أدبي يدور حول الأمن وآثاره.",
        "objectives": [
          "يفسر مفردات من السياق.",
          "يحدد الفكرة أو القيمة في الأبيات.",
          "يفسر صورة أو تعبيرًا.",
          "يربط الأمن بأثر ورد في النص."
        ],
        "prerequisites": [
          "التذوق الأدبي"
        ],
        "learningPoints": [
          "المفردة",
          "الفكرة",
          "الصورة",
          "الأثر"
        ],
        "activities": [
          "شرح بيت",
          "دليل وقيمة"
        ],
        "resources": [
          "أبيات مختارة",
          "إلقاء صوتي"
        ],
        "assessment": {
          "itemCount": 7,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يفسر الطالب المعنى الأدبي ويصل بين الصورة والقيمة."
      },
      {
        "id": "u3-l06",
        "order": 6,
        "type": "spelling",
        "title": "الرسم الإملائي: رسم بعض الكلمات الموصولة خطًّا",
        "estimatedMinutes": 22,
        "difficulty": "متوسط",
        "summary": "تمييز الكلمات أو التراكيب المستهدفة التي تكتب موصولة وتطبيقها في سياق.",
        "objectives": [
          "يتعرف الصور المستهدفة.",
          "يميز الموصول من المفصول.",
          "يكتب الكلمة أو التركيب صحيحًا.",
          "يصحح خطأ إملائيًا مع التعليل."
        ],
        "prerequisites": [
          "مبادئ الرسم الإملائي"
        ],
        "learningPoints": [
          "الموصول",
          "المفصول",
          "الاستخدام",
          "التصحيح"
        ],
        "activities": [
          "فرز",
          "تصحيح جمل"
        ],
        "resources": [
          "بطاقات كلمات"
        ],
        "assessment": {
          "itemCount": 7,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يطبق الطالب الرسم الصحيح في كتابة جديدة."
      },
      {
        "id": "u3-l07",
        "order": 7,
        "type": "handwriting",
        "title": "الرسم الكتابي: رسم الحرف (هـ) بخط الرقعة",
        "estimatedMinutes": 18,
        "difficulty": "متوسط",
        "summary": "ضبط شكل الهاء في أوضاعها المستهدفة بخط الرقعة.",
        "objectives": [
          "يميز الشكل الصحيح.",
          "يحاكي الحرف في أوضاع مختلفة.",
          "يحافظ على السطر والاتزان."
        ],
        "prerequisites": [
          "أساسيات الرقعة"
        ],
        "learningPoints": [
          "الشكل",
          "الاتصال",
          "السطر"
        ],
        "activities": [
          "تتبع",
          "كتابة كلمات"
        ],
        "resources": [
          "نموذج",
          "ورقة PDF"
        ],
        "assessment": {
          "itemCount": 3,
          "cognitiveLevels": [
            "application"
          ],
          "scoring": "rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true,
          "rubricId": "handwriting"
        },
        "expectedOutcome": "يرسم الطالب الهاء بوضوح واتزان."
      },
      {
        "id": "u3-l08",
        "order": 8,
        "type": "morphology",
        "title": "الصنف اللغوي: صيغ المبالغة",
        "estimatedMinutes": 28,
        "difficulty": "متقدم",
        "summary": "التعرف على صيغ المبالغة ودلالتها وأوزانها المستهدفة وتوظيفها.",
        "objectives": [
          "يفسر دلالة صيغة المبالغة.",
          "يميزها من اسم الفاعل في أمثلة مناسبة.",
          "يتعرف الأوزان المستهدفة.",
          "يوظف صيغة مبالغة في جملة."
        ],
        "prerequisites": [
          "اسم الفاعل",
          "الاشتقاق"
        ],
        "learningPoints": [
          "الدلالة",
          "الأوزان",
          "المقارنة باسم الفاعل",
          "التوظيف"
        ],
        "activities": [
          "تصنيف مشتقات",
          "بناء جمل"
        ],
        "resources": [
          "مخطط أوزان"
        ],
        "assessment": {
          "itemCount": 8,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يميز الطالب صيغة المبالغة ويستخدمها وفق المعنى."
      },
      {
        "id": "u3-l09",
        "order": 9,
        "type": "style",
        "title": "الأسلوب اللغوي: التفضيل",
        "estimatedMinutes": 24,
        "difficulty": "متوسط",
        "summary": "فهم أسلوب التفضيل وعناصر المقارنة واستخدامه.",
        "objectives": [
          "يميز أسلوب التفضيل.",
          "يحدد المفضل والمفضل عليه.",
          "يفسر معنى المقارنة.",
          "ينشئ جملة تفضيل سليمة."
        ],
        "prerequisites": [
          "المقارنة بين صفتين"
        ],
        "learningPoints": [
          "اسم التفضيل",
          "طرفا المقارنة",
          "المعنى",
          "التوظيف"
        ],
        "activities": [
          "تركيب مقارنة",
          "تصحيح استعمال"
        ],
        "resources": [
          "بطاقات أمثلة"
        ],
        "assessment": {
          "itemCount": 6,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يستخدم الطالب التفضيل بوضوح ودقة."
      },
      {
        "id": "u3-l10",
        "order": 10,
        "type": "grammar",
        "title": "الوظيفة النحوية: المستثنى",
        "estimatedMinutes": 28,
        "difficulty": "متقدم",
        "summary": "التعرف على أسلوب الاستثناء وتحديد المستثنى وأركان التركيب وتطبيقه.",
        "objectives": [
          "يميز أسلوب الاستثناء.",
          "يحدد المستثنى والمستثنى منه وأداة الاستثناء.",
          "يفسر معنى الاستثناء.",
          "يوظف تركيبًا صحيحًا في سياق جديد."
        ],
        "prerequisites": [
          "مكونات الجملة",
          "المنصوبات بصورة عامة"
        ],
        "learningPoints": [
          "الأركان",
          "الأداة",
          "المعنى",
          "التوظيف"
        ],
        "activities": [
          "تلوين الأركان",
          "إكمال استثناء",
          "إنشاء مثال"
        ],
        "resources": [
          "مخطط أركان"
        ],
        "assessment": {
          "itemCount": 7,
          "cognitiveLevels": [
            "knowledge",
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يحلل الطالب تركيب الاستثناء ويستخدمه."
      },
      {
        "id": "u3-l11",
        "order": 11,
        "type": "writing_strategy",
        "title": "إستراتيجية الكتابة: التخطيط لبسط الموجز",
        "estimatedMinutes": 22,
        "difficulty": "متوسط",
        "summary": "تفكيك الموجز إلى فكرته المركزية وتحديد التفاصيل التي يمكن إضافتها دون تغيير المعنى.",
        "objectives": [
          "يحدد الفكرة المركزية في الموجز.",
          "يميز التفاصيل المناسبة من غير المناسبة.",
          "يرتب التفاصيل في تسلسل منطقي.",
          "يبني مخططًا لبسط الموجز."
        ],
        "prerequisites": [
          "التلخيص",
          "بناء الفقرة"
        ],
        "learningPoints": [
          "الفكرة المركزية",
          "توليد التفاصيل",
          "الملاءمة",
          "التخطيط"
        ],
        "activities": [
          "فرز تفاصيل",
          "بناء مخطط توسع"
        ],
        "resources": [
          "منظم بسط الموجز",
          "قائمة فحص"
        ],
        "assessment": {
          "itemCount": 4,
          "cognitiveLevels": [
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يمتلك الطالب خطة تحافظ على الفكرة وتحدد تفاصيل التوسع."
      },
      {
        "id": "u3-l12",
        "order": 12,
        "type": "writing",
        "title": "التواصل الكتابي: بسط الموجز",
        "estimatedMinutes": 42,
        "difficulty": "متقدم",
        "summary": "توسيع موجز إلى نص مترابط دون تغيير الفكرة الأساسية.",
        "objectives": [
          "يحدد الفكرة المركزية في الموجز.",
          "يولد تفاصيل داعمة مناسبة.",
          "ينظم التفاصيل في فقرات مترابطة.",
          "يراجع النص للتأكد من بقاء المعنى الأصلي."
        ],
        "prerequisites": [
          "التلخيص",
          "بناء الفقرة"
        ],
        "learningPoints": [
          "الفكرة المركزية",
          "التفصيل",
          "الترابط",
          "المراجعة"
        ],
        "activities": [
          "مخطط توسع",
          "كتابة مسودة",
          "قائمة فحص"
        ],
        "resources": [
          "قالب بسط الموجز",
          "روبرك"
        ],
        "assessment": {
          "itemCount": 1,
          "cognitiveLevels": [
            "application",
            "reasoning"
          ],
          "scoring": "rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true,
          "rubricId": "expansion_writing"
        },
        "expectedOutcome": "ينتج الطالب نصًا أوسع يحافظ على الفكرة ويضيف تفاصيل ذات صلة."
      },
      {
        "id": "u3-l13",
        "order": 13,
        "type": "speaking",
        "title": "التواصل الشفهي: التحاور مع المجموعة",
        "estimatedMinutes": 24,
        "difficulty": "متوسط",
        "summary": "ممارسة الحوار المنظم والاستماع للآخر ودعم الرأي باحترام.",
        "objectives": [
          "يعرض رأيه بوضوح.",
          "ينصت للمتحدث ولا يقاطعه.",
          "يرد على الفكرة لا على الشخص.",
          "يدعم رأيه بسبب أو دليل."
        ],
        "prerequisites": [
          "آداب الحوار",
          "عرض الرأي"
        ],
        "learningPoints": [
          "الاستماع",
          "الدور",
          "التعليل",
          "الاحترام"
        ],
        "activities": [
          "حوار مصغر",
          "تقييم أقران مضبوط"
        ],
        "resources": [
          "بطاقة أدوار",
          "روبرك حوار"
        ],
        "assessment": {
          "itemCount": 1,
          "cognitiveLevels": [
            "application",
            "reasoning"
          ],
          "scoring": "rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true,
          "rubricId": "group_dialogue"
        },
        "expectedOutcome": "يشارك الطالب في حوار منظم ومحترم ومعلل."
      },
      {
        "id": "u3-l14",
        "order": 14,
        "type": "enrichment",
        "title": "النص الإثرائي: الأمن في أوسع معانيه",
        "estimatedMinutes": 18,
        "difficulty": "متوسط",
        "summary": "توسيع مفهوم الأمن إلى أبعاده المختلفة وربطه بالحياة اليومية.",
        "objectives": [
          "يستخرج بعدين للأمن من النص.",
          "يفسر أثر الأمن في الفرد أو المجتمع.",
          "يطبق المفهوم على موقف جديد."
        ],
        "prerequisites": [
          "مفاهيم الوحدة"
        ],
        "learningPoints": [
          "أبعاد الأمن",
          "الأثر",
          "التطبيق"
        ],
        "activities": [
          "خريطة أبعاد",
          "موقف حياتي"
        ],
        "resources": [
          "نص إثرائي"
        ],
        "assessment": {
          "itemCount": 4,
          "cognitiveLevels": [
            "application",
            "reasoning"
          ],
          "scoring": "auto_or_rubric",
          "masteryPercent": 85,
          "minimumCoreObjectivePercent": 80,
          "useFreshVariantsOnRetry": true
        },
        "expectedOutcome": "يوسع الطالب مفهوم الأمن ويطبقه خارج نص الدرس."
      }
    ]
  }
];

export const UNIT_CHECKPOINTS = {
  "readingListening": {
    "afterTypes": [
      "unit_entry",
      "listening",
      "reading",
      "reading_strategy",
      "literary"
    ],
    "requirement": "master_all_core_points"
  },
  "language": {
    "afterTypes": [
      "spelling",
      "handwriting",
      "morphology",
      "style",
      "grammar"
    ],
    "requirement": "master_all_core_points"
  },
  "performance": {
    "types": [
      "writing",
      "speaking",
      "communication"
    ],
    "requirement": "rubric_minimum_3_of_4_each_core_criterion"
  },
  "final": {
    "percent": 85,
    "minimumCoreObjectivePercent": 80,
    "freshItemsOnly": true
  }
};

export const DELIVERY_RULES = {
  "videoSeconds": {
    "min": 30,
    "max": 90
  },
  "printable": "PDF",
  "native": "HTML/JSON",
  "lmsExport": [
    "SCORM 2004"
  ],
  "analytics": [
    "xAPI-compatible events"
  ],
  "accessibility": "WCAG 2.2 AA",
  "retryMustUseFreshVariant": true,
  "unlockByMasteryNotByVisit": true
};
