// Display metadata only. Calendar calculations remain in the retained 6tail engine.
export const FESTIVAL_THEMES=[
 {id:'spring',name:'新春限定',mark:'春',title:'新岁启封，万事可期',description:'一页新历，一岁新光。',lunar:[1,1],colors:['#e8bd72','#481a20']},
 {id:'lantern',name:'元宵限定',mark:'灯',title:'灯火可亲，团圆有时',description:'把心愿，留给今夜的灯。',lunar:[1,15],colors:['#edc583','#3b202b']},
 {id:'dragon',name:'端午限定',mark:'舟',title:'仲夏安康，顺流而上',description:'粽叶清香，夏日悠长。',lunar:[5,5],colors:['#c6d5a0','#15342d']},
 {id:'qixi',name:'七夕限定',mark:'星',title:'星河有约，相逢有期',description:'把喜欢，说给值得的人听。',lunar:[7,7],colors:['#d4c5ed','#2c2540']},
 {id:'moon',name:'中秋限定',mark:'月',title:'月满人间，所念皆圆',description:'隔着山海，也共享一轮月。',lunar:[8,15],colors:['#efd7a4','#283044']},
 {id:'national',name:'国庆限定',mark:'山',title:'山河锦绣，出发有时',description:'把远方，慢慢走成日常。',solar:[10,1],colors:['#e3b46d','#422323']}
];
export function festivalInfo(key){const [y,m,d]=key.split('-').map(Number),solar=globalThis.Solar.fromYmd(y,m,d),lunar=solar.getLunar();const names=[...new Set([...solar.getFestivals(),...lunar.getFestivals()])];const theme=FESTIVAL_THEMES.find(t=>t.solar?t.solar[0]===m&&t.solar[1]===d:lunar.getMonth()>0&&t.lunar[0]===lunar.getMonth()&&t.lunar[1]===lunar.getDay());return {names,theme:theme||null};}
