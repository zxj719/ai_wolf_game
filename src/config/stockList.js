/**
 * Static list of ~100 popular Chinese A-share stocks from CSI300.
 * Used as the stock universe for the Wolf Game simulation.
 */

export const A_SHARE_STOCK_LIST = [
  // 白酒
  { symbol: '600519.SH', name: '贵州茅台', industry: '白酒' },
  { symbol: '000858.SZ', name: '五粮液', industry: '白酒' },
  { symbol: '000568.SZ', name: '泸州老窖', industry: '白酒' },
  { symbol: '002304.SZ', name: '洋河股份', industry: '白酒' },
  { symbol: '600809.SH', name: '山西汾酒', industry: '白酒' },

  // 银行
  { symbol: '600036.SH', name: '招商银行', industry: '银行' },
  { symbol: '601166.SH', name: '兴业银行', industry: '银行' },
  { symbol: '600016.SH', name: '民生银行', industry: '银行' },
  { symbol: '601398.SH', name: '工商银行', industry: '银行' },
  { symbol: '601939.SH', name: '建设银行', industry: '银行' },
  { symbol: '600000.SH', name: '浦发银行', industry: '银行' },
  { symbol: '601288.SH', name: '农业银行', industry: '银行' },
  { symbol: '601328.SH', name: '交通银行', industry: '银行' },

  // 保险
  { symbol: '601318.SH', name: '中国平安', industry: '保险' },
  { symbol: '601628.SH', name: '中国人寿', industry: '保险' },
  { symbol: '601601.SH', name: '中国太保', industry: '保险' },
  { symbol: '601336.SH', name: '新华保险', industry: '保险' },

  // 证券
  { symbol: '600030.SH', name: '中信证券', industry: '证券' },
  { symbol: '601211.SH', name: '国泰君安', industry: '证券' },
  { symbol: '600837.SH', name: '海通证券', industry: '证券' },
  { symbol: '000776.SZ', name: '广发证券', industry: '证券' },
  { symbol: '601688.SH', name: '华泰证券', industry: '证券' },

  // 新能源
  { symbol: '300750.SZ', name: '宁德时代', industry: '新能源' },
  { symbol: '601012.SH', name: '隆基绿能', industry: '新能源' },
  { symbol: '300274.SZ', name: '阳光电源', industry: '新能源' },
  { symbol: '600438.SH', name: '通威股份', industry: '新能源' },
  { symbol: '002129.SZ', name: '中环股份', industry: '新能源' },

  // 汽车
  { symbol: '002594.SZ', name: '比亚迪', industry: '汽车' },
  { symbol: '600104.SH', name: '上汽集团', industry: '汽车' },
  { symbol: '601238.SH', name: '广汽集团', industry: '汽车' },
  { symbol: '000625.SZ', name: '长安汽车', industry: '汽车' },
  { symbol: '601127.SH', name: '赛力斯', industry: '汽车' },

  // 医药
  { symbol: '600276.SH', name: '恒瑞医药', industry: '医药' },
  { symbol: '000538.SZ', name: '云南白药', industry: '医药' },
  { symbol: '300760.SZ', name: '迈瑞医疗', industry: '医药' },
  { symbol: '600196.SH', name: '复星医药', industry: '医药' },
  { symbol: '300122.SZ', name: '智飞生物', industry: '医药' },
  { symbol: '000661.SZ', name: '长春高新', industry: '医药' },

  // 半导体
  { symbol: '688981.SH', name: '中芯国际', industry: '半导体' },
  { symbol: '002371.SZ', name: '北方华创', industry: '半导体' },
  { symbol: '603501.SH', name: '韦尔股份', industry: '半导体' },
  { symbol: '300661.SZ', name: '圣邦股份', industry: '半导体' },
  { symbol: '688012.SH', name: '中微公司', industry: '半导体' },

  // 科技
  { symbol: '002230.SZ', name: '科大讯飞', industry: '科技' },
  { symbol: '000725.SZ', name: '京东方A', industry: '科技' },
  { symbol: '002415.SZ', name: '海康威视', industry: '科技' },
  { symbol: '300059.SZ', name: '东方财富', industry: '科技' },
  { symbol: '688111.SH', name: '金山办公', industry: '科技' },

  // 消费
  { symbol: '600887.SH', name: '伊利股份', industry: '消费' },
  { symbol: '000651.SZ', name: '格力电器', industry: '消费' },
  { symbol: '600309.SH', name: '万华化学', industry: '消费' },
  { symbol: '603259.SH', name: '药明康德', industry: '消费' },
  { symbol: '300015.SZ', name: '爱尔眼科', industry: '消费' },

  // 食品饮料
  { symbol: '600600.SH', name: '青岛啤酒', industry: '食品饮料' },
  { symbol: '603288.SH', name: '海天味业', industry: '食品饮料' },
  { symbol: '002714.SZ', name: '牧原股份', industry: '食品饮料' },
  { symbol: '600872.SH', name: '中炬高新', industry: '食品饮料' },
  { symbol: '002568.SZ', name: '百润股份', industry: '食品饮料' },

  // 家电
  { symbol: '000333.SZ', name: '美的集团', industry: '家电' },
  { symbol: '600690.SH', name: '海尔智家', industry: '家电' },
  { symbol: '002032.SZ', name: '苏泊尔', industry: '家电' },
  { symbol: '002508.SZ', name: '老板电器', industry: '家电' },

  // 房地产
  { symbol: '001979.SZ', name: '招商蛇口', industry: '房地产' },
  { symbol: '600048.SH', name: '保利发展', industry: '房地产' },
  { symbol: '000002.SZ', name: '万科A', industry: '房地产' },
  { symbol: '600383.SH', name: '金地集团', industry: '房地产' },

  // 钢铁
  { symbol: '600019.SH', name: '宝钢股份', industry: '钢铁' },
  { symbol: '000898.SZ', name: '鞍钢股份', industry: '钢铁' },
  { symbol: '600010.SH', name: '包钢股份', industry: '钢铁' },

  // 石油化工
  { symbol: '600028.SH', name: '中国石化', industry: '石油化工' },
  { symbol: '601857.SH', name: '中国石油', industry: '石油化工' },
  { symbol: '600346.SH', name: '恒力石化', industry: '石油化工' },
  { symbol: '600352.SH', name: '浙江龙盛', industry: '石油化工' },

  // 通信
  { symbol: '600050.SH', name: '中国联通', industry: '通信' },
  { symbol: '601728.SH', name: '中国电信', industry: '通信' },
  { symbol: '000063.SZ', name: '中兴通讯', industry: '通信' },
  { symbol: '600941.SH', name: '中国移动', industry: '通信' },

  // 电力
  { symbol: '600900.SH', name: '长江电力', industry: '电力' },
  { symbol: '601985.SH', name: '中国核电', industry: '电力' },
  { symbol: '600886.SH', name: '国投电力', industry: '电力' },
  { symbol: '003816.SZ', name: '中国广核', industry: '电力' },

  // 军工
  { symbol: '600760.SH', name: '中航沈飞', industry: '军工' },
  { symbol: '601989.SH', name: '中国重工', industry: '军工' },
  { symbol: '600893.SH', name: '航发动力', industry: '军工' },
  { symbol: '002049.SZ', name: '紫光国微', industry: '军工' },
  { symbol: '600150.SH', name: '中国船舶', industry: '军工' },

  // 有色金属
  { symbol: '601899.SH', name: '紫金矿业', industry: '有色金属' },
  { symbol: '600362.SH', name: '江西铜业', industry: '有色金属' },
  { symbol: '601600.SH', name: '中国铝业', industry: '有色金属' },
  { symbol: '002460.SZ', name: '赣锋锂业', industry: '有色金属' },
  { symbol: '600489.SH', name: '中金黄金', industry: '有色金属' },

  // 交通运输
  { symbol: '601111.SH', name: '中国国航', industry: '交通运输' },
  { symbol: '600029.SH', name: '南方航空', industry: '交通运输' },
  { symbol: '601006.SH', name: '大秦铁路', industry: '交通运输' },
  { symbol: '600115.SH', name: '中国东航', industry: '交通运输' },
  { symbol: '601021.SH', name: '春秋航空', industry: '交通运输' },
];

/**
 * All unique industry categories in the stock list.
 */
export const INDUSTRIES = [
  ...new Set(A_SHARE_STOCK_LIST.map((s) => s.industry)),
];

/**
 * Quick lookup: symbol -> stock object.
 */
export const STOCK_MAP = Object.fromEntries(
  A_SHARE_STOCK_LIST.map((s) => [s.symbol, s])
);

export default A_SHARE_STOCK_LIST;
