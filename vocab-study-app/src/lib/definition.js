const DEFINITION_OVERRIDES = {
  aim: 'vt. 瞄准 vi./n. 目标;目的;志向',
  belongings: 'n. 财物;所有物',
  bloody: 'a. 流血的;血腥的;残忍的',
  brood: 'n. 一窝(雏鸟);一伙 vi. (over) 沉思;焦虑',
  candidate: 'n. 候选人;报考者;求职者',
  'cigaret(cte)': 'n. 香烟;纸烟',
  cigarette: 'n. 香烟;纸烟',
  commemorate: 'vt. 纪念;庆祝',
  contain: 'vt. 包含;容纳;抑制',
  continue: 'v. 继续;延续',
  contract: 'n. 合同;契约 v. 订约;收缩',
  destruction: 'n. 破坏;毁灭',
  difficulty: 'n. 困难;难题',
  distil: 'vt. 蒸馏;提炼;渗出',
  'distil(l)': 'vt. 蒸馏;提炼;渗出',
  eagle: 'n. 鹰;雕',
  eleventh: 'num. 第十一',
  excited: 'a. 兴奋的;激动的',
  footstep: 'n. 脚步;脚步声;足迹',
  forty: 'num. 四十',
  freight: 'n. 货运;货物;运费 vt. 装货;运输',
  frog: 'n. 青蛙',
  goose: 'n. 鹅;雌鹅',
  guy: 'n. 家伙;伙计',
  hail: 'n. 冰雹 vt. 招呼;欢呼;赞扬',
  hazard: 'n. 危险;危害 vt. 冒险',
  hello: 'int. 喂;你好',
  'hi/hey': 'int. 喂;嘿',
  hint: 'n./vt. 暗示;示意;提示',
  hero: 'n. 英雄;勇士;男主角',
  incur: 'vt. 招致;遭受',
  inertia: 'n. 惯性;惰性',
  investment: 'n. 投资;投入',
  island: 'n. 岛;岛屿',
  junk: 'n. 废旧物品;垃圾',
  jupiter: 'n. 木星',
  keen: 'a. 锋利的;敏锐的;热心的;渴望的',
  keyboard: 'n. 键盘',
  kidney: 'n. 肾;肾脏',
  kite: 'n. 风筝',
  knot: 'n. 结;绳结;海里/小时 vt. 打结',
  lately: 'ad. 最近;近来',
  length: 'n. 长度;一段',
  'living-room': 'n. 客厅',
  magic: 'n. 魔法;魔术 a. 魔法的;有魔力的',
  mass: 'n. 团;块;大量;群众;质量',
  mayor: 'n. 市长',
  might: 'aux. 可能;也许 n. 力量;威力',
  mine: 'pron. 我的 n. 矿;地雷 v. 采矿',
  minus: 'prep. 减去 a. 负的 n. 减号',
  monthly: 'a./ad. 每月(的) n. 月刊',
  nationalist: 'n./a. 民族主义者(的)',
  nearby: 'a./ad. 附近(的) prep. 在…附近',
  net: 'n. 网;网状物 a. 净的',
  northwest: 'n./a. 西北(的) ad. 向西北',
  oil: 'n. 油;石油 vt. 加油;润滑',
  overlook: 'vt. 忽视;俯瞰',
  particle: 'n. 粒子;微粒',
  pat: 'vt./n. 轻拍;拍打',
  pick: 'vt. 摘;挑选 n. 选择;镐',
  pine: 'n. 松树;松木',
  plastic: 'n. 塑料 a. 塑料的;可塑的',
  plus: 'prep. 加 n. 加号 a. 正的',
  prompt: 'a. 敏捷的;迅速的 vt. 促使;提示',
  propel: 'vt. 推进;推动',
  pull: 'vt./n. 拉;拖;牵',
  pumpkin: 'n. 南瓜',
  punch: 'vt./n. 拳击;猛击 n. 冲压机;穿孔机',
  radium: 'n. 镭',
  reservation: 'n. 预订;保留;保留意见',
  rest: 'vi./n. 休息 n. 其余;剩余',
  restless: 'a. 焦躁不安的;得不到休息的',
  retort: 'vt./n. 反驳;反唇相讥',
  revenue: 'n. 收入;税收',
  reverse: 'vt. 颠倒;倒转 n. 反面 a. 相反的',
  risk: 'n. 风险;危险 vt. 冒险',
  rot: 'v./n. 腐烂;腐朽',
  safeguard: 'n. 保护;保护措施 vt. 保护;护卫',
  salt: 'n. 盐 vt. 加盐;腌制',
  same: 'a. 相同的 pron. 同样的人/事物',
  search: 'v./n. 搜索;寻找;探查',
  seek: 'vt. 寻找;探求;试图',
  seize: 'vt. 抓住;捉住;夺取',
  sensation: 'n. 感觉;轰动',
  sensible: 'a. 明智的;明理的',
  sensor: 'n. 传感器',
  separate: 'a. 分离的;单独的 v. 分离;分开',
  several: 'a. 几个;若干',
  she: 'pron. 她',
  shore: 'n. 岸;海滨',
  side: 'n. 边;旁边;侧面;一方',
  since: 'prep./conj. 自从 ad. 后来',
  smash: 'vt./n. 打碎;粉碎;猛击',
  snake: 'n. 蛇',
  sob: 'v./n. 啜泣;呜咽',
  sodium: 'n. 钠',
  sprinkle: 'v./n. 洒;撒;喷淋',
  staircase: 'n. 楼梯',
  startle: 'vt. 使吓一跳 vi. 惊吓;惊跳',
  statue: 'n. 雕像;塑像',
  steamer: 'n. 蒸汽船;蒸锅',
  stocking: 'n. 长袜',
  straight: 'a./ad. 直(的);径直;正直(的)',
  such: 'a. 如此的;这种的 pron. 这样的人/事物',
  suddenly: 'ad. 突然;忽然',
  suffer: 'v. 遭受;受苦;(from) 患…',
  suitable: 'a. (for) 合适的;适宜的',
  survive: 'v. 幸存;比…活得久',
  symphony: 'n. 交响乐;交响曲',
  symptom: 'n. 症状;征候',
  tanker: 'n. 油轮',
  telescope: 'n. 望远镜',
  thin: 'a. 薄的;瘦的 v. 变薄;使稀薄',
  tight: 'a. 紧的;牢固的 ad. 紧紧地',
  tip: 'n. 尖;顶端;小费;提示 v. 倾斜;给小费',
  tolerate: 'vt. 容忍;忍受',
  tower: 'n. 塔;塔楼',
  training: 'n. 训练;培训;培养',
  trap: 'n. 陷阱;圈套 vt. 诱捕;使中圈套',
  trillion: 'num. 万亿',
  trim: 'vt./n. 修剪;修整',
  truthful: 'a. 真实的;诚实的',
  twentieth: 'num. 第二十',
  unless: 'conj. 如果不;除非',
  until: 'prep./conj. 直到…为止',
  upon: 'prep. 在…上;基于',
  uranus: 'n. 天王星',
  warfare: 'n. 战争;作战',
  whatever: 'pron. 无论什么;任何…的事物 a. 不管怎样的',
  whereas: 'conj. 鉴于;然而;反之',
  whether: 'conj. 是否;不管',
  whichever: 'pron./a. 无论哪个;无论哪些',
  whistle: 'v. 吹口哨;鸣响 n. 口哨声;哨子',
  whom: 'pron. (宾格) 谁',
  whose: 'pron. 谁的;哪个(人)的',
  wipe: 'vt. 擦;抹;拭',
  within: 'prep. 在…里面;在…以内',
  workshop: 'n. 车间;研讨会',
  yield: 'v. 生产;让步;屈服 n. 产量;收益',
};

export function cleanDefinitionText(value) {
  return String(value || '')
    .replace(/\bprepp\./gi, 'prep.')
    .replace(/\bprebp\./gi, 'prep.')
    .replace(/\bpreb\./gi, 'prep.')
    .replace(/\badg\./gi, 'ad.')
    .replace(/\bproz\.?/gi, 'pron.')
    .replace(/\bzroz\.?/gi, 'pron.')
    .replace(/\bcoz(?:2j|j|71)?\.?/gi, 'conj.')
    .replace(/\bvt\.\s*w\./gi, 'vt.')
    .replace(/\bvi\.\s*w\./gi, 'vi.')
    .replace(/\bw\./gi, 'v.')
    .replace(/\bz\.\s*\/[72]/gi, 'v. /n.')
    .replace(/\bvi\.\s*\/[72]/gi, 'vi. /n.')
    .replace(/\bvt\.\s*\/[72]/gi, 'vt. /n.')
    .replace(/\btt[。.]?/gi, 'vt.')
    .replace(/\but\./gi, 'vt.')
    .replace(/\bul\./gi, 'vt.')
    .replace(/\bY[.，。、]/g, 'v. ')
    .replace(/^[.。]\s*(?=[㐀-鿿])/g, 'v. ')
    .replace(/\ba\.\s*，/gi, 'a. ')
    .replace(/\/[72]\b/g, '/n.')
    .replace(/([A-Za-z])。/g, '$1.')
    .replace(
      /\b(vt|vi|v|n|a|ad|adv|adj|prep|conj|pron|num)\.\s+[A-Za-z]\.\s*(?:\([^)]*\)\s*)?(?=[㐀-鿿])/g,
      '$1. ',
    )
    .replace(/\s了\s+\d{1,4}[，。.,]?/g, ' ')
    .replace(/^[上忆凡咏巡坟][.。\s_]*(?=[㐀-鿿])/g, 'v. ')
    .replace(/\s*_+\s*/g, ' ')
    .replace(/\b[A-Z]{2,6}\b/g, (match) => (
      /^(?:TV|AM|PM|UK|US|USA|UN|EU|UFO|VIP|CEO|CFO|GDP|DNA|RNA|HIV|AIDS|OK|ID|IT|AI|FBI|CIA|WHO|NBA|NFL|NHL)$/.test(match)
        ? match
        : ' '
    ))
    .replace(/(?:^|\s)[A-Z](?=\s|$|[,;.])/g, ' ')
    .replace(/洗视/g, '凝视')
    .replace(/独击/g, '撞击')
    .replace(/热闸/g, '热闹')
    .replace(/和欲睡/g, '想睡')
    .replace(/未醇/g, '未醉')
    .replace(/漳涌/g, '汹涌')
    .replace(/不丛快/g, '不愉快')
    .replace(/钊/g, '卸')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getDefinitionOverride(entry) {
  return DEFINITION_OVERRIDES[entry?.word?.toLowerCase()] || '';
}

export function isLikelyOcrNoiseLine(line) {
  const text = cleanDefinitionText(line);
  if (!text) return true;
  const cjkCount = (text.match(/[㐀-鿿]/g) || []).length;
  const latinCount = (text.match(/[A-Za-z]/g) || []).length;
  const upperTokenCount = (text.match(/\b[A-Z]{2,}\b/g) || []).length;
  if (cjkCount === 0 && latinCount > 0) return true;
  if (/[»#%@_=]/.test(text) && cjkCount < 3) return true;
  if (upperTokenCount >= 2 && cjkCount < 3) return true;
  if (/^[a-z]{1,4}$/i.test(text) && cjkCount === 0) return true;
  return false;
}

// Entries from vocab.json are static object references, so WeakMap gives us
// an O(1) memoization without leaking memory. compactDefinition runs 20+ regex
// passes per call, and is called for every entry during search / type-scope
// construction / option pool filtering — caching turns repeated O(N×regex)
// scans into a single pass.
const cleanLinesCache = new WeakMap();
const compactCache = new WeakMap();
const shortCache = new WeakMap();
const usableCache = new WeakMap();

export function cleanDefinitionLines(entry) {
  if (!entry) return [];
  if (cleanLinesCache.has(entry)) return cleanLinesCache.get(entry);
  const override = getDefinitionOverride(entry);
  let result;
  if (override) {
    result = [override];
  } else {
    const lines = entry?.definitionLines?.length ? entry.definitionLines : [entry?.definition || ''];
    const cleaned = lines
      .map(cleanDefinitionText)
      .filter((line) => line && !isLikelyOcrNoiseLine(line));
    result = [...new Set(cleaned)];
  }
  cleanLinesCache.set(entry, result);
  return result;
}

export function compactDefinition(entry) {
  if (!entry) return '';
  if (compactCache.has(entry)) return compactCache.get(entry);
  const result = cleanDefinitionLines(entry).join(' ').replace(/\s+/g, ' ').trim();
  compactCache.set(entry, result);
  return result;
}

export function shortDefinition(entry) {
  if (!entry) return '释义待核对';
  if (shortCache.has(entry)) return shortCache.get(entry);
  const text = compactDefinition(entry) || '释义待核对';
  const result = text.length > 86 ? `${text.slice(0, 86)}...` : text;
  shortCache.set(entry, result);
  return result;
}

export function hasUsableChineseDefinition(entry) {
  if (!entry) return false;
  if (usableCache.has(entry)) return usableCache.get(entry);
  const definition = compactDefinition(entry);
  const result = (definition.match(/[㐀-鿿]/g) || []).length >= 2;
  usableCache.set(entry, result);
  return result;
}
