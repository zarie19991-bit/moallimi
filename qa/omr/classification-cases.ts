type Row=Record<string,any>;
export const classificationCases:{id:string;label:string;raw:Row;key:Row;context?:Row;reading:string;state:string;categories:string[]}[]=[
 {id:"clear-correct",label:"اختيار واضح ومطابق للمفتاح",raw:{status:"clear",selected:2,marked:[2]},key:{correct_index:2},reading:"clear",state:"correct",categories:[]},
 {id:"clear-incorrect",label:"اختيار واضح غير مطابق للمفتاح",raw:{status:"clear",selected:1,marked:[1]},key:{correct_index:2},reading:"clear",state:"incorrect",categories:[]},
 {id:"true-blank",label:"فقاعات فارغة متسقة",raw:{status:"blank",selected:null,marked:[]},key:{correct_index:2},reading:"blank",state:"blank",categories:[]},
 {id:"two-confirmed",label:"القارئ يثبت تظليل خيارين",raw:{status:"multiple",selected:null,marked:[0,2]},key:{correct_index:2},reading:"multiple",state:"multiple",categories:[]},
 {id:"two-candidates",label:"مرشحان غير محسومين؛ أحدهما يطابق المفتاح",raw:{status:"ambiguous",selected:2,marked:[0,2],confidence:1},key:{correct_index:2},reading:"ambiguous",state:"uncertain",categories:["reading"]},
 {id:"one-candidate",label:"مرشح واحد غير محسوم وثقة مرتفعة",raw:{status:"ambiguous",selected:2,marked:[2],confidence:1},key:{correct_index:2},reading:"ambiguous",state:"uncertain",categories:["reading"]},
 {id:"contradictory-clear",label:"واضح مع خيارين: تناقض وليس تعددًا مثبتًا",raw:{status:"clear",selected:2,marked:[0,2]},key:{correct_index:2},reading:"invalid",state:"uncertain",categories:["reading"]},
 {id:"unproven-multiple",label:"ادعاء تعدد مع خيار واحد فقط",raw:{status:"multiple",selected:2,marked:[2]},key:{correct_index:2},reading:"invalid",state:"uncertain",categories:["reading"]},
 {id:"contradictory-blank",label:"ادعاء فراغ مع اختيار محدد",raw:{status:"blank",selected:2,marked:[2]},key:{correct_index:2},reading:"invalid",state:"uncertain",categories:["reading"]},
 {id:"missing-key",label:"قراءة واضحة مع مفتاح مفقود",raw:{status:"clear",selected:2,marked:[2]},key:{},reading:"clear",state:"uncertain",categories:["answer_key"]},
 {id:"unverified-identity",label:"قراءة واضحة مع هوية غير مؤكدة",raw:{status:"clear",selected:2,marked:[2]},key:{correct_index:2},context:{identity_valid:false},reading:"clear",state:"uncertain",categories:["identity"]},
 {id:"incomplete-key",label:"مفتاح النموذج غير مكتمل",raw:{status:"clear",selected:2,marked:[2]},key:{correct_index:2},context:{key_complete:false},reading:"clear",state:"uncertain",categories:["answer_key"]},
 {id:"all-three-causes",label:"عدم حسم القراءة والهوية والمفتاح معًا",raw:{status:"ambiguous",selected:2,marked:[0,2]},key:{},context:{identity_valid:false,key_complete:false},reading:"ambiguous",state:"uncertain",categories:["reading","identity","answer_key"]},
 {id:"geometry-unverified",label:"علامات الورقة غير مؤكدة",raw:{status:"clear",selected:2,marked:[2]},key:{correct_index:2},context:{markers_ok:false},reading:"clear",state:"uncertain",categories:["reading"]},
 {id:"reader-failure",label:"فشل القارئ؛ ليست إجابة فارغة",raw:{status:"clear",selected:2,marked:[2]},key:{correct_index:2},context:{reader_error:true},reading:"unavailable",state:"uncertain",categories:["reading"]},
 {id:"reading-not-run",label:"القراءة لم تُنفذ",raw:{status:"blank",selected:null,marked:[]},key:{correct_index:2},context:{reading_not_run:true},reading:"unavailable",state:"uncertain",categories:["reading"]},
];
