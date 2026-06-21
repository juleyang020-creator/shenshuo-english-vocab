// Curated common English prefixes, suffixes, and Greek/Latin roots, with
// concise Chinese glosses. Used to surface morphology hints in the notes
// panel: "react = re-(再) + act(做)".
//
// Curation principles:
// - prefer well-attested affixes/roots that show up in CET-4/CET-6/考研 vocab
// - skip ambiguous 2-letter clusters (an-, en-, in-) that produce many false
//   positives unless they ride on a recognisable root
// - each entry shows a meaning + 1–2 example words

export const PREFIXES = [
  { form: 'un', meaning: '不;非;相反', examples: ['unhappy', 'undo'] },
  { form: 're', meaning: '再;重新;回', examples: ['return', 'review'] },
  { form: 'pre', meaning: '前;预先', examples: ['prepare', 'predict'] },
  { form: 'dis', meaning: '不;相反;分离', examples: ['disagree', 'dismiss'] },
  { form: 'mis', meaning: '错误;坏', examples: ['mistake', 'misunderstand'] },
  { form: 'non', meaning: '非;无', examples: ['nonsense', 'nonstop'] },
  { form: 'over', meaning: '过度;在上', examples: ['overcome', 'overlook'] },
  { form: 'under', meaning: '不足;在下', examples: ['underestimate', 'underline'] },
  { form: 'sub', meaning: '在下;次;近乎', examples: ['submarine', 'subway'] },
  { form: 'super', meaning: '超过;上', examples: ['supervise', 'supermarket'] },
  { form: 'inter', meaning: '相互;之间', examples: ['interact', 'international'] },
  { form: 'intra', meaning: '内部', examples: ['intranet', 'intramural'] },
  { form: 'trans', meaning: '横过;转移', examples: ['transport', 'translate'] },
  { form: 'anti', meaning: '反对;抗', examples: ['antibody', 'antisocial'] },
  { form: 'auto', meaning: '自;自动', examples: ['automatic', 'autograph'] },
  { form: 'bi', meaning: '二;双', examples: ['bilingual', 'bicycle'], minLen: 5 },
  { form: 'tri', meaning: '三', examples: ['triangle', 'tripod'], minLen: 5 },
  { form: 'multi', meaning: '多', examples: ['multimedia', 'multiple'] },
  { form: 'poly', meaning: '多', examples: ['polygon', 'polymer'] },
  { form: 'mono', meaning: '单;一', examples: ['monopoly', 'monologue'] },
  { form: 'uni', meaning: '一;单', examples: ['unique', 'unify'], minLen: 5 },
  { form: 'co', meaning: '共;同', examples: ['cooperate', 'coexist'], minLen: 5 },
  { form: 'com', meaning: '共;一起', examples: ['combine', 'compose'] },
  { form: 'con', meaning: '共;一起;加强', examples: ['conduct', 'contain'] },
  { form: 'pro', meaning: '向前;赞成', examples: ['progress', 'promote'], minLen: 5 },
  { form: 'fore', meaning: '前;预先', examples: ['forecast', 'forehead'] },
  { form: 'post', meaning: '后', examples: ['postpone', 'postscript'] },
  { form: 'ex', meaning: '出;向外;前', examples: ['exit', 'export'], minLen: 4 },
  { form: 'extra', meaning: '超过;额外', examples: ['extraordinary'] },
  { form: 'micro', meaning: '微;小', examples: ['microscope', 'microwave'] },
  { form: 'macro', meaning: '宏大', examples: ['macroeconomics'] },
  { form: 'hyper', meaning: '超过;过度', examples: ['hyperactive'] },
  { form: 'mid', meaning: '中间', examples: ['midnight', 'midday'] },
  { form: 'semi', meaning: '半', examples: ['semicircle', 'semifinal'] },
  { form: 'tele', meaning: '远', examples: ['telephone', 'television'] },
  { form: 'auto', meaning: '自;自动', examples: ['automatic'] },
  { form: 'de', meaning: '去除;向下;反', examples: ['decrease', 'decode'], minLen: 5 },
  { form: 'en', meaning: '使;成为', examples: ['enable', 'enlarge'], minLen: 5 },
  { form: 'em', meaning: '使;放入', examples: ['embark', 'embed'], minLen: 5 },
  { form: 'a', meaning: '没有;在', examples: ['atypical', 'asleep'], minLen: 6 },
  { form: 'ad', meaning: '向;靠近', examples: ['adapt', 'advance'], minLen: 5 },
  { form: 'ab', meaning: '离开;远离', examples: ['absent', 'abnormal'], minLen: 5 },
  { form: 'in', meaning: '不;无;向内', examples: ['inactive', 'income'], minLen: 5 },
  { form: 'im', meaning: '不;无;向内', examples: ['impossible', 'import'], minLen: 5 },
  { form: 'il', meaning: '不;无 (用于 l 前)', examples: ['illegal', 'illogical'], minLen: 5 },
  { form: 'ir', meaning: '不;无 (用于 r 前)', examples: ['irregular', 'irrelevant'], minLen: 6 },
  { form: 'counter', meaning: '反;对抗', examples: ['counteract'] },
  { form: 'circum', meaning: '环绕', examples: ['circumstance'] },
];

export const SUFFIXES = [
  { form: 'tion', meaning: '动作;状态 (名词)', examples: ['nation', 'action'] },
  { form: 'sion', meaning: '动作;状态 (名词)', examples: ['decision', 'tension'] },
  { form: 'ation', meaning: '动作;结果 (名词)', examples: ['examination'] },
  { form: 'ment', meaning: '动作;结果 (名词)', examples: ['movement', 'argument'] },
  { form: 'ness', meaning: '性质;状态 (名词)', examples: ['kindness', 'darkness'] },
  { form: 'ity', meaning: '性质;状态 (名词)', examples: ['ability', 'reality'] },
  { form: 'ance', meaning: '性质;状态 (名词)', examples: ['distance', 'importance'] },
  { form: 'ence', meaning: '性质;状态 (名词)', examples: ['silence', 'patience'] },
  { form: 'hood', meaning: '身份;时期 (名词)', examples: ['childhood', 'neighborhood'] },
  { form: 'ship', meaning: '身份;关系 (名词)', examples: ['friendship', 'leadership'] },
  { form: 'dom', meaning: '领域;状态 (名词)', examples: ['kingdom', 'freedom'] },
  { form: 'ism', meaning: '主义;学说', examples: ['communism', 'realism'] },
  { form: 'ist', meaning: '从事…者', examples: ['artist', 'scientist'] },
  { form: 'er', meaning: '人;物 (名词)', examples: ['teacher', 'worker'], minLen: 5 },
  { form: 'or', meaning: '人;物 (名词)', examples: ['actor', 'editor'], minLen: 5 },
  { form: 'ee', meaning: '受…者', examples: ['employee', 'trainee'], minLen: 6 },
  { form: 'ant', meaning: '从事…者;…的', examples: ['assistant', 'important'], minLen: 5 },
  { form: 'ent', meaning: '从事…者;…的', examples: ['student', 'evident'], minLen: 5 },
  { form: 'able', meaning: '能…的;可…的', examples: ['readable', 'usable'] },
  { form: 'ible', meaning: '能…的;可…的', examples: ['visible', 'flexible'] },
  { form: 'ful', meaning: '充满…的', examples: ['careful', 'beautiful'] },
  { form: 'less', meaning: '没有…的', examples: ['hopeless', 'careless'] },
  { form: 'ous', meaning: '充满…的;…的', examples: ['famous', 'dangerous'] },
  { form: 'ive', meaning: '有…倾向的', examples: ['active', 'creative'] },
  { form: 'al', meaning: '关于…的', examples: ['national', 'natural'], minLen: 5 },
  { form: 'ic', meaning: '…的;关于…', examples: ['economic', 'magic'], minLen: 5 },
  { form: 'ish', meaning: '稍…的;…的', examples: ['childish', 'reddish'] },
  { form: 'ly', meaning: '…地 (副词)', examples: ['quickly', 'slowly'], minLen: 5 },
  { form: 'fy', meaning: '使…化', examples: ['simplify', 'classify'], minLen: 5 },
  { form: 'ify', meaning: '使…化', examples: ['clarify', 'identify'] },
  { form: 'ize', meaning: '使…化', examples: ['modernize', 'realize'], minLen: 5 },
  { form: 'ise', meaning: '使…化 (英)', examples: ['organise', 'realise'], minLen: 5 },
  { form: 'en', meaning: '使…;变…', examples: ['shorten', 'widen'], minLen: 5 },
  { form: 'ward', meaning: '向…方向', examples: ['forward', 'upward'] },
  { form: 'wise', meaning: '关于…;方式', examples: ['clockwise', 'otherwise'] },
];

// Latin/Greek roots commonly seen in academic vocabulary. We match these as
// substrings of the word, requiring the word to be at least 1 char longer than
// the root so the match is non-trivial.
export const ROOTS = [
  { root: 'act', meaning: '做;行动', examples: ['react', 'active'] },
  { root: 'aqu', meaning: '水', examples: ['aquarium', 'aquatic'] },
  { root: 'aud', meaning: '听', examples: ['audio', 'audience'] },
  { root: 'bene', meaning: '好;善', examples: ['benefit', 'beneficial'] },
  { root: 'bio', meaning: '生命', examples: ['biology', 'biography'] },
  { root: 'cap', meaning: '抓;头', examples: ['capture', 'capable'] },
  { root: 'capt', meaning: '抓住', examples: ['capture', 'captive'] },
  { root: 'ced', meaning: '走;让步', examples: ['proceed', 'recede'] },
  { root: 'ceed', meaning: '走;前进', examples: ['exceed', 'succeed'] },
  { root: 'cess', meaning: '走;让', examples: ['process', 'access'] },
  { root: 'cept', meaning: '拿;接', examples: ['accept', 'concept'] },
  { root: 'ceive', meaning: '拿;接收', examples: ['receive', 'perceive'] },
  { root: 'chron', meaning: '时间', examples: ['chronic', 'synchronize'] },
  { root: 'cid', meaning: '杀;落', examples: ['suicide', 'decide'] },
  { root: 'claim', meaning: '喊;声明', examples: ['exclaim', 'proclaim'] },
  { root: 'clud', meaning: '关闭', examples: ['conclude', 'include'] },
  { root: 'clos', meaning: '关闭', examples: ['close', 'enclose'] },
  { root: 'cred', meaning: '相信', examples: ['credit', 'incredible'] },
  { root: 'cycl', meaning: '环;圆', examples: ['cycle', 'bicycle'] },
  { root: 'demo', meaning: '人民', examples: ['democracy', 'demographic'] },
  { root: 'dict', meaning: '说', examples: ['predict', 'dictate'] },
  { root: 'duc', meaning: '引导', examples: ['educate', 'reduce'] },
  { root: 'duct', meaning: '引导', examples: ['conduct', 'product'] },
  { root: 'equ', meaning: '相等', examples: ['equal', 'equation'] },
  { root: 'fac', meaning: '做;制造', examples: ['factory', 'facile'] },
  { root: 'fact', meaning: '做;制造', examples: ['factor', 'manufacture'] },
  { root: 'fect', meaning: '做;制造', examples: ['effect', 'perfect'] },
  { root: 'fic', meaning: '做;使成为', examples: ['efficient', 'fiction'] },
  { root: 'fer', meaning: '搬运;承担', examples: ['transfer', 'refer'] },
  { root: 'flu', meaning: '流', examples: ['fluent', 'influence'] },
  { root: 'form', meaning: '形状', examples: ['reform', 'inform'] },
  { root: 'fort', meaning: '强;堡', examples: ['effort', 'comfort'] },
  { root: 'frag', meaning: '碎', examples: ['fragment', 'fragile'] },
  { root: 'gen', meaning: '产生;族', examples: ['generate', 'genetic'] },
  { root: 'geo', meaning: '土地;地球', examples: ['geography', 'geology'] },
  { root: 'graph', meaning: '写;画', examples: ['photograph', 'paragraph'] },
  { root: 'gram', meaning: '写;字母', examples: ['telegram', 'diagram'] },
  { root: 'gress', meaning: '走;步', examples: ['progress', 'aggressive'] },
  { root: 'hydr', meaning: '水', examples: ['hydrogen', 'hydraulic'] },
  { root: 'ject', meaning: '投;掷', examples: ['project', 'reject'] },
  { root: 'jud', meaning: '判断', examples: ['judge', 'prejudice'] },
  { root: 'junct', meaning: '连接', examples: ['junction', 'conjunction'] },
  { root: 'lect', meaning: '选;读', examples: ['select', 'collect'] },
  { root: 'leg', meaning: '法律;读', examples: ['legal', 'legislate'] },
  { root: 'liter', meaning: '字母', examples: ['literal', 'literature'] },
  { root: 'loc', meaning: '地点', examples: ['locate', 'local'] },
  { root: 'log', meaning: '说;言;理', examples: ['logic', 'dialogue'] },
  { root: 'logy', meaning: '…学', examples: ['biology', 'psychology'] },
  { root: 'lum', meaning: '光', examples: ['illuminate', 'luminous'] },
  { root: 'man', meaning: '手', examples: ['manual', 'manufacture'] },
  { root: 'mater', meaning: '母', examples: ['maternal', 'material'] },
  { root: 'mit', meaning: '送;放', examples: ['submit', 'permit'] },
  { root: 'miss', meaning: '送;放', examples: ['mission', 'dismiss'] },
  { root: 'mort', meaning: '死', examples: ['mortal', 'immortal'] },
  { root: 'mov', meaning: '移动', examples: ['move', 'remove'] },
  { root: 'mot', meaning: '移动', examples: ['motor', 'motion'] },
  { root: 'nov', meaning: '新', examples: ['novel', 'innovate'] },
  { root: 'ped', meaning: '脚;儿童', examples: ['pedal', 'pediatrician'] },
  { root: 'pend', meaning: '悬挂;称重', examples: ['depend', 'pendant'] },
  { root: 'pens', meaning: '挂;支付', examples: ['expense', 'suspense'] },
  { root: 'phil', meaning: '爱', examples: ['philosophy', 'philharmonic'] },
  { root: 'phon', meaning: '声音', examples: ['phone', 'symphony'] },
  { root: 'photo', meaning: '光', examples: ['photograph', 'photon'] },
  { root: 'plic', meaning: '折;重复', examples: ['replicate', 'complicate'] },
  { root: 'ply', meaning: '折;运用', examples: ['apply', 'multiply'] },
  { root: 'port', meaning: '搬运;港口', examples: ['transport', 'import'] },
  { root: 'pos', meaning: '放;摆', examples: ['compose', 'oppose'] },
  { root: 'pon', meaning: '放', examples: ['component', 'opponent'] },
  { root: 'psych', meaning: '心理', examples: ['psychology'] },
  { root: 'rupt', meaning: '破;裂', examples: ['interrupt', 'erupt'] },
  { root: 'scrib', meaning: '写', examples: ['describe', 'subscribe'] },
  { root: 'script', meaning: '写', examples: ['script', 'manuscript'] },
  { root: 'sect', meaning: '切;割', examples: ['section', 'insect'] },
  { root: 'sens', meaning: '感觉', examples: ['sense', 'sensitive'] },
  { root: 'sent', meaning: '感觉', examples: ['sentiment', 'consent'] },
  { root: 'sequ', meaning: '跟随', examples: ['sequence', 'consequence'] },
  { root: 'sign', meaning: '记号', examples: ['signal', 'design'] },
  { root: 'sist', meaning: '站;支持', examples: ['resist', 'consist'] },
  { root: 'soci', meaning: '同伴;社会', examples: ['social', 'associate'] },
  { root: 'sol', meaning: '太阳;单独', examples: ['solar', 'solitude'] },
  { root: 'son', meaning: '声音', examples: ['sonic', 'consonant'] },
  { root: 'spec', meaning: '看', examples: ['inspect', 'spectacle'] },
  { root: 'spect', meaning: '看', examples: ['respect', 'aspect'] },
  { root: 'spir', meaning: '呼吸', examples: ['inspire', 'respire'] },
  { root: 'spond', meaning: '回答;应允', examples: ['respond', 'correspond'] },
  { root: 'struct', meaning: '建造', examples: ['structure', 'construct'] },
  { root: 'tact', meaning: '触', examples: ['contact', 'tactile'] },
  { root: 'tain', meaning: '握;持', examples: ['contain', 'maintain'] },
  { root: 'ten', meaning: '握;持', examples: ['tenant', 'retain'] },
  { root: 'tend', meaning: '伸;延', examples: ['extend', 'tendency'] },
  { root: 'tens', meaning: '伸;紧张', examples: ['tense', 'extensive'] },
  { root: 'terr', meaning: '土地', examples: ['territory', 'terrain'] },
  { root: 'therm', meaning: '热', examples: ['thermal', 'thermometer'] },
  { root: 'tract', meaning: '拉;抽', examples: ['attract', 'extract'] },
  { root: 'urb', meaning: '城市', examples: ['urban', 'suburb'] },
  { root: 'vac', meaning: '空', examples: ['vacant', 'vacuum'] },
  { root: 'ven', meaning: '来', examples: ['convene', 'venue'] },
  { root: 'vent', meaning: '来', examples: ['event', 'prevent'] },
  { root: 'ver', meaning: '真;真实', examples: ['verify', 'verdict'] },
  { root: 'vert', meaning: '转;翻', examples: ['convert', 'reverse'] },
  { root: 'vers', meaning: '转;翻', examples: ['version', 'universe'] },
  { root: 'vid', meaning: '看', examples: ['video', 'evidence'] },
  { root: 'vis', meaning: '看', examples: ['vision', 'visible'] },
  { root: 'viv', meaning: '生;活', examples: ['vivid', 'survive'] },
  { root: 'vit', meaning: '生命', examples: ['vital', 'vitamin'] },
  { root: 'voc', meaning: '声;叫', examples: ['vocal', 'advocate'] },
  { root: 'vok', meaning: '叫;唤', examples: ['invoke', 'revoke'] },
  { root: 'volv', meaning: '滚;转', examples: ['evolve', 'involve'] },
];

function matchesPrefix(word, prefix) {
  if (!word.startsWith(prefix.form)) return false;
  const remaining = word.length - prefix.form.length;
  const min = prefix.minLen || prefix.form.length + 2;
  return word.length >= min && remaining >= 2;
}

function matchesSuffix(word, suffix) {
  if (!word.endsWith(suffix.form)) return false;
  const remaining = word.length - suffix.form.length;
  const min = suffix.minLen || suffix.form.length + 2;
  return word.length >= min && remaining >= 2;
}

function matchesRoot(word, root) {
  return word.length > root.root.length + 1 && word.includes(root.root);
}

export function analyseAffixes(rawWord) {
  if (!rawWord) return null;
  const word = String(rawWord).toLowerCase().replace(/[^a-z]/g, '');
  if (!word || word.length < 4) return null;

  // Prefer the longest matching prefix / suffix (e.g. "extra" over "ex").
  const prefixMatches = PREFIXES
    .filter((entry) => matchesPrefix(word, entry))
    .sort((a, b) => b.form.length - a.form.length);
  const suffixMatches = SUFFIXES
    .filter((entry) => matchesSuffix(word, entry))
    .sort((a, b) => b.form.length - a.form.length);

  // Roots are matched anywhere in the word; we keep up to 3 to keep the
  // notes panel compact.
  const rootMatches = ROOTS.filter((entry) => matchesRoot(word, entry)).slice(0, 3);

  const total = prefixMatches.length + suffixMatches.length + rootMatches.length;
  if (!total) return null;

  return {
    prefix: prefixMatches[0] || null,
    suffix: suffixMatches[0] || null,
    roots: rootMatches,
  };
}
