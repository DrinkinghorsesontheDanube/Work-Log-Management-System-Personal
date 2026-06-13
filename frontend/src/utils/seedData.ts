import type { Client, Project, WorkLog, Todo, PhaseRecord, PlanTask } from '../types'
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
    return {
      phaseId,
      startDate: start,
      endDate: null,
      note: note || ''
    }
  })
}

export function seedAllData() {
  storage.clearAllData()

  const today = daysAgo(0)

  const clients: Client[] = [
    {
      id: id('client', 1), name: '市大数据局', type: 'government',
      contact: '王志远', phone: '138****5521', department: '数据资源管理处',
      notes: '智慧城市项目牵头单位，今年预算充足，重点客户',
      createdAt: iso(daysAgo(90)), updatedAt: iso(daysAgo(3))
    },
    {
      id: id('client', 2), name: '市教育局', type: 'government',
      contact: '李明辉', phone: '139****8832', department: '教育信息化办公室',
      notes: '教育信息化2.0项目，需关注省厅政策动向',
      createdAt: iso(daysAgo(75)), updatedAt: iso(daysAgo(5))
    },
    {
      id: id('client', 3), name: '区智慧城市运营中心', type: 'government',
      contact: '张晓峰', phone: '136****6617', department: '运营管理部',
      notes: '负责区级智慧城市平台运营，对接数据归集需求',
      createdAt: iso(daysAgo(60)), updatedAt: iso(daysAgo(7))
    },
    {
      id: id('client', 4), name: '省交通投资集团', type: 'enterprise',
      contact: '陈国强', phone: '137****9943', department: '信息化管理部',
      notes: '数字化转型咨询，预算较大但决策链长',
      createdAt: iso(daysAgo(45)), updatedAt: iso(daysAgo(2))
    },
    {
      id: id('client', 5), name: '市卫生健康委', type: 'government',
      contact: '刘雅琴', phone: '135****2206', department: '规划发展与信息化处',
      notes: '智慧医疗平台已交付，运维阶段，后续有区域医疗信息平台需求',
      createdAt: iso(daysAgo(120)), updatedAt: iso(daysAgo(10))
    },
    {
      id: id('client', 6), name: '市应急管理局', type: 'government',
      contact: '赵鹏飞', phone: '133****7748', department: '应急指挥中心',
      notes: '应急指挥调度系统招标在即，竞品压力大',
      createdAt: iso(daysAgo(40)), updatedAt: iso(daysAgo(1))
    }
  ]

  const projects: Project[] = [
    {
      id: id('proj', 1), name: '市智慧城市大数据平台建设', description: '建设市级大数据汇聚、治理、共享、开放平台，对接30+委办局数据，实现城市运行态势感知',
      progress: 45, startDate: daysAgo(60), endDate: daysAgo(-90),
      status: 'in_progress', currentPhaseId: 'solution',
      phaseHistory: makePhaseHistory([['initiation', 60, '立项完成'], ['survey', 45, '需求调研两周'], ['solution', 20, '方案编写中']]),
      clientId: null, budget: 1200, manager: '张伟',
      createdAt: iso(daysAgo(60)), updatedAt: iso(daysAgo(1))
    },
    {
      id: id('proj', 2), name: '教育信息化2.0提升工程', description: '覆盖全市中小学的智慧教育平台升级，含在线教学、教学评价、校园安全三大子系统',
      progress: 20, startDate: daysAgo(35), endDate: daysAgo(-150),
      status: 'in_progress', currentPhaseId: 'survey',
      phaseHistory: makePhaseHistory([['initiation', 35, '可行性报告通过'], ['survey', 10, '正在走访学校']]),
      clientId: null, budget: 800, manager: '李芳',
      createdAt: iso(daysAgo(35)), updatedAt: iso(daysAgo(4))
    },
    {
      id: id('proj', 3), name: '区县应急指挥调度系统', description: '建设区县级应急指挥调度平台，整合消防、安监、防汛等多源数据，实现统一调度',
      progress: 60, startDate: daysAgo(50), endDate: daysAgo(-30),
      status: 'in_progress', currentPhaseId: 'bidding',
      phaseHistory: makePhaseHistory([['initiation', 50], ['survey', 40], ['solution', 30, '方案评审通过'], ['bidding', 10, '标书编写中']]),
      clientId: null, budget: 650, manager: '王强',
      createdAt: iso(daysAgo(50)), updatedAt: iso(daysAgo(1))
    },
    {
      id: id('proj', 4), name: '交通集团数字化转型规划咨询', description: '为省交通投资集团提供数字化转型顶层设计方案，涵盖智慧高速、智慧港口、智慧物流三大板块',
      progress: 10, startDate: daysAgo(15), endDate: daysAgo(-180),
      status: 'in_progress', currentPhaseId: 'initiation',
      phaseHistory: makePhaseHistory([['initiation', 15, '刚签约，项目启动']]),
      clientId: null, budget: 350, manager: '陈明',
      createdAt: iso(daysAgo(15)), updatedAt: iso(daysAgo(2))
    },
    {
      id: id('proj', 5), name: '智慧医疗健康信息平台', description: '市级全民健康信息平台，对接医院HIS/LIS/PACS，实现居民健康档案共享',
      progress: 100, startDate: daysAgo(180), endDate: daysAgo(15),
      status: 'completed', currentPhaseId: 'maintenance',
      phaseHistory: makePhaseHistory([['initiation', 180], ['survey', 160], ['solution', 140], ['bidding', 120], ['contract', 100], ['detail_design', 90], ['implementation', 70], ['testing', 40], ['trial', 25], ['delivery', 15, '已验收交付']]),
      clientId: null, budget: 960, manager: '赵丽',
      createdAt: iso(daysAgo(180)), updatedAt: iso(daysAgo(15))
    },
    {
      id: id('proj', 6), name: '政务云迁移与安全加固', description: '将市级各部门业务系统迁移至统一政务云平台，同步实施等保三级安全加固',
      progress: 70, startDate: daysAgo(80), endDate: daysAgo(-20),
      status: 'in_progress', currentPhaseId: 'implementation',
      phaseHistory: makePhaseHistory([['initiation', 80], ['survey', 70], ['solution', 55], ['bidding', 45], ['contract', 35], ['detail_design', 25], ['implementation', 10, '迁移实施中']]),
      clientId: null, budget: 580, manager: '刘洋',
      createdAt: iso(daysAgo(80)), updatedAt: iso(daysAgo(2))
    }
  ]

  const clientIdMap = {
    bigdata: id('client', 1),
    edu: id('client', 2),
    smartcity: id('client', 3),
    transport: id('client', 4),
    health: id('client', 5),
    emergency: id('client', 6)
  }
  const projIdMap = {
    smartcity: id('proj', 1),
    edu: id('proj', 2),
    emergency: id('proj', 3),
    transport: id('proj', 4),
    health: id('proj', 5),
    cloud: id('proj', 6)
  }

  const workLogs: WorkLog[] = [
    {
      id: id('log', 1), date: daysAgo(0),
      content: '上午到市大数据局参加智慧城市项目方案评审会，汇报数据治理模块技术方案。评审专家对数据标准化和质量管控部分提出修改意见，下午整理会议纪要并修改方案第三章。',
      categoryId: 'demo', clientId: clientIdMap.bigdata, projectId: projIdMap.smartcity, planTaskId: null,
      createdAt: iso(daysAgo(0)), updatedAt: iso(daysAgo(0))
    },
    {
      id: id('log', 2), date: daysAgo(1),
      content: '与应急管理局赵主任沟通指挥调度系统招标时间节点，确认本月25号挂网。整理招标文件技术参数部分，重点补充多源数据融合和GIS可视化功能描述。',
      categoryId: 'client_visit', clientId: clientIdMap.emergency, projectId: projIdMap.emergency, planTaskId: null,
      createdAt: iso(daysAgo(1)), updatedAt: iso(daysAgo(1))
    },
    {
      id: id('log', 3), date: daysAgo(1),
      content: '下午参加公司内部季度售前经验分享会，分享政务云迁移项目的售前经验，重点讲了等保合规的差异化竞争策略。',
      categoryId: 'meeting', clientId: null, projectId: null, planTaskId: null,
      createdAt: iso(daysAgo(1)), updatedAt: iso(daysAgo(1))
    },
    {
      id: id('log', 4), date: daysAgo(2),
      content: '全天在省交通集团驻场调研，访谈信息化管理部陈总及下属三个业务处室负责人。梳理出智慧高速、智慧港口、智慧物流三条业务线的数字化痛点，形成初步需求清单。',
      categoryId: 'requirement', clientId: clientIdMap.transport, projectId: projIdMap.transport, planTaskId: null,
      createdAt: iso(daysAgo(2)), updatedAt: iso(daysAgo(2))
    },
    {
      id: id('log', 5), date: daysAgo(3),
      content: '编写智慧城市大数据平台数据治理模块详细方案，完成数据标准体系、元数据管理、数据质量监控三个章节。同步整理数据归集接口对接的30个委办局清单。',
      categoryId: 'solution', clientId: clientIdMap.bigdata, projectId: projIdMap.smartcity, planTaskId: null,
      createdAt: iso(daysAgo(3)), updatedAt: iso(daysAgo(3))
    },
    {
      id: id('log', 6), date: daysAgo(4),
      content: '上午走访市教育局，与李主任沟通教育信息化2.0项目需求。下午参观市第三中学和实验小学，了解一线教师对现有教学平台的使用反馈和痛点。',
      categoryId: 'client_visit', clientId: clientIdMap.edu, projectId: projIdMap.edu, planTaskId: null,
      createdAt: iso(daysAgo(4)), updatedAt: iso(daysAgo(4))
    },
    {
      id: id('log', 7), date: daysAgo(5),
      content: '参加华为政务云解决方案线上技术交流，了解最新鲲鹏政务云底座和数据安全方案。对比分析与阿里云、电信天翼云的差异化优势。',
      categoryId: 'tech_exchange', clientId: null, projectId: projIdMap.cloud, planTaskId: null,
      createdAt: iso(daysAgo(5)), updatedAt: iso(daysAgo(5))
    },
    {
      id: id('log', 8), date: daysAgo(5),
      content: '完成应急指挥调度系统投标文件技术部分初稿，重点编写GIS一张图、多源数据融合、AI智能预警三个核心功能模块的技术方案。',
      categoryId: 'bidding', clientId: clientIdMap.emergency, projectId: projIdMap.emergency, planTaskId: null,
      createdAt: iso(daysAgo(5)), updatedAt: iso(daysAgo(5))
    },
    {
      id: id('log', 9), date: daysAgo(6),
      content: '出差省城参加省交通集团数字化转型项目启动会。会议明确项目组织架构、里程碑计划和汇报机制。会后与陈总团队共进晚餐，进一步沟通项目预期。',
      categoryId: 'travel', clientId: clientIdMap.transport, projectId: projIdMap.transport, planTaskId: null,
      createdAt: iso(daysAgo(6)), updatedAt: iso(daysAgo(6))
    },
    {
      id: id('log', 10), date: daysAgo(7),
      content: '分析三家竞品（浪潮、中电数创、烽火）在智慧城市领域的方案特点和报价策略，形成竞品分析报告。重点研究浪潮在数据治理方面的优势。',
      categoryId: 'competitive', clientId: null, projectId: projIdMap.smartcity, planTaskId: null,
      createdAt: iso(daysAgo(7)), updatedAt: iso(daysAgo(7))
    },
    {
      id: id('log', 11), date: daysAgo(8),
      content: '上午与公司技术架构师讨论智慧医疗平台运维交接方案，确认SLA指标和运维团队配置。下午参加市卫健委信息化工作例会，汇报平台运行情况。',
      categoryId: 'coordination', clientId: clientIdMap.health, projectId: projIdMap.health, planTaskId: null,
      createdAt: iso(daysAgo(8)), updatedAt: iso(daysAgo(8))
    },
    {
      id: id('log', 12), date: daysAgo(9),
      content: '为新入职的两位售前同事进行方案编写培训，分享政务信息化项目方案的标准模板和编写技巧。整理培训材料PPT共45页。',
      categoryId: 'training', clientId: null, projectId: null, planTaskId: null,
      createdAt: iso(daysAgo(9)), updatedAt: iso(daysAgo(9))
    },
    {
      id: id('log', 13), date: daysAgo(10),
      content: '智慧城市项目合同审批流程走完，与法务部确认合同条款无异议。下午向大数据局王处长发送正式合同文本，等待对方走内部审批。',
      categoryId: 'approval', clientId: clientIdMap.bigdata, projectId: projIdMap.smartcity, planTaskId: null,
      createdAt: iso(daysAgo(10)), updatedAt: iso(daysAgo(10))
    },
    {
      id: id('log', 14), date: daysAgo(11),
      content: '全天编写交通集团数字化转型顶层设计方案框架，完成现状评估和愿景目标两个章节。参考了山东高速和浙江交投的数字化转型案例。',
      categoryId: 'solution', clientId: clientIdMap.transport, projectId: projIdMap.transport, planTaskId: null,
      createdAt: iso(daysAgo(11)), updatedAt: iso(daysAgo(11))
    },
    {
      id: id('log', 15), date: daysAgo(12),
      content: '在公司接待区智慧城市运营中心张主任一行三人，演示公司智慧城市平台产品和成功案例。张主任对城市运行态势感知大屏很感兴趣。',
      categoryId: 'demo', clientId: clientIdMap.smartcity, projectId: null, planTaskId: null,
      createdAt: iso(daysAgo(12)), updatedAt: iso(daysAgo(12))
    },
    {
      id: id('log', 16), date: daysAgo(13),
      content: '政务云迁移项目第一批12个系统完成迁移验证，与各委办局确认业务连续性测试结果。其中3个系统出现兼容性问题，协调开发团队排查修复。',
      categoryId: 'coordination', clientId: null, projectId: projIdMap.cloud, planTaskId: null,
      createdAt: iso(daysAgo(13)), updatedAt: iso(daysAgo(13))
    },
    {
      id: id('log', 17), date: daysAgo(14),
      content: '参加市数据局组织的公共数据开放推进会，了解数据开放目录编制要求。会后整理数据开放技术规范文档，为智慧城市项目数据开放模块做准备。',
      categoryId: 'meeting', clientId: clientIdMap.bigdata, projectId: projIdMap.smartcity, planTaskId: null,
      createdAt: iso(daysAgo(14)), updatedAt: iso(daysAgo(14))
    }
  ]

  const todos: Todo[] = [
    {
      id: id('todo', 1), title: '完成智慧城市数据治理方案修改稿，提交评审专家组复审',
      description: '根据评审会意见修改方案第三章', status: 'in_progress', priority: 'high',
      dueDate: daysAgo(-2), projectId: projIdMap.smartcity, planTaskId: null,
      createdAt: iso(daysAgo(0)), updatedAt: iso(daysAgo(0))
    },
    {
      id: id('todo', 2), title: '应急指挥调度系统投标文件终稿提交',
      description: '技术部分已完稿，需商务部分配合，25号前提交', status: 'pending', priority: 'high',
      dueDate: daysAgo(-10), projectId: projIdMap.emergency, planTaskId: null,
      createdAt: iso(daysAgo(5)), updatedAt: iso(daysAgo(1))
    },
    {
      id: id('todo', 3), title: '教育信息化2.0项目需求调研报告编写',
      description: '汇总4所学校的调研结果，形成需求调研报告', status: 'in_progress', priority: 'medium',
      dueDate: daysAgo(-5), projectId: projIdMap.edu, planTaskId: null,
      createdAt: iso(daysAgo(4)), updatedAt: iso(daysAgo(4))
    },
    {
      id: id('todo', 4), title: '交通集团数字化转型顶层设计方案（第一版）',
      description: '完成现状评估、愿景目标、架构设计三个核心章节', status: 'pending', priority: 'medium',
      dueDate: daysAgo(-15), projectId: projIdMap.transport, planTaskId: null,
      createdAt: iso(daysAgo(11)), updatedAt: iso(daysAgo(11))
    },
    {
      id: id('todo', 5), title: '政务云迁移第二批系统评估报告',
      description: '对剩余18个待迁移系统进行迁移难度和风险评估', status: 'pending', priority: 'medium',
      dueDate: daysAgo(-8), projectId: projIdMap.cloud, planTaskId: null,
      createdAt: iso(daysAgo(2)), updatedAt: iso(daysAgo(2))
    },
    {
      id: id('todo', 6), title: '整理Q2季度售前项目台账，提交部门经理审阅',
      description: '汇总本季度所有在跟项目进展和预计签约金额', status: 'pending', priority: 'low',
      dueDate: daysAgo(-3), projectId: null, planTaskId: null,
      createdAt: iso(daysAgo(3)), updatedAt: iso(daysAgo(3))
    },
    {
      id: id('todo', 7), title: '联系浪潮代理商了解最新数据治理产品报价',
      description: '竞品分析需要，确认浪潮DataGov平台最新授权价格', status: 'pending', priority: 'low',
      dueDate: daysAgo(-7), projectId: projIdMap.smartcity, planTaskId: null,
      createdAt: iso(daysAgo(7)), updatedAt: iso(daysAgo(7))
    },
    {
      id: id('todo', 8), title: '准备智慧城市项目月度汇报PPT',
      description: '大数据局要求每月提交项目进展汇报', status: 'pending', priority: 'high',
      dueDate: daysAgo(-1), projectId: projIdMap.smartcity, planTaskId: null,
      createdAt: iso(daysAgo(2)), updatedAt: iso(daysAgo(2))
    },
    {
      id: id('todo', 9), title: '更新公司政务行业解决方案标准模板（V3.2）',
      description: '新增数据安全和等保合规章节', status: 'pending', priority: 'medium',
      dueDate: daysAgo(-12), projectId: null, planTaskId: null,
      createdAt: iso(daysAgo(8)), updatedAt: iso(daysAgo(8))
    },
    {
      id: id('todo', 10), title: '跟进卫健委后续区域医疗平台项目信息',
      description: '市卫健委刘处提到下半年有区域医疗信息化新项目立项', status: 'pending', priority: 'medium',
      dueDate: daysAgo(-20), projectId: null, planTaskId: null,
      createdAt: iso(daysAgo(10)), updatedAt: iso(daysAgo(10))
    }
  ]

  const planTasks: PlanTask[] = [
    { id: id('plan', 1), projectId: id('proj', 1), name: '需求调研与数据摸底', startDate: daysAgo(60), endDate: daysAgo(40), progress: 100, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'completed', order: 0, createdAt: iso(daysAgo(60)), updatedAt: iso(daysAgo(40)) },
    { id: id('plan', 2), projectId: id('proj', 1), name: '数据标准与接口规范制定', startDate: daysAgo(42), endDate: daysAgo(25), progress: 100, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'completed', order: 1, createdAt: iso(daysAgo(42)), updatedAt: iso(daysAgo(25)) },
    { id: id('plan', 3), projectId: id('proj', 1), name: '平台架构设计', startDate: daysAgo(30), endDate: daysAgo(10), progress: 80, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'in_progress', order: 2, createdAt: iso(daysAgo(30)), updatedAt: iso(daysAgo(2)) },
    { id: id('plan', 4), projectId: id('proj', 1), name: '数据治理引擎开发', startDate: daysAgo(15), endDate: daysAgo(-20), progress: 35, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'in_progress', order: 3, createdAt: iso(daysAgo(15)), updatedAt: iso(daysAgo(1)) },
    { id: id('plan', 5), projectId: id('proj', 1), name: '可视化大屏开发', startDate: daysAgo(-5), endDate: daysAgo(-40), progress: 0, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'pending', order: 4, createdAt: iso(daysAgo(10)), updatedAt: iso(daysAgo(10)) },
    { id: id('plan', 6), projectId: id('proj', 1), name: '系统联调与试运行', startDate: daysAgo(-45), endDate: daysAgo(-70), progress: 0, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'pending', order: 5, createdAt: iso(daysAgo(10)), updatedAt: iso(daysAgo(10)) },

    { id: id('plan', 7), projectId: id('proj', 2), name: '学校走访与需求收集', startDate: daysAgo(35), endDate: daysAgo(20), progress: 70, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'in_progress', order: 0, createdAt: iso(daysAgo(35)), updatedAt: iso(daysAgo(3)) },
    { id: id('plan', 8), projectId: id('proj', 2), name: '教学评价模型设计', startDate: daysAgo(22), endDate: daysAgo(5), progress: 20, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'in_progress', order: 1, createdAt: iso(daysAgo(22)), updatedAt: iso(daysAgo(5)) },
    { id: id('plan', 9), projectId: id('proj', 2), name: '在线教学平台方案', startDate: daysAgo(-10), endDate: daysAgo(-50), progress: 0, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'pending', order: 2, createdAt: iso(daysAgo(10)), updatedAt: iso(daysAgo(10)) },
    { id: id('plan', 10), projectId: id('proj', 2), name: '校园安全子系统规划', startDate: daysAgo(-30), endDate: daysAgo(-60), progress: 0, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'pending', order: 3, createdAt: iso(daysAgo(10)), updatedAt: iso(daysAgo(10)) },

    { id: id('plan', 11), projectId: id('proj', 3), name: '应急数据源对接', startDate: daysAgo(50), endDate: daysAgo(30), progress: 100, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'completed', order: 0, createdAt: iso(daysAgo(50)), updatedAt: iso(daysAgo(30)) },
    { id: id('plan', 12), projectId: id('proj', 3), name: '调度指挥方案设计', startDate: daysAgo(35), endDate: daysAgo(15), progress: 100, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'completed', order: 1, createdAt: iso(daysAgo(35)), updatedAt: iso(daysAgo(15)) },
    { id: id('plan', 13), projectId: id('proj', 3), name: '标书编写与投标', startDate: daysAgo(12), endDate: daysAgo(-15), progress: 55, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'in_progress', order: 2, createdAt: iso(daysAgo(12)), updatedAt: iso(daysAgo(1)) },
    { id: id('plan', 14), projectId: id('proj', 3), name: '合同签订与启动', startDate: daysAgo(-20), endDate: daysAgo(-30), progress: 0, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'pending', order: 3, createdAt: iso(daysAgo(10)), updatedAt: iso(daysAgo(10)) },

    { id: id('plan', 19), projectId: id('proj', 6), name: '云平台选型与架构', startDate: daysAgo(80), endDate: daysAgo(60), progress: 100, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'completed', order: 0, createdAt: iso(daysAgo(80)), updatedAt: iso(daysAgo(60)) },
    { id: id('plan', 20), projectId: id('proj', 6), name: '业务系统迁移实施', startDate: daysAgo(55), endDate: daysAgo(10), progress: 75, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'in_progress', order: 1, createdAt: iso(daysAgo(55)), updatedAt: iso(daysAgo(2)) },
    { id: id('plan', 21), projectId: id('proj', 6), name: '等保三级安全加固', startDate: daysAgo(30), endDate: daysAgo(-10), progress: 40, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'in_progress', order: 2, createdAt: iso(daysAgo(30)), updatedAt: iso(daysAgo(3)) },
    { id: id('plan', 22), projectId: id('proj', 6), name: '验收与运维交接', startDate: daysAgo(-15), endDate: daysAgo(-25), progress: 0, parentId: null, duration: 0, includeHolidays: false, actualStartDate: null, actualEndDate: null, status: 'pending', order: 3, createdAt: iso(daysAgo(10)), updatedAt: iso(daysAgo(10)) }
  ]

  storage.saveClients(clients)
  storage.saveProjects(projects)
  storage.saveWorkLogs(workLogs)
  storage.saveTodos(todos)
  storage.savePlanTasks(planTasks)
}
