// ---- plugin:work_daily_voice_to_text_1 ----
// ============================================================
// 插件 work_daily_voice_to_text_1 (日报表单语音转文字) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export type WorkDailyVoiceToTextOneInput = {
  /** 员工录制的日报音频文件 */
  audio_file: string[];
};

/**
 * const input: WorkDailyVoiceToTextOneInput = { audio_file };
 * capabilityClient.load('work_daily_voice_to_text_1').call<WorkDailyVoiceToTextOneOutput>('speechToText', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { text } = result;
 * 返回值形如：
 *   {"text":"示例文本"}
 */
export type WorkDailyVoiceToTextOneOutput = {
  text: string;
};
// ---- end:work_daily_voice_to_text_1 ----

// ---- plugin:bihai_smart_employee_daily_report_1 ----
// ============================================================
// 插件 bihai_smart_employee_daily_report_1 (碧海数智员工-日报生成) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export type BihaiSmartEmployeeDailyReportOneInput = {
  /** 生成日报/周报/月报等文本的完整提示词，由调用方根据具体场景（员工个人日报草稿、部门周报总结、部门月报总结等）组装后传入 */
  prompt: string;
};

/**
 * const input: BihaiSmartEmployeeDailyReportOneInput = { prompt };
 * capabilityClient.load('bihai_smart_employee_daily_report_1').callStream<BihaiSmartEmployeeDailyReportOneOutput>('textGenerate', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 BihaiSmartEmployeeDailyReportOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"content":"示例文本","response":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.content ?? ''; }
 */
export type BihaiSmartEmployeeDailyReportOneOutput = {
  content: string;
  response?: string;
};
// ---- end:bihai_smart_employee_daily_report_1 ----

// ---- plugin:daily_report_tts_test_material_1 ----
// ============================================================
// 插件 daily_report_tts_test_material_1 (日报系统语音合成测试素材) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export type DailyReportTtsTestMaterialOneInput = {
  /** 待合成为语音的中文文本内容 */
  text: string;
};

/**
 * const input: DailyReportTtsTestMaterialOneInput = { text };
 * capabilityClient.load('daily_report_tts_test_material_1').call<DailyReportTtsTestMaterialOneOutput>('speechSynthesis', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { audioUrl } = result;
 * 返回值形如：
 *   {"audioUrl":"示例文本"}
 */
export type DailyReportTtsTestMaterialOneOutput = {
  audioUrl: string;
};
// ---- end:daily_report_tts_test_material_1 ----

// ---- plugin:work_daily_report_notification_1 ----
// ============================================================
// 插件 work_daily_report_notification_1 (工作日报定时通知发送) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export type WorkDailyReportNotificationOneInput = {
  /** 消息标题 */
  title: string;
  /** markdown 格式正文内容 */
  content: string;
  /** 接收人妙达用户ID列表 */
  receiverIds: string[];
};

/**
 * const input: WorkDailyReportNotificationOneInput = { title, content, receiverIds };
 * capabilityClient.load('work_daily_report_notification_1').call<WorkDailyReportNotificationOneOutput>('send_feishu_message', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { success } = result;
 * 返回值形如：
 *   {"success":false}
 */
export type WorkDailyReportNotificationOneOutput = {
  success: boolean;
};
// ---- end:work_daily_report_notification_1 ----

// ---- plugin:bihai_daily_report_bitable_1 ----
// ============================================================
// 插件 bihai_daily_report_bitable_1 (工作日报飞书多维表格同步) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export type BihaiDailyReportBitableOneAddrecordcommentInput = {
  recordID: string;
  commentID?: string;
  content: unknown[];
};

/**
 * const input: BihaiDailyReportBitableOneAddrecordcommentInput = { recordID, commentID, content };
 * capabilityClient.load('bihai_daily_report_bitable_1').call<BihaiDailyReportBitableOneAddrecordcommentOutput>('addRecordComment', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { commentID, replyID } = result;
 * 返回值形如：
 *   {"commentID":"示例文本","replyID":"示例文本"}
 */
export type BihaiDailyReportBitableOneAddrecordcommentOutput = {
  commentID: string;
  replyID: string;
};

export type BihaiDailyReportBitableOneAggregatequeryInput = {
  sort?: {
    fieldName: string;
    desc?: boolean;
  }[];
  filter?: {
    conjunction?: string;
    conditions?: {
      fieldName: string;
      operator: string;
      value?: string[];
    }[];
  };
  expandArrayDimension?: boolean;
  dimensions?: string[];
  measures?: {
    fieldName: string;
    aggregation: string;
    alias?: string;
  }[];
  pageToken?: string;
  pageSize?: number;
};

/**
 * const input: BihaiDailyReportBitableOneAggregatequeryInput = { sort, filter, expandArrayDimension, ... };
 * capabilityClient.load('bihai_daily_report_bitable_1').call<BihaiDailyReportBitableOneAggregatequeryOutput>('aggregateQuery', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { result, hasMore, pageToken } = result;
 * 返回值形如：
 *   {"result":[{}],"hasMore":false,"pageToken":"示例文本"}
 */
export type BihaiDailyReportBitableOneAggregatequeryOutput = {
  result: {

  }[];
  hasMore: boolean;
  pageToken?: string;
};

export type BihaiDailyReportBitableOneBatchaddrecordsInput = {
  records: {
    record: {
      '填报日期'?: number;
      '项目名称/任务名称'?: unknown;
      '结束时间'?: unknown;
      '输出文件数量'?: string;
      '工时（小时）'?: number;
      '需协助事项'?: unknown;
      '完成情况判定'?: string;
      '日报ID'?: unknown;
      '所属部门'?: string;
      '任务名称'?: unknown;
      '项目阶段'?: unknown;
      '开始时间'?: unknown;
      '日报内容'?: unknown;
      '输出内容'?: unknown;
      '出图数量'?: number;
      '完成百分比'?: number;
      '偏差原因与问题'?: unknown;
      '任务来源'?: string;
      '项目编号'?: unknown;
      'PLM任务'?: unknown;
      '当日计划'?: unknown;
      '当日完成情况'?: unknown;
    };
  }[];
};

/**
 * const input: BihaiDailyReportBitableOneBatchaddrecordsInput = { records };
 * capabilityClient.load('bihai_daily_report_bitable_1').call<BihaiDailyReportBitableOneBatchaddrecordsOutput>('batchAddRecords', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { records } = result;
 * 返回值形如：
 *   {"records":[{"id":"示例文本"}]}
 */
export type BihaiDailyReportBitableOneBatchaddrecordsOutput = {
  records: {
    id: string;
  }[];
};

export type BihaiDailyReportBitableOneBatchupdaterecordsInput = {
  records: {
    id: string;
    record: {
      '开始时间'?: unknown;
      '当日计划'?: unknown;
      '日报内容'?: unknown;
      '任务名称'?: unknown;
      '项目编号'?: unknown;
      '当日完成情况'?: unknown;
      '输出内容'?: unknown;
      '需协助事项'?: unknown;
      '完成情况判定'?: string;
      '填报日期'?: number;
      'PLM任务'?: unknown;
      '任务来源'?: string;
      '结束时间'?: unknown;
      '完成百分比'?: number;
      '工时（小时）'?: number;
      '输出文件数量'?: string;
      '日报ID'?: unknown;
      '所属部门'?: string;
      '出图数量'?: number;
      '偏差原因与问题'?: unknown;
      '项目名称/任务名称'?: unknown;
      '项目阶段'?: unknown;
    };
  }[];
};

/**
 * const input: BihaiDailyReportBitableOneBatchupdaterecordsInput = { records };
 * capabilityClient.load('bihai_daily_report_bitable_1').call<BihaiDailyReportBitableOneBatchupdaterecordsOutput>('batchUpdateRecords', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { records } = result;
 * 返回值形如：
 *   {"records":[{"id":"示例文本"}]}
 */
export type BihaiDailyReportBitableOneBatchupdaterecordsOutput = {
  records: {
    id: string;
  }[];
};

export type BihaiDailyReportBitableOneDeleterecordcommentInput = {
  recordID: string;
  commentID: string;
  replyID?: string;
};

/**
 * const input: BihaiDailyReportBitableOneDeleterecordcommentInput = { recordID, commentID, replyID };
 * capabilityClient.load('bihai_daily_report_bitable_1').call<BihaiDailyReportBitableOneDeleterecordcommentOutput>('deleteRecordComment', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { commentID, commentDeleted } = result;
 * 返回值形如：
 *   {"commentID":"示例文本","commentDeleted":false}
 */
export type BihaiDailyReportBitableOneDeleterecordcommentOutput = {
  commentID: string;
  commentDeleted: boolean;
};

export type BihaiDailyReportBitableOneDeleterecordsInput = {
  recordIDs: string[];
};

/**
 * const input: BihaiDailyReportBitableOneDeleterecordsInput = { recordIDs };
 * capabilityClient.load('bihai_daily_report_bitable_1').call<BihaiDailyReportBitableOneDeleterecordsOutput>('deleteRecords', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { success } = result;
 * 返回值形如：
 *   {"success":false}
 */
export type BihaiDailyReportBitableOneDeleterecordsOutput = {
  success: boolean;
};

export type BihaiDailyReportBitableOneGetrecordInput = {
  textFormat?: string;
  recordID: string;
};

/**
 * const input: BihaiDailyReportBitableOneGetrecordInput = { textFormat, recordID };
 * capabilityClient.load('bihai_daily_report_bitable_1').call<BihaiDailyReportBitableOneGetrecordOutput>('getRecord', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { id, record } = result;
 * 返回值形如：
 *   {"id":"示例文本","record":{"项目名称/任务名称":null,"结束时间":null,"当日计划":null,"工时（小时）":0,"日报内容":null,"完成百分比":0,"输出文件数量":0,"填报日期":0,"任务名称":null,"PLM任务":null,"开始时间":null,"当日完成情况":null,"日报ID":{"originalValue":[{}],"text":"示例文本"},"所属部门":"示例文本","任务来源":"示例文本","偏差原因与问题":null,"需协助事项":null,"项目编号":null,"项目阶段":null,"输出内容":null,"出图数量":0,"完成情况判定":"示例文本"}}
 */
export type BihaiDailyReportBitableOneGetrecordOutput = {
  id: string;
  record?: {
    '项目名称/任务名称'?: unknown;
    '结束时间'?: unknown;
    '当日计划'?: unknown;
    '工时（小时）'?: number;
    '日报内容'?: unknown;
    '完成百分比'?: number;
    '输出文件数量'?: string;
    '填报日期'?: number;
    '任务名称'?: unknown;
    'PLM任务'?: unknown;
    '开始时间'?: unknown;
    '当日完成情况'?: unknown;
    '日报ID'?: {
      originalValue?: {
        type: string;
        text: string;
        link?: string;
        mentionType?: unknown;
        token?: string;
      }[];
      text: string;
    };
    '所属部门'?: string;
    '任务来源'?: string;
    '偏差原因与问题'?: unknown;
    '需协助事项'?: unknown;
    '项目编号'?: unknown;
    '项目阶段'?: unknown;
    '输出内容'?: unknown;
    '出图数量'?: number;
    '完成情况判定'?: string;
  };
};

export type BihaiDailyReportBitableOneListrecordcommentsInput = {
  commentID?: string;
  pageSize?: number;
  pageToken?: string;
  recordID: string;
};

/**
 * const input: BihaiDailyReportBitableOneListrecordcommentsInput = { commentID, pageSize, pageToken, ... };
 * capabilityClient.load('bihai_daily_report_bitable_1').call<BihaiDailyReportBitableOneListrecordcommentsOutput>('listRecordComments', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { comments, hasMore, pageToken } = result;
 * 返回值形如：
 *   {"comments":[{"replies":[{}],"commentID":"示例文本","creator":0,"createTime":0,"isSolved":false}],"hasMore":false,"pageToken":"示例文本"}
 */
export type BihaiDailyReportBitableOneListrecordcommentsOutput = {
  comments: {
    replies: {
      content: unknown[];
      replyID: string;
      creator?: unknown;
      createTime: unknown;
    }[];
    commentID: string;
    creator?: number;
    createTime: number;
    isSolved: boolean;
  }[];
  hasMore: boolean;
  pageToken: string;
};

export type BihaiDailyReportBitableOneSearchrecordsInput = {
  textFormat?: string;
  pageToken?: string;
  pageSize?: number;
  fieldNames?: string[];
  sort?: {
    fieldName: string;
    desc?: boolean;
  }[];
  filter?: {
    conjunction?: string;
    conditions?: {
      operator: string;
      value?: string[];
      fieldName: string;
    }[];
  };
};

/**
 * const input: BihaiDailyReportBitableOneSearchrecordsInput = { textFormat, pageToken, pageSize, ... };
 * capabilityClient.load('bihai_daily_report_bitable_1').call<BihaiDailyReportBitableOneSearchrecordsOutput>('searchRecords', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { pageToken, total, records, ... } = result;
 * 返回值形如：
 *   {"pageToken":"示例文本","total":0,"records":[{"id":"示例文本","record":{"结束时间":null,"输出文件数量":0,"出图数量":0,"需协助事项":null,"完成情况判定":"示例文本","填报日期":0,"PLM任务":null,"输出内容":null,"完成百分比":0,"工时（小时）":0,"当日完成情况":null,"日报内容":null,"项目名称/任务名称":null,"偏差原因与问题":null,"所属部门":"示例文本","任务来源":"示例文本","任务名称":null,"项目编号":null,"项目阶段":null,"开始时间":null,"当日计划":null,"日报ID":{}}}],"hasMore":false}
 */
export type BihaiDailyReportBitableOneSearchrecordsOutput = {
  pageToken?: string;
  total?: number;
  records: {
    id: string;
    record: {
      '结束时间'?: unknown;
      '输出文件数量'?: string;
      '出图数量'?: number;
      '需协助事项'?: unknown;
      '完成情况判定'?: string;
      '填报日期'?: number;
      'PLM任务'?: unknown;
      '输出内容'?: unknown;
      '完成百分比'?: number;
      '工时（小时）'?: number;
      '当日完成情况'?: unknown;
      '日报内容'?: unknown;
      '项目名称/任务名称'?: unknown;
      '偏差原因与问题'?: unknown;
      '所属部门'?: string;
      '任务来源'?: string;
      '任务名称'?: unknown;
      '项目编号'?: unknown;
      '项目阶段'?: unknown;
      '开始时间'?: unknown;
      '当日计划'?: unknown;
      '日报ID'?: {
        text: string;
        originalValue?: {
          text: string;
          link?: string;
          mentionType?: unknown;
          token?: string;
          type: string;
        }[];
      };
    };
  }[];
  hasMore: boolean;
};

export type BihaiDailyReportBitableOneUpdaterecordcommentInput = {
  recordID: string;
  commentID: string;
  replyID: string;
  content: unknown[];
};

/**
 * const input: BihaiDailyReportBitableOneUpdaterecordcommentInput = { recordID, commentID, replyID, ... };
 * capabilityClient.load('bihai_daily_report_bitable_1').call<BihaiDailyReportBitableOneUpdaterecordcommentOutput>('updateRecordComment', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { commentID, replyID } = result;
 * 返回值形如：
 *   {"commentID":"示例文本","replyID":"示例文本"}
 */
export type BihaiDailyReportBitableOneUpdaterecordcommentOutput = {
  commentID: string;
  replyID: string;
};
// ---- end:bihai_daily_report_bitable_1 ----

// ---- plugin:work_daily_report_bitable_sync_1 ----
// ============================================================
// 插件 work_daily_report_bitable_sync_1 (工作日报同步多维表格) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export type WorkDailyReportBitableSyncOneBatchaddrecordsInput = {
  records: {
    record: {
      'PLM任务'?: unknown;
      '结束时间'?: unknown;
      '当日完成情况'?: unknown;
      '输出内容'?: unknown;
      '输出文件数量'?: number;
      '需协助事项'?: unknown;
      '任务来源'?: string;
      '任务名称'?: unknown;
      '项目名称/任务名称'?: unknown;
      '开始时间'?: unknown;
      '当日计划'?: unknown;
      '完成情况判定'?: string;
      '填报日期'?: number;
      '所属部门'?: string;
      '完成百分比'?: number;
      '出图数量'?: number;
      '偏差原因与问题'?: unknown;
      '项目阶段'?: unknown;
      '日报内容'?: unknown;
      '工时（小时）'?: number;
      '填报人'?: unknown;
      '日报ID'?: unknown;
      '项目编号'?: unknown;
    };
  }[];
};

/**
 * const input: WorkDailyReportBitableSyncOneBatchaddrecordsInput = { records };
 * capabilityClient.load('work_daily_report_bitable_sync_1').call<WorkDailyReportBitableSyncOneBatchaddrecordsOutput>('batchAddRecords', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { records } = result;
 * 返回值形如：
 *   {"records":[{"id":"示例文本"}]}
 */
export type WorkDailyReportBitableSyncOneBatchaddrecordsOutput = {
  records: {
    id: string;
  }[];
};

export type WorkDailyReportBitableSyncOneBatchupdaterecordsInput = {
  records: {
    id: string;
    record: {
      '开始时间'?: unknown;
      '需协助事项'?: unknown;
      '填报日期'?: number;
      '所属部门'?: string;
      '任务名称'?: unknown;
      'PLM任务'?: unknown;
      '结束时间'?: unknown;
      '输出文件数量'?: number;
      '填报人'?: unknown;
      '日报ID'?: unknown;
      '项目阶段'?: unknown;
      '当日计划'?: unknown;
      '当日完成情况'?: unknown;
      '输出内容'?: unknown;
      '完成百分比'?: number;
      '工时（小时）'?: number;
      '出图数量'?: number;
      '项目名称/任务名称'?: unknown;
      '项目编号'?: unknown;
      '日报内容'?: unknown;
      '偏差原因与问题'?: unknown;
      '完成情况判定'?: string;
      '任务来源'?: string;
    };
  }[];
};

/**
 * const input: WorkDailyReportBitableSyncOneBatchupdaterecordsInput = { records };
 * capabilityClient.load('work_daily_report_bitable_sync_1').call<WorkDailyReportBitableSyncOneBatchupdaterecordsOutput>('batchUpdateRecords', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { records } = result;
 * 返回值形如：
 *   {"records":[{"id":"示例文本"}]}
 */
export type WorkDailyReportBitableSyncOneBatchupdaterecordsOutput = {
  records: {
    id: string;
  }[];
};
// ---- end:work_daily_report_bitable_sync_1 ----

// ---- plugin:work_daily_report_bitable_sync_v2 ----
// ============================================================
// 插件 work_daily_report_bitable_sync_v2 (工作日报同步多维表格（文本口径版）) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export type WorkDailyReportBitableSyncV2AddrecordcommentInput = {
  recordID: string;
  commentID?: string;
  content: unknown[];
};

/**
 * const input: WorkDailyReportBitableSyncV2AddrecordcommentInput = { recordID, commentID, content };
 * capabilityClient.load('work_daily_report_bitable_sync_v2').call<WorkDailyReportBitableSyncV2AddrecordcommentOutput>('addRecordComment', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { commentID, replyID } = result;
 * 返回值形如：
 *   {"commentID":"示例文本","replyID":"示例文本"}
 */
export type WorkDailyReportBitableSyncV2AddrecordcommentOutput = {
  commentID: string;
  replyID: string;
};

export type WorkDailyReportBitableSyncV2AggregatequeryInput = {
  sort?: {
    fieldName: string;
    desc?: boolean;
  }[];
  filter?: {
    conditions?: {
      fieldName: string;
      operator: string;
      value?: string[];
    }[];
    conjunction?: string;
  };
  expandArrayDimension?: boolean;
  dimensions?: string[];
  measures?: {
    aggregation: string;
    alias?: string;
    fieldName: string;
  }[];
  pageToken?: string;
  pageSize?: number;
};

/**
 * const input: WorkDailyReportBitableSyncV2AggregatequeryInput = { sort, filter, expandArrayDimension, ... };
 * capabilityClient.load('work_daily_report_bitable_sync_v2').call<WorkDailyReportBitableSyncV2AggregatequeryOutput>('aggregateQuery', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { result, hasMore, pageToken } = result;
 * 返回值形如：
 *   {"result":[{}],"hasMore":false,"pageToken":"示例文本"}
 */
export type WorkDailyReportBitableSyncV2AggregatequeryOutput = {
  result: {

  }[];
  hasMore: boolean;
  pageToken?: string;
};

export type WorkDailyReportBitableSyncV2BatchaddrecordsInput = {
  records: {
    record: {
      '项目阶段'?: unknown;
      'PLM任务'?: unknown;
      '当日计划'?: unknown;
      '需协助事项'?: unknown;
      '完成情况判定'?: string;
      '项目名称/任务名称'?: unknown;
      '填报日期'?: number;
      '项目编号'?: unknown;
      '输出内容'?: unknown;
      '输出文件数量'?: unknown;
      '日报ID'?: unknown;
      '任务名称'?: unknown;
      '结束时间'?: unknown;
      '当日完成情况'?: unknown;
      '工时（小时）'?: number;
      '出图数量'?: number;
      '填报人'?: unknown;
      '所属部门'?: string;
      '开始时间'?: unknown;
      '日报内容'?: unknown;
      '完成百分比'?: number;
      '偏差原因与问题'?: unknown;
      '任务来源'?: string;
    };
  }[];
};

/**
 * const input: WorkDailyReportBitableSyncV2BatchaddrecordsInput = { records };
 * capabilityClient.load('work_daily_report_bitable_sync_v2').call<WorkDailyReportBitableSyncV2BatchaddrecordsOutput>('batchAddRecords', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { records } = result;
 * 返回值形如：
 *   {"records":[{"id":"示例文本"}]}
 */
export type WorkDailyReportBitableSyncV2BatchaddrecordsOutput = {
  records: {
    id: string;
  }[];
};

export type WorkDailyReportBitableSyncV2BatchupdaterecordsInput = {
  records: {
    id: string;
    record: {
      '偏差原因与问题'?: unknown;
      '填报人'?: unknown;
      '项目阶段'?: unknown;
      '当日计划'?: unknown;
      '当日完成情况'?: unknown;
      '出图数量'?: number;
      '完成百分比'?: number;
      '工时（小时）'?: number;
      '日报ID'?: unknown;
      '任务来源'?: string;
      'PLM任务'?: unknown;
      '日报内容'?: unknown;
      '输出文件数量'?: unknown;
      '需协助事项'?: unknown;
      '完成情况判定'?: string;
      '填报日期'?: number;
      '所属部门'?: string;
      '结束时间'?: unknown;
      '输出内容'?: unknown;
      '任务名称'?: unknown;
      '项目名称/任务名称'?: unknown;
      '项目编号'?: unknown;
      '开始时间'?: unknown;
    };
  }[];
};

/**
 * const input: WorkDailyReportBitableSyncV2BatchupdaterecordsInput = { records };
 * capabilityClient.load('work_daily_report_bitable_sync_v2').call<WorkDailyReportBitableSyncV2BatchupdaterecordsOutput>('batchUpdateRecords', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { records } = result;
 * 返回值形如：
 *   {"records":[{"id":"示例文本"}]}
 */
export type WorkDailyReportBitableSyncV2BatchupdaterecordsOutput = {
  records: {
    id: string;
  }[];
};

export type WorkDailyReportBitableSyncV2DeleterecordcommentInput = {
  recordID: string;
  commentID: string;
  replyID?: string;
};

/**
 * const input: WorkDailyReportBitableSyncV2DeleterecordcommentInput = { recordID, commentID, replyID };
 * capabilityClient.load('work_daily_report_bitable_sync_v2').call<WorkDailyReportBitableSyncV2DeleterecordcommentOutput>('deleteRecordComment', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { commentDeleted, commentID } = result;
 * 返回值形如：
 *   {"commentDeleted":false,"commentID":"示例文本"}
 */
export type WorkDailyReportBitableSyncV2DeleterecordcommentOutput = {
  commentDeleted: boolean;
  commentID: string;
};

export type WorkDailyReportBitableSyncV2DeleterecordsInput = {
  recordIDs: string[];
};

/**
 * const input: WorkDailyReportBitableSyncV2DeleterecordsInput = { recordIDs };
 * capabilityClient.load('work_daily_report_bitable_sync_v2').call<WorkDailyReportBitableSyncV2DeleterecordsOutput>('deleteRecords', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { success } = result;
 * 返回值形如：
 *   {"success":false}
 */
export type WorkDailyReportBitableSyncV2DeleterecordsOutput = {
  success: boolean;
};

export type WorkDailyReportBitableSyncV2GetrecordInput = {
  recordID: string;
  textFormat?: string;
};

/**
 * const input: WorkDailyReportBitableSyncV2GetrecordInput = { recordID, textFormat };
 * capabilityClient.load('work_daily_report_bitable_sync_v2').call<WorkDailyReportBitableSyncV2GetrecordOutput>('getRecord', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { id, record } = result;
 * 返回值形如：
 *   {"id":"示例文本","record":{"任务名称":null,"项目编号":null,"日报内容":null,"完成百分比":0,"完成情况判定":"示例文本","日报ID":{"text":"示例文本","originalValue":[{}]},"填报日期":0,"开始时间":null,"结束时间":null,"当日完成情况":null,"输出内容":null,"偏差原因与问题":null,"所属部门":"示例文本","任务来源":"示例文本","PLM任务":null,"需协助事项":null,"当日计划":null,"工时（小时）":0,"输出文件数量":null,"出图数量":0,"填报人":null,"项目名称/任务名称":null,"项目阶段":null}}
 */
export type WorkDailyReportBitableSyncV2GetrecordOutput = {
  id: string;
  record?: {
    '任务名称'?: unknown;
    '项目编号'?: unknown;
    '日报内容'?: unknown;
    '完成百分比'?: number;
    '完成情况判定'?: string;
    '日报ID'?: {
      text: string;
      originalValue?: {
        text: string;
        link?: string;
        mentionType?: unknown;
        token?: string;
        type: string;
      }[];
    };
    '填报日期'?: number;
    '开始时间'?: unknown;
    '结束时间'?: unknown;
    '当日完成情况'?: unknown;
    '输出内容'?: unknown;
    '偏差原因与问题'?: unknown;
    '所属部门'?: string;
    '任务来源'?: string;
    'PLM任务'?: unknown;
    '需协助事项'?: unknown;
    '当日计划'?: unknown;
    '工时（小时）'?: number;
    '输出文件数量'?: unknown;
    '出图数量'?: number;
    '填报人'?: unknown;
    '项目名称/任务名称'?: unknown;
    '项目阶段'?: unknown;
  };
};

export type WorkDailyReportBitableSyncV2ListrecordcommentsInput = {
  recordID: string;
  commentID?: string;
  pageSize?: number;
  pageToken?: string;
};

/**
 * const input: WorkDailyReportBitableSyncV2ListrecordcommentsInput = { recordID, commentID, pageSize, ... };
 * capabilityClient.load('work_daily_report_bitable_sync_v2').call<WorkDailyReportBitableSyncV2ListrecordcommentsOutput>('listRecordComments', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { comments, hasMore, pageToken } = result;
 * 返回值形如：
 *   {"comments":[{"commentID":"示例文本","creator":0,"createTime":0,"isSolved":false,"replies":[{}]}],"hasMore":false,"pageToken":"示例文本"}
 */
export type WorkDailyReportBitableSyncV2ListrecordcommentsOutput = {
  comments: {
    commentID: string;
    creator?: number;
    createTime: number;
    isSolved: boolean;
    replies: {
      replyID: string;
      creator?: unknown;
      createTime: unknown;
      content: unknown[];
    }[];
  }[];
  hasMore: boolean;
  pageToken: string;
};

export type WorkDailyReportBitableSyncV2SearchrecordsInput = {
  textFormat?: string;
  pageToken?: string;
  pageSize?: number;
  fieldNames?: string[];
  sort?: {
    fieldName: string;
    desc?: boolean;
  }[];
  filter?: {
    conjunction?: string;
    conditions?: {
      operator: string;
      value?: string[];
      fieldName: string;
    }[];
  };
};

/**
 * const input: WorkDailyReportBitableSyncV2SearchrecordsInput = { textFormat, pageToken, pageSize, ... };
 * capabilityClient.load('work_daily_report_bitable_sync_v2').call<WorkDailyReportBitableSyncV2SearchrecordsOutput>('searchRecords', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { total, records, hasMore, ... } = result;
 * 返回值形如：
 *   {"total":0,"records":[{"id":"示例文本","record":{"完成情况判定":"示例文本","任务名称":null,"项目阶段":null,"输出内容":null,"偏差原因与问题":null,"需协助事项":null,"当日完成情况":null,"填报人":null,"日报ID":{},"任务来源":"示例文本","开始时间":null,"结束时间":null,"当日计划":null,"所属部门":"示例文本","项目编号":null,"PLM任务":null,"工时（小时）":0,"出图数量":0,"日报内容":null,"填报日期":0,"项目名称/任务名称":null,"完成百分比":0,"输出文件数量":null}}],"hasMore":false,"pageToken":"示例文本"}
 */
export type WorkDailyReportBitableSyncV2SearchrecordsOutput = {
  total?: number;
  records: {
    id: string;
    record: {
      '完成情况判定'?: string;
      '任务名称'?: unknown;
      '项目阶段'?: unknown;
      '输出内容'?: unknown;
      '偏差原因与问题'?: unknown;
      '需协助事项'?: unknown;
      '当日完成情况'?: unknown;
      '填报人'?: unknown;
      '日报ID'?: {
        text: string;
        originalValue?: {
          type: string;
          text: string;
          link?: string;
          mentionType?: unknown;
          token?: string;
        }[];
      };
      '任务来源'?: string;
      '开始时间'?: unknown;
      '结束时间'?: unknown;
      '当日计划'?: unknown;
      '所属部门'?: string;
      '项目编号'?: unknown;
      'PLM任务'?: unknown;
      '工时（小时）'?: number;
      '出图数量'?: number;
      '日报内容'?: unknown;
      '填报日期'?: number;
      '项目名称/任务名称'?: unknown;
      '完成百分比'?: number;
      '输出文件数量'?: unknown;
    };
  }[];
  hasMore: boolean;
  pageToken?: string;
};

export type WorkDailyReportBitableSyncV2UpdaterecordcommentInput = {
  recordID: string;
  commentID: string;
  replyID: string;
  content: unknown[];
};

/**
 * const input: WorkDailyReportBitableSyncV2UpdaterecordcommentInput = { recordID, commentID, replyID, ... };
 * capabilityClient.load('work_daily_report_bitable_sync_v2').call<WorkDailyReportBitableSyncV2UpdaterecordcommentOutput>('updateRecordComment', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { commentID, replyID } = result;
 * 返回值形如：
 *   {"commentID":"示例文本","replyID":"示例文本"}
 */
export type WorkDailyReportBitableSyncV2UpdaterecordcommentOutput = {
  commentID: string;
  replyID: string;
};
// ---- end:work_daily_report_bitable_sync_v2 ----