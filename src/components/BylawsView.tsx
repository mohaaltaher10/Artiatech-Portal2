import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, set } from 'firebase/database';
import { UserProfile } from '../types';
import {
  Search,
  Printer,
  CheckCircle2,
  FileCheck,
  ExternalLink,
  Edit2,
  X,
  FileText
} from 'lucide-react';

export interface BylawArticle {
  id: number;
  title: string;
  subtitle: string;
  content: string[];
}

export interface BylawsViewProps {
  currentUser?: UserProfile;
  showToast?: (msg: string, type: 'success' | 'error') => void;
}

export const bylawsData: BylawArticle[] = [
  {
    id: 1,
    title: 'مادة (1) التعريف',
    subtitle: '',
    content: [
      '1. الكيان استوديو أرتياتك للأعمال الفنية والتقنية (Artiatech Studio)، كيان ناشئ يهدف إلى تطوير وإنشاء المحتوى والحلول الرقمية سواءً فنية أو تقنية.',
      '2. تأسس الاستوديو على يد محمد السعيدي وعبد الرؤوف زايد بتاريخ 21/12/2025، وتم إطلاق المنصة الرقمية بتاريخ 24/12/2025.',
      '3. تُعدّ جميع الأقسام الفنية والتقنية وحدات تشغيلية متكاملة تحت مظلة تنظيمية وقانونية واحدة.',
      '4. تسري أحكام هذه اللائحة التنفيذية على كافة المنتسبين للأستوديو بمختلف فئاتهم'
    ]
  },
  {
    id: 2,
    title: 'مادة (2) الهيكل التنظيمي',
    subtitle: '',
    content: [
      '1. الاستوديو فريق يتكون من قائد ونائب وأعضاء',
      '2. قائد الاستوديو المسؤول الإداري والتشغيلي عن تحديد التوجه الاستراتيجي وإدارة المشاريع وتمثيل الإستوديو اجتماعيا وقانونياً',
      '3. نائب القائد ينوب عن القائد في حال تفويضه أو غيابه، ويتولى الإشراف المباشر على التكليفات الميدانية',
      '4. العضو الأساسي: هو العضو الملتزم فعلياً بتنفيذ المهام التشغيلية، وله حقوق التصويت الداخلي والاستفادة من عوائد الاستوديو',
      '5. العضو المشارك / المساهم: هو العضو الملتزم بمشروع محدد أو مهمة مخصصة ذات إطار زمني معني، ولا يترتب عليه التزام دائم بنشاط الاستوديو.',
      '6. تجميد العضوية: حالة تجميد تُمنح على حسب رغبة العضو لمراعاة الظروف الأكاديمية أو الشخصية لفترة محددة، مع تعليق كافة صلاحيات وواجبات العضوية والالتزامات المترتبة عليها خلالها.'
    ]
  },
  {
    id: 3,
    title: 'مادة (3) الطبيعة التشغيلية والتنظيمية',
    subtitle: '',
    content: [
      '1. يتم تنفيذ القرارات اليومية والاتفاقيات والاعمال كل على حسب موقعه دون تداخل مع بقية الاعمال والمشاريع',
      '2. في حالة عدم إمكانية الوصول للقائد من أجل أي سبب من الأسباب التي تشترطها هذه اللائحة يتم التوجه تلقائياً ومباشرة الى النائب ثم إلى الاقدم فالأقدم',
      '3. ليتم تنفيذ إحدى القرارات او التعديلات التي تؤثر على أحد جوانب الاستوديو يجب ان يصوت جميع الأعضاء الأساسيين والمشاركين',
      '4. يعتبر القرار صالحاً بعد تصويت أغلبية الأعضاء المعنيين بالتصويت (الأغلبية = 66%)',
      '5. لا يتم تنفيذ القرار إن رفض 2 من الأساسيين أو أكثر',
      '6. لا يوجد فرق في صوت القائد او نائبه عن بقية الأصوات عند التصويت',
      '7. يتم تنفيذ المشاريع وتقسيم أعمالها الداخلية وإيراداتها (ان وجدت) والتحكم في سيرها على حسب ما يذكر في كتيب المشروع',
      '8. يتم اختيار مكان حفظ الأموال وموارد الاستوديو كالأجهزة والمعدات بالإجماع حصراً'
    ]
  },
  {
    id: 4,
    title: 'مادة (4) كتيب المشروع',
    subtitle: '',
    content: [
      '1. يُقصد بـ "كتيب المشروع" (أو الدليل التشغيلي للمشروع) وثيقة تنفيذية وتنظيمية، يُصدرها الاستوديو بشكل مستقل لكل عمل تجاري او إداري أو فني أو تقني.',
      '2. هدفه وغايته تحقيق المرونة التشغيلية (Operational Agility) وحسم توزيع الحقوق والمسؤوليات مسبقاً لكل مشروع.',
      '3. يتضمن كل كتيب مشروع صادر العناصر التالية:\n• نطاق العمل: التحديد الدقيق للمخرجات المطلوبة والمهام الفنية أو التقنية المسندة لكل عضو.\n• الجدول الزمني: المواعيد المحددة للتنفيذ والتسليم والمراحل التشغيلية.\n• الهيكل المالي وتوزيع العوائد (إن وجدت): تحديد التكلفة التشغيلية ونسبة الاستوديو ونسب التوزيع للمنفذين المشاركين فعلياً حسب حجم الإنجاز.\n• فريق التنفيذ والتكليفات: قائمة بأسماء الأعضاء المشاركين وصفتهم التشغيلية داخل المشروع.',
      '4. يُعتبر كتيب المشروع تابعاً للائحة الداخلية العامة للإستوديو؛ وتطبق على جميع المعنيين بالمشروع.',
      '5. لا يجوز لأي بند أو شرط وارد في كتيب المشروع أن يخالف الأحكام العامة للائحة الداخلية. وفي حال وجود أي تعارض، يُلغى البند المخالف ويُطبق نص اللائحة الداخلية.',
      '6. لا يصبح كتيب المشروع نافذاً إلا بعد مراجعته واكتفاء شروطه المالية والفنية، واعتماده رسمياً بعد التصويت.',
      '7. تُسجل حالة كل كتيب مشروع تحت إحدى الفئات التالية:\n• قيد الدراسة (Under Review): مسودة مشروع مقترحة لم تُعتمد فنياً أو مالياً بعد.\n• نشط / ساري (Active): كتيب معتمد رسميًا وجاري العمل والتنفيذ بموجبه.\n• قيد التعديل (Under Revision): مراجعة استثنائية لإعادة توزيع النسب أو تعديل المهام بناءً على مستجدات الميدان وبموافقة الإدارة.\n• مؤرشف / ملغى (Archived): مشروع تم تسليمه وإغلاقه أو توقف العمل به رسمياً.',
      '8. يتم تعديل الكتيب من قبل القائمين على المشروع إذا لزم الامر ويجب تبليغ الاستوديو قبل ذلك',
      '9. تُنتهى الصلاحية التشغيلية لكتيب المشروع ويُؤرشف بعد التصويت في الحالات التالية:\n• اكتمال المشروع وتسليم كافة مخرجاته وإنهائه طبقاً للكتيب.\n• ثبوت عدم جدوى المشروع أو تعثره ميدانياً بقرار ناتج من اجتماع.\n• إخلال القائمين على المشروع بالمعايير العامة والالتزامات الأخلاقية أو التقنية للإستوديو.',
      '10. يمكن لاي عضو من الاعضاء ان يقدم مقترح كتيب مشروع مع التأكد من موافاته لجميع الشروط من اجل ان يطرح للتصويت'
    ]
  },
  {
    id: 5,
    title: 'مادة (5) النظام المالي',
    subtitle: '',
    content: [
      '1. النظام المالي في الاستوديو مبني على مفهومين الخزينة وصندوق التوزيعات',
      '2. الخزينة هي صندوق المال العام للإستوديو وملكيته ومسؤوليته تكون باسم الاستوديو ولا يحق لاحد التصرف فيها بشكل فردي ويشمل ذلك صافي الكاش والمعدات سواء كانت ممنوحة بشكل دائم او مؤقت',
      '3. يمكن وضع صافي الكاش في أماكن متعددة سواء كانت في أمانة أحد الأعضاء او حسابات أو أرصدة في خدمات معينة',
      '4. المعدات والأصول المختلفة التي يحصل عليها الاستوديو سواء كانت ممنوحة بشكل دائم أو مؤقت يلتزم الاستوديو بالحفاظ عليها وصيانتها وعدم التفريط فيها',
      '5. إن تغيير أماكن حفظ محتويات الخزينة يشترط الإجماع من جميع الأعضاء الأساسيين',
      '6. أي تغيير طارئ في أماكن حفظ الأموال او أي تلف في المعدات او صرف غير محسوب لصافي الكاش يتم التبليغ عنه مباشرة لاتخاذ الاجراء المناسب وإدراك المشكلة مباشرة',
      '7. صندوق التوزيعات هو صندوق صرف المكافئات لأعضاء الاستوديو الأساسيين والمساهمين حسب الشروط المحددة مسبقا بينما العضو المجمد يستثنى من ذلك',
      '8. يتم صرف أموال صندوق التوزيعات بشكل كامل عند وصوله حداً عالياً او تصويت اغلبية أعضاء الاستوديو بذلك',
      '9. يتم تقسيم صندوق التوزيعات بنظام الأسهم على حسب ما تم تحديده مسبقاً في كتيبات المشروع التي عمل عليها أعضاء الاستوديو',
      '10. في حالات الطوارئ التي تلزم صرف أموال من الخزينة دون تصويت؛ يجب الإبلاغ في زمن قدره لا يتجاوز 48 ساعة',
      '11. يسمح بالتبرع سواء صندوق التوزيعات أو للصندوق التشغيلي دون إلتزامات من الاستوديو بعدها',
      '12. يتم الالتزام بحفظ سجل رسمي واحتياطي رقمي وورقي لكل العمليات المالية من إيرادات ومصاريف إلخ'
    ]
  },
  {
    id: 6,
    title: 'مادة (6) العضو الأساسي',
    subtitle: '',
    content: [
      '1. هو العضو الذي ساهم بتأسيس الاستوديو او يساهم بتشغيله حالياً ويلتزم بالحفاظ على حد أدنى من المساهمة الشهرية من ساعات عمل أو مهام محددة',
      '2. يحق للعضو الأساسي التصويت على القرارات والتعديلات وأماكن حفظ الموارد',
      '3. يتم ترسيم العضو أساسيا بعد طلبه ذلك أو تزكية من أحد الأعضاء الأساسيين ثم تصويت الاعضاء الأساسيين على ذلك'
    ]
  },
  {
    id: 7,
    title: 'مادة (7) العضو المشارك',
    subtitle: '',
    content: [
      '1. هو العضو الذي يتم إشراكه من خارج الاستوديو لعمل مهمة معينة أو مشروع معين أو انضم للإستوديو في فترة اختبار او تجريب أو شكل مؤقت',
      '2. لا تطبق عليه أي واجبات من الاستوديو غير متفق عليها',
      '3. يأخذ فائدته سواء معنوية أو مادية بشكل منفصل ولا علاقة له بصندوق التوزيعات',
      '4. يستشار العضو المشارك ويشارك في التصويتات المعنية له'
    ]
  },
  {
    id: 8,
    title: 'مادة (8) العضو المجمّد',
    subtitle: '',
    content: [
      '1. التجميد هو حالة تُمنح بناءً على طلب شخصي من العضو (أساسي أو مشارك) لأسباب خاصة، ويحدد مدته مسبقاً',
      '2. يجب تقديم طلب التجميد مسبقا وفي حالة عدم فعل ذلك يجب ان يلتزم العضو بالحد الأدنى من المسؤولية التي قد تترتب على ذلك',
      '3. يجب توضيح سبب التجميد عند طلبه ويمنح فقط بشكل افتراضي للأعضاء الذين ليس عليهم التزامات مشاريع نشطة.',
      '4. أثناء التجميد يُعلق حق العضو في التصويت وتُوقف جميع مهامه التشغيلية والواجبات المترتبة عليه كما يُستثنى تماماً من أي توزيعات مالية أو مكافآت عامة من "صندوق التوزيعات" خلال فترة التجميد.',
      '5. قد تترتب إجراءات تصل إلى إنهاء العضوية إذا انتهت فترة التجميد دون ان يعود العضو ودون ان يبلغ عن طلب للتمديد'
    ]
  },
  {
    id: 9,
    title: 'مادة (9) الاجتماعات',
    subtitle: '',
    content: [
      '1. الاجتماعات تنقسم إلى:\n• اجتماعات دورية: تُعقد بشكل منتظم لمتابعة سير العمل والمشاريع ويحضرها جميع الاعضاء.\n• اجتماعات طارئة: تُعقد عند الحاجة الملحة، بدعوة من أحد الاعضاء.\n• اجتماعات المشاريع: تُعقد لمناقشة كتيب مشروع محدد، ويحضرها المعنيون بذلك المشروع فقط.',
      '2. يجب توجيه الدعوة للاجتماع قبل موعده بـ 24 ساعة على الأقل. ويُحدد جدول الاجتماع مسبقاً ويُوزع على الأعضاء.',
      '3. ينعقد الاجتماع بشكل رسمي بحضور أغلبية الأعضاء الأساسيين إذا لم يتحقق ذلك، يُؤجل الاجتماع لمدة معينة ويُعقد بعدها بمن حضر ويعتبر ملزماً.',
      '4. يجب تدوين محضر لكل اجتماع يتضمن: الحاضرين، القرارات المتخذة، المهام الموزعة، والمواعيد النهائية. يُوقع المحضر من الحاضرين ويُحفظ في أرشيف الاستوديو.',
      '5. يشترط للغياب وجود عذر مقبول مع إخطار مسبق.',
      '6. الغياب المتكرر دون عذر يُحتسب ضمن تقييم التزام العضو.'
    ]
  },
  {
    id: 10,
    title: 'مادة (10) ضوابط الملكية الفكرية',
    subtitle: '',
    content: [
      '1. كل كود برمجي، تصميم، محتوى فني، رواية، لعبة، أو حساب رقمي يتم إنشاؤه باسم الاستوديو، أو باستخدام موارده، يُعتبر ملكاً حصرياً ونهائياً لأستوديو أرتياتك.',
      '2. يحتفظ العضو المنفذ بـ "حق نسبة الأرباح" المالية فقط حسب كتيب المشروع.',
      '3. لا يحق له بيع العمل، نقله، أو استخدامه في مشاريع شخصية خارج الاستوديو دون إذن كتابي (لا يعتد بالاتفاقات الشفهية)',
      '4. عند إنهاء العضوية لا يحق للعضو الاحتفاظ بأي من: الأكواد المصدرية، التصاميم، كلمات مرور الحسابات، أو قواعد البيانات.',
      '5. عند انهاء العضوبة يعتبر تسليم هذه الأصول شرط أساسي لإنهاء أي التزامات مالية مستحقة له.',
      '6. يستثنى من ذلك المشاريع الفردية الذاتية التي يقوم بها العضو تحت جناح الاستوديو حيث يكون حالتها (ترخيص مؤقت للإستوديو من اجل استغلالها)'
    ]
  },
  {
    id: 11,
    title: 'مادة (11) السلوك العام والإجراءات',
    subtitle: '',
    content: [
      '1. الاجراءات التي قد تحصل لأي عضو من أعضاء الاستوديو قائداً كان أو مشاركا أو أساسيا هي:\n• الفصل: إجراء شديد تنهى فيها جميع التزامات العضو للأستوديو وجميع مستحقات العضو من الاستوديو\n• التجميد الموقت: حالة موقتة لأسباب معينة تكون بشكل اختياري من قبل العضو أو كإجراء ضد الانذارات أو المخالفات\n• الانسحاب: هو طلب العضو للفصل بشكل اختياري',
      '2. يلتزم كل عضو بالأخلاق الحسنة والآداب العامة وحسن التعامل سواء مع زملائه او زبائنه او شركاء العمل الاخرين',
      '3. يلتزم كل عضو بالحفاظ على سمعة الاستوديو وأعضائه، وعدم التشهير أو الإساءة لأي عضو أو للأستوديو ككل.',
      '4. يُحظر تماماً أي هجوم شخصي علني ضد أي عضو أو ضد الاستوديو وفي حال ثبوت ذلك يتم تجميد عضوية العضو حتى يتم البت في أمره',
      '5. يُحظر إفشاء أي معلومات مالية، تقنية، أو إدارية خاصة بالأستوديو لأي طرف خارجي دون إذن.',
      '6. في حال مخالفة أي بند من هذه اللائحة أو كتيب المشروع، تُطبق العقوبات التالية بالترتيب:\n• الإنذارات: يُسجل في تاريخ العضو.\n• التجميد المؤقت: إيقاف الصلاحيات والأرباح لمدة لا تتجاوز 30 يوماً ليتم النظر في مشاكل هذا العضو من قبل الاستوديو\n• إنهاء العضوية: عند كثرة الإنذارات وفي فترة التجميد المؤقت إذا رأى أعضاء الاستوديو فصل هذا العضو يتم إخطار العضو بقرار الاستوديو، ويحق للعضو الاعتراض على القرار؛ في هذه الحالة يتم وضعه في فترة اختبار أخرى حتى يتم البت في أمره.'
    ]
  },
  {
    id: 12,
    title: 'مادة (12) حل النزاعات',
    subtitle: '',
    content: [
      '1. لا يسمح للأعضاء بالنزاع فيما بينهم وفي حالة حصول ذلك يتم محاولة حل المشكلة بشكل ودي وعن طريق الحوار',
      '2. في حال فشل ذلك يتم إيقاف لعضوين عن العمل المشترك ويطلبان وسيطا بينهما للحل المشكلة سواء كان من الاستوديو أو خارجها يرضى به كلاهما ويكون قراره ملزماً',
      '3. في حالة النزاعات الكبرى التي تتدخل فيه الجهات القانونية المختصة يتم تجميد عضوية كلا العضوين حتى تنتهي السلطات ويتم تخييرهما بين الفصل أو التنازل',
      '4. يتم فصل العضو تلقائيا ومباشرة دون إخطار في حالة ثبوت قيامه بجنحة أو عمل يمس الشرف أو الدين أو الأعراف أو قيامه بخطأ جسيم ضد الاستوديو بشكل متعمد',
      '5. يشترط قبل الانسحاب أو الفصل أن يتم العضو جميع المشاريع التي يعمل عليها حاليا وانهاء جميع التزامات الاستوديو المستحقة منه',
      '6. في حال رغبة العضو في الانسحاب يجب عليه الإبلاغ قبل ٣٠ يوماً من ذلك',
      '7. لا يمكن التصويت على فصل عضو إذ لم يتم تسجيل إنذارات عليه أو مخالفات',
      '8. يحق للأستوديو المطالبة بتعويض مالي عن أي أضرار مادية أو معنوية لحقت به بسبب تصرف متعمد من أحد أعضائه الحاليين أو السابقين.'
    ]
  },
  {
    id: 13,
    title: 'مادة (13) التعديل على اللائحة',
    subtitle: '',
    content: [
      '1. يمكن تعديل هذه اللائحة باقتراح من أي عضو من الأعضاء',
      '2. يجب إخطار جميع الأعضاء بالاقتراح',
      '3. يعتمد قرار التعديل عند تصويت (66%) + صوت القائد',
      '4. لا يُطبق التعديل بأثر رجعي على قرارات أو عقود سابقة.',
      '5. يجب إشعار جميع الأعضاء (الأساسيين والمشاركين) بالتعديلات المعتمدة قبل تنفيذها'
    ]
  },
  {
    id: 14,
    title: 'مادة (14) حل الاستوديو وإنهاؤه',
    subtitle: '',
    content: [
      '1. يتم حل الاستوديو بقرار إجماعي من جميع الأعضاء الأساسيين.',
      '2. عند الحل، تُباع أصول الاستوديو (معدات، أجهزة، حقوق رقمية) وتُسدَّد الديون والمستحقات أولاً ويوزع الباقي بالتساوي على الأعضاء الاساسيين',
      '3. تبقى جميع حقوق الملكية الفكرية (الأكواد، التصاميم، المحتوى) محفوظة، وتعود لمنفذيها الأصليين',
      '4. يجب إنهاء جميع العقود والاتفاقيات مع الجهات الخارجية قبل الحل الرسمي.',
      '5. يُحظر على أي عضو استخدام اسم الاستوديو أو أصوله بعد الحل.'
    ]
  }
];

export const BylawsView: React.FC<BylawsViewProps> = ({ currentUser, showToast }) => {
  const [search, setSearch] = useState('');
  
  // Signed Bylaws Image State
  const defaultSignedImage = 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80';
  const [signedBylawsUrl, setSignedBylawsUrl] = useState<string>(defaultSignedImage);
  const [showSignedModal, setShowSignedModal] = useState<boolean>(false);
  const [showEditSignedUrlModal, setShowEditSignedUrlModal] = useState<boolean>(false);
  const [inputSignedUrl, setInputSignedUrl] = useState<string>('');

  useEffect(() => {
    // Listen to signed bylaws image URL in RTDB
    const signedUrlRef = ref(db, 'bylaws_signed_image_url');
    const unsub = onValue(signedUrlRef, (snap) => {
      const val = snap.val();
      if (val && typeof val === 'string') {
        setSignedBylawsUrl(val);
      }
    });

    return () => unsub();
  }, []);

  const handleSaveSignedUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSignedUrl.trim()) return;
    try {
      const fullUrl = inputSignedUrl.trim().startsWith('http') || inputSignedUrl.trim().startsWith('data:') 
        ? inputSignedUrl.trim() 
        : `https://${inputSignedUrl.trim()}`;
      await set(ref(db, 'bylaws_signed_image_url'), fullUrl);
      if (showToast) showToast('تم تحديث رابط صورة مستند التوثيقات بنجاح ✓', 'success');
      setShowEditSignedUrlModal(false);
    } catch (err) {
      if (showToast) showToast('حدث خطأ أثناء حفظ رابط المستند', 'error');
    }
  };

  // Filter articles
  const filteredArticles = bylawsData.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(search.toLowerCase()) ||
      item.content.some((c) => c.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-5 font-['Cairo',sans-serif] dir-rtl max-w-5xl mx-auto">
      {/* Simple Header with (التوثيقات) button & Admin edit */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">اللائحة الداخلية - استوديو أرتياتك</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">النظام الأساسي والمواد التنفيذية الـ (14)</p>
        </div>

        <div className="flex items-center gap-2 no-print shrink-0">
          {/* Simple Button: (التوثيقات) */}
          <button
            onClick={() => setShowSignedModal(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <FileCheck className="w-4 h-4" />
            <span>(التوثيقات)</span>
          </button>

          {/* Admin Edit Button */}
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => {
                setInputSignedUrl(signedBylawsUrl);
                setShowEditSignedUrlModal(true);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1 border border-slate-300"
              title="تعديل رابط مستند التوثيقات"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>تعديل المستند</span>
            </button>
          )}

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1 border border-slate-300"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة</span>
          </button>
        </div>
      </div>

      {/* Simple Search Bar */}
      <div className="relative no-print">
        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="ابحث في مواد اللائحة الـ 14..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pr-10 pl-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:border-slate-800 focus:outline-none"
        />
      </div>

      {/* All 14 Articles List */}
      <div className="space-y-4">
        {filteredArticles.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8 font-bold">لا توجد مواد مطابقة للبحث</p>
        ) : (
          filteredArticles.map((article) => (
            <div
              key={article.id}
              className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-2.5"
            >
              <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">{article.title}</h3>
                  {article.subtitle && <p className="text-xs font-semibold text-slate-500 mt-0.5">{article.subtitle}</p>}
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                  مادة #{article.id}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-700 leading-relaxed font-medium">
                {article.content.map((line, idx) => (
                  <p key={idx} className="flex items-start gap-2 whitespace-pre-line">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="flex-1">{line}</span>
                  </p>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: View Signed Document Image (التوثيقات) */}
      {showSignedModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 dir-rtl animate-fadeIn no-print">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col p-5 shadow-2xl border border-slate-200 gap-4 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-slate-800" />
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  صورة مستند التوثيقات (توقيعات الأعضاء الأساسيين)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {currentUser?.role === 'admin' && (
                  <button
                    onClick={() => {
                      setInputSignedUrl(signedBylawsUrl);
                      setShowEditSignedUrlModal(true);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>تعديل الرابط</span>
                  </button>
                )}
                <a
                  href={signedBylawsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-800 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors"
                >
                  <span>فتح في تبويب جديد</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => setShowSignedModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-900 rounded-xl p-3 flex items-center justify-center min-h-[300px]">
              <img
                src={signedBylawsUrl}
                alt="توقيعات الأعضاء الأساسيين على اللائحة"
                className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-xl mx-auto"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="hidden flex-col items-center justify-center p-8 text-center text-slate-300 space-y-3">
                <FileText className="w-12 h-12 text-slate-400" />
                <p className="text-xs font-bold">تعذر تحميل الصورة مباشرة.</p>
                <a
                  href={signedBylawsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-slate-100 text-slate-900 font-bold text-xs rounded-lg flex items-center gap-2"
                >
                  <span>فتح الرابط مباشرة</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end border-t border-slate-200 shrink-0 text-xs font-bold">
              <button
                onClick={() => setShowSignedModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Signed Image URL (Admin) */}
      {showEditSignedUrlModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl animate-fadeIn no-print">
          <form onSubmit={handleSaveSignedUrl} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-900">تعديل رابط مستند التوثيقات</h3>
              <button type="button" onClick={() => setShowEditSignedUrlModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">رابط صورة مستند التوثيقات والتوقيعات</label>
              <input
                type="text"
                required
                placeholder="https://... أدخل رابط الصورة المباشر"
                value={inputSignedUrl}
                onChange={(e) => setInputSignedUrl(e.target.value)}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-800 focus:outline-none dir-ltr"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setShowEditSignedUrlModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow cursor-pointer active:scale-95"
              >
                حفظ الرابط
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
