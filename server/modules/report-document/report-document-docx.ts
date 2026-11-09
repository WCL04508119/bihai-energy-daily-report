import {
  AlignmentType,
  BorderStyle,
  Document,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ITableBordersOptions,
} from 'docx';
import type {
  MonthlyTemplateData,
  ReportDocumentType,
  ReportGoalRow,
  ReportIssueRow,
  ReportMilestoneRow,
  ReportNextPlanRow,
  WeeklyTemplateData,
} from '@shared/api.interface';

const FONT = {
  ascii: 'Times New Roman',
  eastAsia: '宋体',
  hAnsi: 'Times New Roman',
};

const BORDER: ITableBordersOptions = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
};

export interface ReportDocSource {
  title: string;
  reportType: ReportDocumentType;
  department: string;
  period: string;
  summaryContent?: string;
  issuesSummary?: string;
  reportCount: number;
  totalWorkHours: number;
  completionRate: number;
  issueCount?: number;
  templateData?: WeeklyTemplateData | MonthlyTemplateData;
}

interface DocCol {
  header: string;
  width: number;
  align?: 'left' | 'center';
}

const textOf = (value?: string | null): string => {
  const t = value?.trim() ?? '';
  return t.length > 0 ? t : '—';
};

const makeCell = (
  content: string,
  width: number,
  opts: { align?: 'left' | 'center'; header?: boolean } = {},
): TableCell =>
  new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: opts.header ? { fill: 'EEF0F3', type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    verticalAlign: 'center',
    children: [
      new Paragraph({
        alignment: opts.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({
            text: content,
            size: 18,
            font: FONT,
            bold: opts.header === true,
          }),
        ],
      }),
    ],
  });

const makeTable = (cols: DocCol[], rows: string[][]): Table => {
  const headerRow = new TableRow({
    tableHeader: true,
    children: cols.map((col) =>
      makeCell(col.header, col.width, { align: 'center', header: true }),
    ),
  });
  let bodyRows: TableRow[];
  if (rows.length === 0) {
    const totalWidth = cols.reduce((sum: number, col) => sum + col.width, 0);
    bodyRows = [
      new TableRow({
        children: [
          new TableCell({
            width: { size: totalWidth, type: WidthType.DXA },
            borders: BORDER,
            verticalAlign: 'center',
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: '暂无数据', size: 18, font: FONT })],
              }),
            ],
          }),
        ],
      }),
    ];
  } else {
    bodyRows = rows.map(
      (row) =>
        new TableRow({
          children: row.map((cellText: string, index: number) => {
            const col = cols[index];
            return makeCell(cellText, col.width, { align: col.align });
          }),
        }),
    );
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDER,
    rows: [headerRow, ...bodyRows],
  });
};

const heading = (text: string): Paragraph =>
  new Paragraph({
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, font: FONT })],
  });

const para = (text: string, opts: { size?: number; bold?: boolean; center?: boolean } = {}): Paragraph =>
  new Paragraph({
    spacing: { after: 60 },
    alignment: opts.center === true ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        size: opts.size ?? 21,
        bold: opts.bold === true,
        font: FONT,
      }),
    ],
  });

const goalCols = (
  topicLabel: string,
): DocCol[] => [
  { header: '序号', width: 600, align: 'center' },
  { header: '任务来源', width: 1100 },
  { header: '项目编号', width: 1100 },
  { header: '项目名称/任务名称', width: 1400 },
  { header: topicLabel, width: 1700 },
  { header: '实际完成及产出', width: 2200 },
];

const goalRows = (rows: ReportGoalRow[]): string[][] =>
  rows.map((row: ReportGoalRow, index: number) => [
    String(index + 1),
    textOf(row.taskSource),
    textOf(row.projectCode),
    textOf(row.projectName),
    textOf(row.goal),
    textOf(row.actualOutput),
  ]);

const issueCols: DocCol[] = [
  { header: '序号', width: 600, align: 'center' },
  { header: '任务来源', width: 1100 },
  { header: '项目编号', width: 1200 },
  { header: '项目名称/任务名称', width: 1400 },
  { header: '问题/风险描述', width: 1700 },
  { header: '类型', width: 1000 },
  { header: '原因及措施', width: 1500 },
  { header: '责任人', width: 1100 },
  { header: '状态', width: 900 },
  { header: '支持的协助', width: 1300 },
];

const issueRows = (rows: ReportIssueRow[]): string[][] =>
  rows.map((row: ReportIssueRow, index: number) => [
    String(index + 1),
    textOf(row.taskSource),
    textOf(row.projectCode),
    textOf(row.projectName),
    textOf(row.riskDesc),
    textOf(row.issueType),
    textOf(row.causeAndAction),
    (row.ownerIds ?? []).join('、') || '—',
    textOf(row.status),
    textOf(row.supportNeeded ?? row.plannedCloseDate),
  ]);

const nextPlanCols: DocCol[] = [
  { header: '序号', width: 600, align: 'center' },
  { header: '任务来源', width: 1300 },
  { header: '项目编号', width: 1300 },
  { header: '重点任务', width: 1800 },
  { header: '交付物', width: 1800 },
  { header: '完成时间', width: 1300 },
  { header: '所需资源/协同', width: 1800 },
];

const nextPlanRows = (rows: ReportNextPlanRow[]): string[][] =>
  rows.map((row: ReportNextPlanRow, index: number) => [
    String(index + 1),
    textOf(row.taskSource),
    textOf(row.projectCode),
    textOf(row.keyTask),
    textOf(row.deliverable),
    textOf(row.dueDate),
    textOf(row.resourcesNeeded),
  ]);

const milestoneCols: DocCol[] = [
  { header: '序号', width: 600, align: 'center' },
  { header: '任务来源', width: 1100 },
  { header: '项目编号', width: 1200 },
  { header: '项目名称/任务名称', width: 1400 },
  { header: '节点名称', width: 1600 },
  { header: '计划日期', width: 1200 },
  { header: '实际/预计日期', width: 1300 },
  { header: '节点状态', width: 1100 },
  { header: '说明', width: 1300 },
];

const milestoneRows = (rows: ReportMilestoneRow[]): string[][] =>
  rows.map((row: ReportMilestoneRow, index: number) => [
    String(index + 1),
    textOf(row.taskSource),
    textOf(row.projectCode),
    textOf(row.projectName),
    textOf(row.nodeName),
    textOf(row.plannedDate),
    textOf(row.actualDate),
    textOf(row.nodeStatus),
    textOf(row.note),
  ]);

const toDateLabel = (date: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const buildStatsTable = (source: ReportDocSource): Table => {
  const statCols: DocCol[] = [
    { header: '报告条数', width: 2400, align: 'center' },
    ...(source.issueCount !== undefined
      ? [{ header: '卡点数', width: 2400, align: 'center' as const }]
      : []),
  ];
  const stats: string[] = [
    String(source.reportCount),
    ...(source.issueCount !== undefined ? [String(source.issueCount)] : []),
  ];
  return makeTable(statCols, [stats]);
};

export const buildReportDocx = async (source: ReportDocSource): Promise<Buffer> => {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: source.title, bold: true, size: 36, font: FONT })],
    }),
    para(`部门：${source.department} | 周期：${source.period} | 生成时间：${toDateLabel(new Date())}`, {
      size: 18,
    }),
    new Paragraph({ spacing: { after: 80 }, children: [] }),
    buildStatsTable(source),
  ];

  const data = source.templateData;

  if (!data) {
    children.push(
      heading('报告内容'),
      para(textOf(source.summaryContent || source.issuesSummary) === '—'
        ? '（未生成四章模板，请在系统详情页重新生成后导出）'
        : textOf(source.summaryContent || source.issuesSummary)),
    );
  } else if (source.reportType === 'weekly' || source.reportType === 'department-weekly') {
    const weekly = data as WeeklyTemplateData;
    children.push(
      heading('一、本周目标完成情况'),
      makeTable(goalCols('本周目标'), goalRows(weekly.goalRows)),
      heading('二、问题与协助'),
      makeTable(issueCols, issueRows(weekly.issueRows)),
      heading('三、本周总结 / 改进'),
      makeTable(
        [
          { header: '序号', width: 1800, align: 'center' },
          { header: '总结内容', width: 7200 },
        ],
        weekly.summaryPoints.map((point: string, index: number) => [
          String(index + 1),
          textOf(point),
        ]),
      ),
      heading('四、下周计划'),
      makeTable(nextPlanCols, nextPlanRows(weekly.nextPlanRows)),
    );
  } else {
    const monthly = data as MonthlyTemplateData;
    children.push(
      heading('一、本月目标完成情况'),
      makeTable(goalCols('本月目标'), goalRows(monthly.goalRows)),
      heading('二、关键节点完成情况'),
      makeTable(milestoneCols, milestoneRows(monthly.milestoneRows)),
      heading('三、问题与协助'),
      makeTable(issueCols, issueRows(monthly.issueRows)),
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 21 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 16838, height: 11906, orientation: PageOrientation.LANDSCAPE },
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
};