export const PROJECT_CATEGORIES = [
  '研发项目',
  '合同执行项目',
  '固定资产项目',
  '标准系列化产品项目',
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export interface ProjectItem {
  code: string;
  name: string;
}

export const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
  研发项目: '研发项目',
  合同执行项目: '合同执行项目',
  固定资产项目: '固定资产项目',
  标准系列化产品项目: '标准系列化产品项目',
};

export const PROJECTS: Record<ProjectCategory, ProjectItem[]> = {
  研发项目: [
    { code: 'RD250320', name: '生物质制氢及绿色二氧化碳捕集装备' },
    { code: 'RD231002', name: '电解水制氢装置' },
    { code: 'RD250101', name: '氢液化装置' },
    { code: 'RD250105', name: '烯烃磺酸盐生产装置' },
  ],
  合同执行项目: [
    { code: 'RD260303', name: '电解水制氢项目' },
    { code: 'BSS260002612', name: '北极二备件销售合同' },
    { code: 'BSS260152608', name: '山东港口日照港岚山港区30万吨级原油码头三期配套罐区工程阴极保护系统采购项目' },
    { code: 'BSS261682605', name: '南京南化硝酸镁加热器阴保项目' },
    { code: 'BSS253342512', name: '翅片管供货' },
    { code: 'BSS253182601', name: '伊拉克B9电站项目干气管线和减压撬采购' },
    { code: 'BSS252452510', name: 'B9发电项目开排系统' },
    { code: 'BSS211028014', name: '北极2改造项目 (COR0083)' },
    { code: 'BSS250172505', name: '中国石油辽河石化公司润滑油产品结构调整项目溶剂脱沥青装置导热油炉系统项目' },
    { code: 'BSS240622504', name: '(印尼)PT Layar Nusantara Gas焚烧炉配套设备(29000)' },
    { code: 'BSS240622503', name: '(印尼)PT Layar Nusantara Gas导热油炉31000' },
    { code: 'BSS240622502', name: '(印尼)PT Layar Nusantara Gas余热回收装置(30000)' },
    { code: 'RD261102', name: '阴极保护技术包装阳极' },
    { code: 'BSS261602616', name: 'Sepat TEG PACKAGE' },
    { code: 'BSS262962615', name: 'Sepat 热氧化炉' },
    { code: 'BSS252022613', name: 'Sepat 废热回收锅炉 (WHRU)' },
    { code: 'BSS250412511X', name: '氮氧化物电化学合成氨装置研发' },
    { code: 'BSS260002614', name: '北极2风机备件采购' },
    { code: 'RD260513', name: '航发3MW燃机+B55无机工质膨胀发电系统项目' },
    { code: 'BSS260182606X', name: '哈萨克SILLENO热水锅炉项目' },
    { code: 'BSS262182610', name: 'Tengiz GSC项目余热回收系统' },
    { code: 'BSS262182609', name: 'Tengiz GSC项目导热油炉' },
    { code: 'BSS251122611', name: 'P2614 NGL5 GAS HEATERS' },
    { code: 'BSS250252506', name: '有限海南工建东方1-1气田CCUS提高采收率项目余热回收装置' },
    { code: 'BSS241042501', name: '哈萨克斯坦ZNR GPP项目导热油炉&余热回收&氧化炉成套设备' },
    { code: 'BSS252822509', name: 'TEG Package' },
  ],
  固定资产项目: [
    { code: 'FA250402', name: '东厂消防水池及消防自动供水系统' },
  ],
  标准系列化产品项目: [
    { code: 'STD250208', name: 'CEMS 烟气分析仪' },
    { code: 'STD250205', name: '北极燃烧器优化、系列化' },
    { code: 'STD250206', name: '保温箱' },
    { code: 'STD250204', name: '热处理炉燃烧器研制' },
    { code: 'STD250203', name: '穿墙模块' },
    { code: 'STD250202', name: '弹簧吊架' },
    { code: 'STD250201', name: '防火门' },
    { code: 'STD250207', name: '热煨盘管装备' },
    { code: 'STD250209', name: '阴极保护控制系统自研' },
  ],
};

export const ALL_PROJECTS: ProjectItem[] = PROJECT_CATEGORIES.flatMap(
  (category: ProjectCategory) => PROJECTS[category],
);