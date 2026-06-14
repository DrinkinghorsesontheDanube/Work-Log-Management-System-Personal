import type { Client, Project, WorkLog, Todo, PhaseRecord, PlanTask, Report } from '../types'
import { storage } from './storage'

function id(prefix: string, n: number) {
  return `${prefix}_seed_${String(n).padStart(3, '0')}`
}

function iso(dateStr: string) {
  return new Date(dateStr + 'T08:00:00').toISOString()
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function makePhaseHistory(phases: [string, number, string?][]): PhaseRecord[] {
  return phases.map(([phaseId, daysBefore, note]) => {
    const start = daysAgo(daysBefore)
    return { phaseId, startDate: start, endDate: null, note: note || '' }
  })
}

function makePlanTask(partial: { id: string; projectId: string; name: string; startDaysAgo: number; endDaysAgo: number; progress: number; parentId?: string | null; status: 'pending' | 'in_progress' | 'completed'; order: number }): PlanTask {
  return {
    id: partial.id, projectId: partial.projectId, name: partial.name,
    startDate: daysAgo(partial.startDaysAgo), endDate: daysAgo(partial.endDaysAgo),
    progress: partial.progress, parentId: partial.parentId ?? null,
    duration: partial.startDaysAgo - partial.endDaysAgo, includeHolidays: false,
    actualStartDate: null, actualEndDate: null,
    status: partial.status, order: partial.order,
    createdAt: iso(daysAgo(partial.startDaysAgo)), updatedAt: iso(daysAgo(0))
  }
}

export function seedAllData() {
  storage.clearAllData()

  const clients: Client[] = [
    {
      id: id('client', 1), name: '市大数据局', type: 'government',
      contacts: [
        { id: 'ct_1_1', name: '王志远', title: '处长', department: '数据资源管理处', phone: '138****5521', email: 'wangzy@data.gov.cn', role: 'leader', responsibility: '智慧城市项目总牵头，预算审批', isPrimary: true, notes: '' },
        { id: 'ct_1_2', name: '孙晓明', title: '副处长', department: '数据资源管理处', phone: '139****3321', email: 'sunxm@data.gov.cn', role: 'executor', responsibility: '技术对接、需求确认', isPrimary: false, notes: '技术出身，沟通顺畅' },
        { id: 'ct_1_3', name: '周婷', title: '科员', department: '数据安全科', phone: '136****7712', email: 'zhout@data.gov.cn', role: 'executor', responsibility: '数据安全合规审查', isPrimary: false, notes: '' }
      ],
      region: '本市', industry: '政务数据', importance: 'A', followUpStatus: 'active',
      lastContactDate: daysAgo(2), nextFollowUpDate: daysAgo(-5),
      source: '政府招标', notes: '智慧城市项目牵头单位，今年预算充足，重点客户',
      createdAt: iso(daysAgo(120)), updatedAt: iso(daysAgo(2))
    },
    {
      id: id('client', 2), name: '市教育局', type: 'government',
      contacts: [
        { id: 'ct_2_1', name: '李明辉', title: '主任', department: '教育信息化办公室', phone: '139****8832', email: 'limh@edu.gov.cn', role: 'leader', responsibility: '教育信息化2.0项目负责人', isPrimary: true, notes: '' },
        { id: 'ct_2_2', name: '吴思远', title: '副主任', department: '教育信息化办公室', phone: '137****5543', email: 'wusy@edu.gov.cn', role: 'executor', responsibility: '项目执行、学校对接', isPrimary: false, notes: '负责一线学校的落地推进' }
      ],
      region: '本市', industry: '教育信息化', importance: 'A', followUpStatus: 'active',
      lastContactDate: daysAgo(5), nextFollowUpDate: daysAgo(-3),
      source: '老客户转介', notes: '教育信息化2.0项目，需关注省厅政策动向',
      createdAt: iso(daysAgo(90)), updatedAt: iso(daysAgo(5))
    },
    {
      id: id('client', 3), name: '区智慧城市运营中心', type: 'government',
      contacts: [
        { id: 'ct_3_1', name: '张晓峰', title: '部长', department: '运营管理部', phone: '136****6617', email: 'zhangxf@smartcity.gov.cn', role: 'leader', responsibility: '平台运营管理', isPrimary: true, notes: '' },
        { id: 'ct_3_2', name: '林海', title: '技术主管', department: '技术保障部', phone: '135****9901', email: 'linh@smartcity.gov.cn', role: 'executor', responsibility: '平台技术对接、数据归集', isPrimary: false, notes: '' }
      ],
      region: '本区', industry: '智慧城市', importance: 'B', followUpStatus: 'active',
      lastContactDate: daysAgo(8), nextFollowUpDate: daysAgo(-2),
      source: '项目合作', notes: '区级智慧城市平台运营方',
      createdAt: iso(daysAgo(80)), updatedAt: iso(daysAgo(8))
    },
    {
      id: id('client', 4), name: '省交通投资集团', type: 'enterprise',
      contacts: [
        { id: 'ct_4_1', name: '陈国强', title: '部长', department: '信息化管理部', phone: '137****9943', email: 'chengq@jtjt.com', role: 'leader', responsibility: '数字化转型规划', isPrimary: true, notes: '' },
        { id: 'ct_4_2', name: '黄伟', title: '高级经理', department: '信息化管理部', phone: '138****2201', email: 'huangw@jtjt.com', role: 'executor', responsibility: '项目采购、合同对接', isPrimary: false, notes: '' },
        { id: 'ct_4_3', name: '杨蕾', title: '副总', department: '战略发展部', phone: '139****6601', email: 'yanglei@jtjt.com', role: 'leader', responsibility: '战略规划审批', isPrimary: false, notes: '决策层' }
      ],
      region: '本省', industry: '交通基建', importance: 'A', followUpStatus: 'active',
      lastContactDate: daysAgo(3), nextFollowUpDate: daysAgo(-4),
      source: '行业会议', notes: '数字化转型咨询，预算较大但决策链长',
      createdAt: iso(daysAgo(60)), updatedAt: iso(daysAgo(3))
    },
    {
      id: id('client', 5), name: '市卫生健康委', type: 'government',
      contacts: [
        { id: 'ct_5_1', name: '刘雅琴', title: '处长', department: '规划发展与信息化处', phone: '135****2206', email: 'liuyq@health.gov.cn', role: 'leader', responsibility: '卫生健康信息化规划', isPrimary: true, notes: '' }
      ],
      region: '本市', industry: '医疗卫生', importance: 'B', followUpStatus: 'pending',
      lastContactDate: daysAgo(25), nextFollowUpDate: daysAgo(5),
      source: '老客户', notes: '智慧医疗平台已交付，运维阶段，后续有区域医疗信息平台需求',
      createdAt: iso(daysAgo(200)), updatedAt: iso(daysAgo(25))
    },
    {
      id: id('client', 6), name: '市应急管理局', type: 'government',
      contacts: [
        { id: 'ct_6_1', name: '赵鹏飞', title: '主任', department: '应急指挥中心', phone: '133****7748', email: 'zhaopf@emergency.gov.cn', role: 'leader', responsibility: '应急指挥系统建设', isPrimary: true, notes: '' },
        { id: 'ct_6_2', name: '马强', title: '科长', department: '科技信息化科', phone: '134****1102', email: 'maq@emergency.gov.cn', role: 'executor', responsibility: '技术选型、方案评审', isPrimary: false, notes: '' }
      ],
      region: '本市', industry: '应急管理', importance: 'A', followUpStatus: 'active',
      lastContactDate: daysAgo(1), nextFollowUpDate: daysAgo(-1),
      source: '政府招标', notes: '应急指挥调度系统招标在即',
      createdAt: iso(daysAgo(50)), updatedAt: iso(daysAgo(1))
    },
    {
      id: id('client', 7), name: '市生态环境局', type: 'government',
      contacts: [
        { id: 'ct_7_1', name: '何建国', title: '副局长', department: '局领导', phone: '132****4410', email: 'hejg@sthjj.gov.cn', role: 'leader', responsibility: '生态环境信息化决策', isPrimary: true, notes: '' },
        { id: 'ct_7_2', name: '钱丽萍', title: '科长', department: '监测信息科', phone: '131****8823', email: 'qianlp@sthjj.gov.cn', role: 'executor', responsibility: '环境监测系统对接', isPrimary: false, notes: '' }
      ],
      region: '本市', industry: '生态环境', importance: 'B', followUpStatus: 'active',
      lastContactDate: daysAgo(7), nextFollowUpDate: daysAgo(-10),
      source: '主动拓展', notes: '智慧环保监测平台有潜在需求，已初步沟通',
      createdAt: iso(daysAgo(30)), updatedAt: iso(daysAgo(7))
    },
    {
      id: id('client', 8), name: '市文旅集团', type: 'enterprise',
      contacts: [
        { id: 'ct_8_1', name: '郑浩然', title: '总经理', department: '集团总部', phone: '130****6655', email: 'zhenghr@whjt.com', role: 'leader', responsibility: '集团数字化战略', isPrimary: true, notes: '' },
        { id: 'ct_8_2', name: '徐敏', title: '总监', department: '信息化部', phone: '139****2211', email: 'xumin@whjt.com', role: 'executor', responsibility: '智慧旅游平台建设', isPrimary: false, notes: '' }
      ],
      region: '本市', industry: '文化旅游', importance: 'C', followUpStatus: 'lost',
      lastContactDate: daysAgo(60), nextFollowUpDate: null,
      source: '展会认识', notes: '对方预算不足，已暂停推进，后续可关注',
      createdAt: iso(daysAgo(90)), updatedAt: iso(daysAgo(60))
    }
  ]

  const clientIdMap = {
    bigdata: id('client', 1), edu: id('client', 2), smartcity: id('client', 3),
    transport: id('client', 4), health: id('client', 5), emergency: id('client', 6),
    env: id('client', 7), tourism: id('client', 8)
  }

  const projects: Project[] = [
    {
      id: id('proj', 1), name: '市智慧城市大数据平台建设',
      description: '建设市级大数据汇聚、治理、共享、开放平台，对接30+委办局数据，实现城市运行态势感知',
      progress: 45, startDate: daysAgo(60), endDate: daysAgo(-90),
      status: 'in_progress', currentPhaseId: 'solution',
      phaseHistory: makePhaseHistory([['initiation', 60, '立项完成'], ['survey', 45, '需求调研两周'], ['solution', 20, '方案编写中']]),
      phaseIds: ['initiation', 'survey', 'solution', 'bidding', 'contract', 'detail_design', 'implementation', 'testing', 'trial', 'delivery', 'maintenance'],
      clientId: clientIdMap.bigdata, clientLeaderId: 'ct_1_1', clientExecutorId: 'ct_1_2',
      budget: 1200, manager: '张伟',
      createdAt: iso(daysAgo(60)), updatedAt: iso(daysAgo(1))
    },
    {
      id: id('proj', 2), name: '教育信息化2.0提升工程',
      description: '覆盖全市中小学的智慧教育平台升级，含在线教学、教学评价、校园安全三大子系统',
      progress: 20, startDate: daysAgo(35), endDate: daysAgo(-150),
      status: 'in_progress', currentPhaseId: 'survey',
      phaseHistory: makePhaseHistory([['initiation', 35, '可行性报告通过'], ['survey', 10, '正在走访学校']]),
      phaseIds: ['initiation', 'survey', 'solution', 'bidding', 'contract', 'implementation', 'testing', 'delivery'],
      clientId: clientIdMap.edu, clientLeaderId: 'ct_2_1', clientExecutorId: 'ct_2_2',
      budget: 800, manager: '李芳',
      createdAt: iso(daysAgo(35)), updatedAt: iso(daysAgo(4))
    },
    {
      id: id('proj', 3), name: '区县应急指挥调度系统',
      description: '建设区县级应急指挥调度平台，整合消防、安监、防汛等多源数据，实现统一调度',
      progress: 60, startDate: daysAgo(50), endDate: daysAgo(-30),
      status: 'in_progress', currentPhaseId: 'bidding',
      phaseHistory: makePhaseHistory([['initiation', 50], ['survey', 40], ['solution', 30, '方案评审通过'], ['bidding', 10, '标书编写中']]),
      phaseIds: ['initiation', 'survey', 'solution', 'bidding', 'contract', 'implementation', 'testing', 'trial', 'delivery'],
      clientId: clientIdMap.emergency, clientLeaderId: 'ct_6_1', clientExecutorId: 'ct_6_2',
      budget: 650, manager: '王强',
      createdAt: iso(daysAgo(50)), updatedAt: iso(daysAgo(1))
    },
    {
      id: id('proj', 4), name: '交通集团数字化转型规划咨询',
      description: '为省交通投资集团提供数字化转型顶层设计方案，涵盖智慧高速、智慧港口、智慧物流三大板块',
      progress: 10, startDate: daysAgo(15), endDate: daysAgo(-180),
      status: 'in_progress', currentPhaseId: 'initiation',
      phaseHistory: makePhaseHistory([['initiation', 15, '刚签约，项目启动']]),
      phaseIds: ['initiation', 'survey', 'solution', 'delivery'],
      clientId: clientIdMap.transport, clientLeaderId: 'ct_4_1', clientExecutorId: 'ct_4_2',
      budget: 350, manager: '陈明',
      createdAt: iso(daysAgo(15)), updatedAt: iso(daysAgo(2))
    },
    {
      id: id('proj', 5), name: '智慧医疗健康信息平台',
      description: '市级全民健康信息平台，对接医院HIS/LIS/PACS，实现居民健康档案共享',
      progress: 100, startDate: daysAgo(200), endDate: daysAgo(15),
      status: 'completed', currentPhaseId: 'maintenance',
      phaseHistory: makePhaseHistory([['initiation', 200], ['survey', 180], ['solution', 160], ['bidding', 140], ['contract', 120], ['detail_design', 100], ['implementation', 80], ['testing', 50], ['trial', 30], ['delivery', 15, '已验收交付']]),
      phaseIds: ['initiation', 'survey', 'solution', 'bidding', 'contract', 'detail_design', 'implementation', 'testing', 'trial', 'delivery', 'maintenance'],
      clientId: clientIdMap.health, clientLeaderId: 'ct_5_1', clientExecutorId: null,
      budget: 960, manager: '赵丽',
      createdAt: iso(daysAgo(200)), updatedAt: iso(daysAgo(15))
    },
    {
      id: id('proj', 6), name: '政务云迁移与安全加固',
      description: '将市级各部门业务系统迁移至统一政务云平台，同步实施等保三级安全加固',
      progress: 70, startDate: daysAgo(80), endDate: daysAgo(-20),
      status: 'in_progress', currentPhaseId: 'implementation',
      phaseHistory: makePhaseHistory([['initiation', 80], ['survey', 70], ['solution', 55], ['bidding', 45], ['contract', 35], ['detail_design', 25], ['implementation', 10, '迁移实施中']]),
      phaseIds: ['initiation', 'survey', 'solution', 'detail_design', 'implementation', 'testing', 'delivery'],
      clientId: clientIdMap.smartcity, clientLeaderId: 'ct_3_1', clientExecutorId: 'ct_3_2',
      budget: 580, manager: '刘洋',
      createdAt: iso(daysAgo(80)), updatedAt: iso(daysAgo(2))
    },
    {
      id: id('proj', 7), name: '生态环境监测预警平台',
      description: '建设覆盖全市的生态环境监测物联网平台，实现空气、水质、噪声实时监控和预警',
      progress: 0, startDate: daysAgo(5), endDate: daysAgo(-365),
      status: 'planning', currentPhaseId: 'initiation',
      phaseHistory: makePhaseHistory([['initiation', 5, '正在立项申报']]),
      phaseIds: ['initiation', 'survey', 'solution', 'bidding', 'contract', 'implementation', 'testing', 'delivery'],
      clientId: clientIdMap.env, clientLeaderId: 'ct_7_1', clientExecutorId: 'ct_7_2',
      budget: 450, manager: '张伟',
      createdAt: iso(daysAgo(5)), updatedAt: iso(daysAgo(5))
    },
    {
      id: id('proj', 8), name: '智慧旅游综合服务平台（已暂停）',
      description: '为市文旅集团打造全域旅游服务平台，含景区预约、导游导览、文创商城',
      progress: 15, startDate: daysAgo(45), endDate: daysAgo(-200),
      status: 'paused', currentPhaseId: 'survey',
      phaseHistory: makePhaseHistory([['initiation', 45], ['survey', 30, '需求调研中暂停']]),
      phaseIds: ['initiation', 'survey', 'solution', 'implementation', 'delivery'],
      clientId: clientIdMap.tourism, clientLeaderId: 'ct_8_1', clientExecutorId: 'ct_8_2',
      budget: 280, manager: '李芳',
      createdAt: iso(daysAgo(45)), updatedAt: iso(daysAgo(30))
    }
  ]

  const projIdMap = {
    smartcity: id('proj', 1), edu: id('proj', 2), emergency: id('proj', 3),
    transport: id('proj', 4), health: id('proj', 5), cloud: id('proj', 6),
    env: id('proj', 7), tourism: id('proj', 8)
  }

  const workLogs: WorkLog[] = [
    { id: id('log', 1), date: daysAgo(0), content: '上午到市大数据局参加智慧城市项目方案评审会，汇报数据治理模块技术方案。评审专家对数据标准化和质量管控部分提出修改意见，下午整理会议纪要并修改方案第三章。', categoryId: 'demo', clientId: clientIdMap.bigdata, projectId: projIdMap.smartcity, createdAt: iso(daysAgo(0)), updatedAt: iso(daysAgo(0)) },
    { id: id('log', 2), date: daysAgo(1), content: '与应急管理局赵主任沟通指挥调度系统招标时间节点，确认本月25号挂网。整理招标文件技术参数部分。', categoryId: 'client_visit', clientId: clientIdMap.emergency, projectId: projIdMap.emergency, createdAt: iso(daysAgo(1)), updatedAt: iso(daysAgo(1)) },
    { id: id('log', 3), date: daysAgo(1), content: '参加公司内部季度售前经验分享会，分享政务云迁移项目的售前经验。', categoryId: 'meeting', clientId: null, projectId: null, createdAt: iso(daysAgo(1)), updatedAt: iso(daysAgo(1)) },
    { id: id('log', 4), date: daysAgo(2), content: '全天在省交通集团驻场调研，访谈信息化管理部陈总及下属三个业务处室负责人。梳理出智慧高速、智慧港口、智慧物流三条业务线的数字化痛点。', categoryId: 'requirement', clientId: clientIdMap.transport, projectId: projIdMap.transport, createdAt: iso(daysAgo(2)), updatedAt: iso(daysAgo(2)) },
    { id: id('log', 5), date: daysAgo(3), content: '编写智慧城市大数据平台数据治理模块详细方案，完成数据标准体系、元数据管理、数据质量监控三个章节。', categoryId: 'solution', clientId: clientIdMap.bigdata, projectId: projIdMap.smartcity, createdAt: iso(daysAgo(3)), updatedAt: iso(daysAgo(3)) },
    { id: id('log', 6), date: daysAgo(4), content: '走访市教育局，与李主任沟通教育信息化2.0项目需求。下午参观市第三中学和实验小学。', categoryId: 'client_visit', clientId: clientIdMap.edu, projectId: projIdMap.edu, createdAt: iso(daysAgo(4)), updatedAt: iso(daysAgo(4)) },
    { id: id('log', 7), date: daysAgo(5), content: '整理应急指挥调度系统竞品分析报告，对比华为、中兴、海康三家方案的优劣势。', categoryId: 'competitive', clientId: clientIdMap.emergency, projectId: projIdMap.emergency, createdAt: iso(daysAgo(5)), updatedAt: iso(daysAgo(5)) },
    { id: id('log', 8), date: daysAgo(6), content: '参加政务云项目周例会，汇报第一批12个系统迁移进展。3个系统出现兼容性问题需协调。', categoryId: 'coordination', clientId: clientIdMap.smartcity, projectId: projIdMap.cloud, createdAt: iso(daysAgo(6)), updatedAt: iso(daysAgo(6)) },
    { id: id('log', 9), date: daysAgo(7), content: '与生态环境局何局长、钱科长交流智慧环保监测平台建设思路，对方对空气质量微站组网方案很感兴趣。', categoryId: 'tech_exchange', clientId: clientIdMap.env, projectId: projIdMap.env, createdAt: iso(daysAgo(7)), updatedAt: iso(daysAgo(7)) },
    { id: id('log', 10), date: daysAgo(8), content: '参加智慧城市项目技术选型培训，学习新一代数据湖架构和实时计算引擎技术方案。', categoryId: 'training', clientId: null, projectId: null, createdAt: iso(daysAgo(8)), updatedAt: iso(daysAgo(8)) },
    { id: id('log', 11), date: daysAgo(9), content: '编写应急指挥调度系统技术方案V2版，新增多源数据融合和GIS可视化功能描述。', categoryId: 'solution', clientId: clientIdMap.emergency, projectId: projIdMap.emergency, createdAt: iso(daysAgo(9)), updatedAt: iso(daysAgo(9)) },
    { id: id('log', 12), date: daysAgo(10), content: '出差到省城参加交通集团数字化转型项目启动会，与杨副总确认项目范围和交付计划。', categoryId: 'travel', clientId: clientIdMap.transport, projectId: projIdMap.transport, createdAt: iso(daysAgo(10)), updatedAt: iso(daysAgo(10)) },
    { id: id('log', 13), date: daysAgo(11), content: '智慧城市项目合同审批流程走完，与法务部确认合同条款无异议。', categoryId: 'approval', clientId: clientIdMap.bigdata, projectId: projIdMap.smartcity, createdAt: iso(daysAgo(11)), updatedAt: iso(daysAgo(11)) },
    { id: id('log', 14), date: daysAgo(13), content: '政务云迁移项目第一批12个系统完成迁移验证，与各委办局确认业务连续性测试结果。', categoryId: 'coordination', clientId: null, projectId: projIdMap.cloud, createdAt: iso(daysAgo(13)), updatedAt: iso(daysAgo(13)) },
    { id: id('log', 15), date: daysAgo(15), content: '智慧医疗健康信息平台运维月报编写，本月处理3起数据同步异常，系统可用率99.8%。', categoryId: 'other', clientId: clientIdMap.health, projectId: projIdMap.health, createdAt: iso(daysAgo(15)), updatedAt: iso(daysAgo(15)) },
    { id: id('log', 16), date: daysAgo(18), content: '智慧旅游平台项目暂停，与文旅集团郑总沟通后续跟进计划。对方表示Q4预算到位后重启。', categoryId: 'client_visit', clientId: clientIdMap.tourism, projectId: projIdMap.tourism, createdAt: iso(daysAgo(18)), updatedAt: iso(daysAgo(18)) },
    { id: id('log', 17), date: daysAgo(20), content: '编写Q2季度售前工作总结，汇总6个项目签约情况和Q3重点项目跟踪计划。', categoryId: 'other', clientId: null, projectId: null, createdAt: iso(daysAgo(20)), updatedAt: iso(daysAgo(20)) },
    { id: id('log', 18), date: daysAgo(25), content: '智慧医疗项目正式通过验收，市卫健委刘处签字确认。项目历时6个月，最终交付质量获好评。', categoryId: 'approval', clientId: clientIdMap.health, projectId: projIdMap.health, createdAt: iso(daysAgo(25)), updatedAt: iso(daysAgo(25)) }
  ]

  const todos: Todo[] = [
    { id: id('todo', 1), title: '完成智慧城市数据治理方案修改稿', description: '根据评审会意见修改方案第三章', status: 'in_progress', priority: 'high', dueDate: daysAgo(-2), projectId: projIdMap.smartcity, planTaskId: null, category: 'document', createdAt: iso(daysAgo(0)), updatedAt: iso(daysAgo(0)) },
    { id: id('todo', 2), title: '应急指挥调度系统投标文件终稿提交', description: '技术部分已完稿，需商务部分配合，25号前提交', status: 'pending', priority: 'high', dueDate: daysAgo(-10), projectId: projIdMap.emergency, planTaskId: null, category: 'document', createdAt: iso(daysAgo(5)), updatedAt: iso(daysAgo(1)) },
    { id: id('todo', 3), title: '教育信息化2.0项目需求调研报告编写', description: '汇总4所学校的调研结果', status: 'in_progress', priority: 'medium', dueDate: daysAgo(-5), projectId: projIdMap.edu, planTaskId: null, category: 'document', createdAt: iso(daysAgo(4)), updatedAt: iso(daysAgo(4)) },
    { id: id('todo', 4), title: '交通集团顶层设计方案第一版', description: '完成现状评估、愿景目标、架构设计三个核心章节', status: 'pending', priority: 'medium', dueDate: daysAgo(-15), projectId: projIdMap.transport, planTaskId: null, category: 'document', createdAt: iso(daysAgo(11)), updatedAt: iso(daysAgo(11)) },
    { id: id('todo', 5), title: '政务云迁移第二批系统评估报告', description: '对剩余18个待迁移系统进行迁移难度和风险评估', status: 'pending', priority: 'medium', dueDate: daysAgo(-8), projectId: projIdMap.cloud, planTaskId: null, category: 'document', createdAt: iso(daysAgo(2)), updatedAt: iso(daysAgo(2)) },
    { id: id('todo', 6), title: '整理Q2季度售前项目台账', description: '汇总本季度所有在跟项目进展和预计签约金额', status: 'completed', priority: 'low', dueDate: daysAgo(3), projectId: null, planTaskId: null, category: 'other', createdAt: iso(daysAgo(10)), updatedAt: iso(daysAgo(3)) },
    { id: id('todo', 7), title: '准备智慧城市项目月度汇报PPT', description: '大数据局要求每月提交项目进展汇报', status: 'pending', priority: 'high', dueDate: daysAgo(-1), projectId: projIdMap.smartcity, planTaskId: null, category: 'project', createdAt: iso(daysAgo(2)), updatedAt: iso(daysAgo(2)) },
    { id: id('todo', 8), title: '跟进卫健委区域医疗平台项目信息', description: '刘处提到下半年有区域医疗信息化新项目立项', status: 'pending', priority: 'medium', dueDate: daysAgo(-20), projectId: null, planTaskId: null, category: 'client', createdAt: iso(daysAgo(10)), updatedAt: iso(daysAgo(10)) },
    { id: id('todo', 9), title: '更新公司政务行业解决方案标准模板V3.2', description: '新增数据安全和等保合规章节', status: 'completed', priority: 'medium', dueDate: daysAgo(5), projectId: null, planTaskId: null, category: 'document', createdAt: iso(daysAgo(15)), updatedAt: iso(daysAgo(5)) },
    { id: id('todo', 10), title: '生态环境监测平台可行性报告', description: '为下周与生态环境局的交流准备技术可行性分析', status: 'pending', priority: 'low', dueDate: daysAgo(-5), projectId: projIdMap.env, planTaskId: null, category: 'document', createdAt: iso(daysAgo(3)), updatedAt: iso(daysAgo(3)) },
    { id: id('todo', 11), title: '智慧医疗项目运维报告提交', description: '按时提交6月份运维月报', status: 'completed', priority: 'low', dueDate: daysAgo(2), projectId: projIdMap.health, planTaskId: null, category: 'project', createdAt: iso(daysAgo(10)), updatedAt: iso(daysAgo(2)) },
    { id: id('todo', 12), title: '完成应急项目标书技术评分标准制定', description: '对标竞品制定差异化评分标准', status: 'in_progress', priority: 'high', dueDate: daysAgo(-3), projectId: projIdMap.emergency, planTaskId: null, category: 'document', createdAt: iso(daysAgo(7)), updatedAt: iso(daysAgo(1)) }
  ]

  const planTasks: PlanTask[] = [
    makePlanTask({ id: id('plan', 1), projectId: id('proj', 1), name: '需求调研与数据摸底', startDaysAgo: 60, endDaysAgo: 40, progress: 100, status: 'completed', order: 0 }),
    makePlanTask({ id: id('plan', 2), projectId: id('proj', 1), name: '数据标准与接口规范制定', startDaysAgo: 42, endDaysAgo: 25, progress: 100, status: 'completed', order: 1 }),
    makePlanTask({ id: id('plan', 3), projectId: id('proj', 1), name: '平台架构设计', startDaysAgo: 30, endDaysAgo: 10, progress: 80, status: 'in_progress', order: 2 }),
    makePlanTask({ id: id('plan', 4), projectId: id('proj', 1), name: '数据治理引擎开发', startDaysAgo: 15, endDaysAgo: -20, progress: 35, status: 'in_progress', order: 3 }),
    makePlanTask({ id: id('plan', 5), projectId: id('proj', 1), name: '可视化大屏开发', startDaysAgo: -5, endDaysAgo: -40, progress: 0, status: 'pending', order: 4 }),
    makePlanTask({ id: id('plan', 6), projectId: id('proj', 1), name: '系统联调与试运行', startDaysAgo: -45, endDaysAgo: -70, progress: 0, status: 'pending', order: 5 }),

    makePlanTask({ id: id('plan', 7), projectId: id('proj', 2), name: '学校走访与需求收集', startDaysAgo: 35, endDaysAgo: 20, progress: 70, status: 'in_progress', order: 0 }),
    makePlanTask({ id: id('plan', 8), projectId: id('proj', 2), name: '教学评价模型设计', startDaysAgo: 22, endDaysAgo: 5, progress: 20, status: 'in_progress', order: 1 }),
    makePlanTask({ id: id('plan', 9), projectId: id('proj', 2), name: '在线教学平台方案', startDaysAgo: -10, endDaysAgo: -50, progress: 0, status: 'pending', order: 2 }),
    makePlanTask({ id: id('plan', 10), projectId: id('proj', 2), name: '校园安全子系统规划', startDaysAgo: -30, endDaysAgo: -60, progress: 0, status: 'pending', order: 3 }),

    makePlanTask({ id: id('plan', 11), projectId: id('proj', 3), name: '应急数据源对接', startDaysAgo: 50, endDaysAgo: 30, progress: 100, status: 'completed', order: 0 }),
    makePlanTask({ id: id('plan', 12), projectId: id('proj', 3), name: '调度指挥方案设计', startDaysAgo: 35, endDaysAgo: 15, progress: 100, status: 'completed', order: 1 }),
    makePlanTask({ id: id('plan', 13), projectId: id('proj', 3), name: '标书编写与投标', startDaysAgo: 12, endDaysAgo: -15, progress: 55, status: 'in_progress', order: 2 }),
    makePlanTask({ id: id('plan', 14), projectId: id('proj', 3), name: '合同签订与启动', startDaysAgo: -20, endDaysAgo: -30, progress: 0, status: 'pending', order: 3 }),

    makePlanTask({ id: id('plan', 15), projectId: id('proj', 4), name: '现状调研与访谈', startDaysAgo: 15, endDaysAgo: 3, progress: 30, status: 'in_progress', order: 0 }),
    makePlanTask({ id: id('plan', 16), projectId: id('proj', 4), name: '顶层方案编写', startDaysAgo: -5, endDaysAgo: -100, progress: 0, status: 'pending', order: 1 }),
    makePlanTask({ id: id('plan', 17), projectId: id('proj', 4), name: '方案评审与交付', startDaysAgo: -120, endDaysAgo: -180, progress: 0, status: 'pending', order: 2 }),

    makePlanTask({ id: id('plan', 27), projectId: id('proj', 5), name: '需求调研与系统设计', startDaysAgo: 200, endDaysAgo: 160, progress: 100, status: 'completed', order: 0 }),
    makePlanTask({ id: id('plan', 28), projectId: id('proj', 5), name: '平台开发与联调', startDaysAgo: 155, endDaysAgo: 60, progress: 100, status: 'completed', order: 1 }),
    makePlanTask({ id: id('plan', 29), projectId: id('proj', 5), name: '试运行与验收', startDaysAgo: 55, endDaysAgo: 15, progress: 100, status: 'completed', order: 2 }),

    makePlanTask({ id: id('plan', 19), projectId: id('proj', 6), name: '云平台选型与架构', startDaysAgo: 80, endDaysAgo: 60, progress: 100, status: 'completed', order: 0 }),
    makePlanTask({ id: id('plan', 20), projectId: id('proj', 6), name: '业务系统迁移实施', startDaysAgo: 55, endDaysAgo: 10, progress: 75, status: 'in_progress', order: 1 }),
    makePlanTask({ id: id('plan', 21), projectId: id('proj', 6), name: '等保三级安全加固', startDaysAgo: 30, endDaysAgo: -10, progress: 40, status: 'in_progress', order: 2 }),
    makePlanTask({ id: id('plan', 22), projectId: id('proj', 6), name: '验收与运维交接', startDaysAgo: -15, endDaysAgo: -25, progress: 0, status: 'pending', order: 3 }),

    makePlanTask({ id: id('plan', 23), projectId: id('proj', 7), name: '立项申报与可行性研究', startDaysAgo: 5, endDaysAgo: -30, progress: 10, status: 'in_progress', order: 0 }),
    makePlanTask({ id: id('plan', 24), projectId: id('proj', 7), name: '监测点位规划', startDaysAgo: -35, endDaysAgo: -80, progress: 0, status: 'pending', order: 1 }),

    makePlanTask({ id: id('plan', 25), projectId: id('proj', 8), name: '需求调研（已暂停）', startDaysAgo: 45, endDaysAgo: 30, progress: 60, status: 'in_progress', order: 0 }),
    makePlanTask({ id: id('plan', 26), projectId: id('proj', 8), name: '平台设计（已暂停）', startDaysAgo: 25, endDaysAgo: -30, progress: 0, status: 'pending', order: 1 })
  ]

  const visitRecords = [
    { id: 'vr_001', clientId: id('client', 1), contactPersonId: 'ct_1_1', date: daysAgo(2), contact: '王志远', content: '讨论智慧城市平台二期数据归集范围，新增5个委办局接入', result: '明确二期需求范围，约定下周提交技术方案', nextPlan: '下周三前提交数据对接技术方案', createdAt: iso(daysAgo(2)) },
    { id: 'vr_002', clientId: id('client', 1), contactPersonId: 'ct_1_2', date: daysAgo(15), contact: '孙晓明', content: '技术对接会，确认数据治理引擎接口规范', result: '确定了API网关和数据交换格式', nextPlan: '输出接口文档初稿', createdAt: iso(daysAgo(15)) },
    { id: 'vr_003', clientId: id('client', 2), contactPersonId: 'ct_2_1', date: daysAgo(5), contact: '李明辉', content: '教育信息化2.0项目需求调研，走访3所试点学校', result: '收集到一线教师核心需求12项', nextPlan: '整理需求文档，安排产品演示', createdAt: iso(daysAgo(5)) },
    { id: 'vr_004', clientId: id('client', 4), contactPersonId: 'ct_4_1', date: daysAgo(3), contact: '陈国强', content: '数字化转型咨询项目初次方案汇报', result: '对方认可方案思路，需走内部审批流程', nextPlan: '等待对方内部立项审批，预计2周', createdAt: iso(daysAgo(3)) },
    { id: 'vr_005', clientId: id('client', 6), contactPersonId: 'ct_6_1', date: daysAgo(1), contact: '赵鹏飞', content: '应急指挥调度系统招标文件技术参数沟通', result: '了解到关键评分指标，竞品已提前介入', nextPlan: '紧急优化技术方案', createdAt: iso(daysAgo(1)) },
    { id: 'vr_006', clientId: id('client', 6), contactPersonId: 'ct_6_2', date: daysAgo(10), contact: '马强', content: '与技术科沟通系统技术选型', result: '对方倾向国产化方案', nextPlan: '调整技术方案突出国产化优势', createdAt: iso(daysAgo(10)) },
    { id: 'vr_007', clientId: id('client', 7), contactPersonId: 'ct_7_1', date: daysAgo(7), contact: '何建国', content: '初次拜访生态环境局，介绍智慧环保解决方案', result: '何局长表示感兴趣，安排下周与监测科详细沟通', nextPlan: '准备技术交流PPT', createdAt: iso(daysAgo(7)) },
    { id: 'vr_008', clientId: id('client', 7), contactPersonId: 'ct_7_2', date: daysAgo(5), contact: '钱丽萍', content: '与监测信息科对接环境监测数据需求', result: '梳理出空气质量、水质、噪声三类监测需求', nextPlan: '编写监测平台可行性报告', createdAt: iso(daysAgo(5)) },
    { id: 'vr_009', clientId: id('client', 5), contactPersonId: 'ct_5_1', date: daysAgo(25), contact: '刘雅琴', content: '智慧医疗项目验收签字', result: '刘处签字确认验收，项目正式交付', nextPlan: '持续运维支持', createdAt: iso(daysAgo(25)) },
    { id: 'vr_010', clientId: id('client', 8), contactPersonId: 'ct_8_1', date: daysAgo(60), contact: '郑浩然', content: '与文旅集团郑总沟通智慧旅游平台暂停事宜', result: '对方表示Q4预算到位后重启', nextPlan: 'Q3末再跟进', createdAt: iso(daysAgo(60)) }
  ]

  const reports: Report[] = [
    { id: id('report', 1), type: 'day', periodLabel: daysAgo(1), startDate: daysAgo(1), endDate: daysAgo(1), content: '今日主要工作：1.与应急局赵主任沟通招标时间节点；2.参加公司内部售前经验分享会。明日计划：修改智慧城市数据治理方案。', createdAt: iso(daysAgo(1)) },
    { id: id('report', 2), type: 'day', periodLabel: daysAgo(2), startDate: daysAgo(2), endDate: daysAgo(2), content: '今日主要工作：全天在省交通集团驻场调研，访谈三个业务处室，形成初步需求清单。', createdAt: iso(daysAgo(2)) },
    { id: id('report', 3), type: 'week', periodLabel: '第' + Math.ceil((new Date().getDate()) / 7) + '周', startDate: daysAgo(7), endDate: daysAgo(1), content: '本周工作总结：1.智慧城市方案评审并修改；2.应急项目招标沟通；3.交通集团驻场调研；4.教育信息化走访学校。下周重点：完成数据治理方案终稿、应急标书技术部分。', createdAt: iso(daysAgo(1)) },
    { id: id('report', 4), type: 'month', periodLabel: (new Date().getMonth()) + '月', startDate: daysAgo(30), endDate: daysAgo(1), content: '本月工作总结：在跟项目6个，新增项目1个（生态环境监测），完成项目1个（智慧医疗验收）。重点成果：智慧城市项目通过方案评审，应急项目进入投标阶段，交通集团项目完成签约启动。下月计划：应急项目投标、教育信息化方案评审、政务云第二批迁移。', createdAt: iso(daysAgo(1)) }
  ]

  storage.saveClients(clients)
  storage.saveVisitRecords(visitRecords)
  storage.saveProjects(projects)
  storage.saveWorkLogs(workLogs)
  storage.saveTodos(todos)
  storage.savePlanTasks(planTasks)
  storage.saveReports(reports)
}
