import express from 'express';
import cors from 'cors';
import initSqlJs from 'sql.js';
import multer from 'multer';
import ExcelJS from 'exceljs';
import dayjs from 'dayjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 10086;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_PATH = path.join(__dirname, 'work_log.db');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'exports'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'backup'), { recursive: true });

let db;

function getProjectStages() {
  const cfg = dbGet("SELECT config_value FROM system_config WHERE config_key = 'project_stages'");
  if (cfg) {
    try { return JSON.parse(cfg.config_value); } catch (e) { /* fall through */ }
  }
  return {
    initial_contact: '初步接触',
    requirement_confirm: '需求确认',
    solution_submit: '方案提交',
    bid_preparation: '投标准备',
    signed: '已签约',
    lost: '已丢单'
  };
}

function resolveProjectStages(project) {
  if (project && project.stages) {
    try {
      const custom = JSON.parse(project.stages);
      if (custom && typeof custom === 'object' && Object.keys(custom).length > 0) {
        return custom;
      }
    } catch (e) { /* fall through */ }
  }
  return getProjectStages();
}

function dbRun(sql, params = []) {
  try {
    db.run(sql, params);
    return { changes: db.getRowsModified(), lastInsertRowid: db.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0] };
  } catch (e) {
    throw e;
  }
}

function dbQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function dbGet(sql, params = []) {
  const rows = dbQuery(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function initDb() {
  dbRun(`CREATE TABLE IF NOT EXISTS work_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    duration_min INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    sub_category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    related_project_id INTEGER,
    tags TEXT,
    is_remedy INTEGER DEFAULT 0,
    create_time TEXT DEFAULT (datetime('now','localtime'))
  )`);

  dbRun(`CREATE TABLE IF NOT EXISTS project (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    customer TEXT,
    stage TEXT NOT NULL DEFAULT 'initial_contact',
    note TEXT,
    is_closed INTEGER DEFAULT 0,
    create_time TEXT DEFAULT (datetime('now','localtime')),
    stage_change_time TEXT DEFAULT (datetime('now','localtime'))
  )`);

  try { dbRun('ALTER TABLE project ADD COLUMN stages TEXT'); } catch (e) {}
  try { dbRun('ALTER TABLE project ADD COLUMN members TEXT'); } catch (e) {}

  dbRun(`CREATE TABLE IF NOT EXISTS document (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    related_log_id INTEGER,
    related_project_id INTEGER,
    related_stage TEXT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    upload_time TEXT DEFAULT (datetime('now','localtime'))
  )`);

  dbRun(`CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT
  )`);

  dbRun(`CREATE INDEX IF NOT EXISTS idx_log_date ON work_log(log_date)`);
  dbRun(`CREATE INDEX IF NOT EXISTS idx_project_id ON work_log(related_project_id)`);

  const existing = dbGet("SELECT config_value FROM system_config WHERE config_key = 'categories'");
  if (!existing) {
    dbRun("INSERT INTO system_config (config_key, config_value) VALUES (?, ?)", ['categories', JSON.stringify({
      '项目性工作': ['客户拜访/交流', '需求调研与分析', '方案/可研/设计编制', '投标文件编制与支撑', '技术交流/演示', '供应商/合作伙伴沟通', '项目评审会', '其他项目工作'],
      '事务性工作': ['部门例会/内部会议', '流程发起与跟进', '制度/文件学习', '日报/周报/月报撰写', '内部培训/分享', '领导交办任务', '行政综合事务', '其他事务']
    })]);
    dbRun("INSERT INTO system_config (config_key, config_value) VALUES (?, ?)", ['tags', '报销,合同,党务,临时任务,出差,其他']);
    dbRun("INSERT INTO system_config (config_key, config_value) VALUES (?, ?)", ['reminder_enabled', 'true']);
    dbRun("INSERT INTO system_config (config_key, config_value) VALUES (?, ?)", ['reminder_time', '17:30']);
    dbRun("INSERT INTO system_config (config_key, config_value) VALUES (?, ?)", ['project_stages', JSON.stringify({
      initial_contact: '初步接触',
      requirement_confirm: '需求确认',
      solution_submit: '方案提交',
      bid_preparation: '投标准备',
      signed: '已签约',
      lost: '已丢单'
    })]);
  }
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function enrichLog(log) {
  if (!log) return null;
  return {
    ...log,
    tags: log.tags ? log.tags.split(',').filter(Boolean) : [],
    is_remedy: !!log.is_remedy,
    project_name: log.related_project_id ? (dbGet('SELECT name FROM project WHERE id = ?', [log.related_project_id])?.name || null) : null
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ts = dayjs().format('YYYYMMDDHHmmss');
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._\u4e00-\u9fa5-]/g, '_');
    cb(null, `${ts}_${safeName}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ================== Work Log APIs ==================

app.get('/api/log', (req, res) => {
  try {
    let sql = 'SELECT * FROM work_log WHERE 1=1';
    const params = [];

    if (req.query.date) { sql += ' AND log_date = ?'; params.push(req.query.date); }
    if (req.query.project_id) { sql += ' AND related_project_id = ?'; params.push(parseInt(req.query.project_id)); }
    if (req.query.category) { sql += ' AND category = ?'; params.push(req.query.category); }
    if (req.query.start_date) { sql += ' AND log_date >= ?'; params.push(req.query.start_date); }
    if (req.query.end_date) { sql += ' AND log_date <= ?'; params.push(req.query.end_date); }

    sql += ' ORDER BY log_date DESC, start_time DESC';

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = dbQuery(countSql, params);
    const total = countResult[0]?.total || 0;

    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 50;
    const offset = (page - 1) * perPage;
    sql += ' LIMIT ? OFFSET ?';
    params.push(perPage, offset);

    const logs = dbQuery(sql, params).map(enrichLog);
    res.json({ items: logs, total, page, pages: Math.ceil(total / perPage) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/log/:id', (req, res) => {
  const log = dbGet('SELECT * FROM work_log WHERE id = ?', [req.params.id]);
  if (!log) return res.status(404).json({ error: 'Not found' });
  const enriched = enrichLog(log);
  enriched.documents = dbQuery('SELECT * FROM document WHERE related_log_id = ?', [log.id]);
  res.json(enriched);
});

app.post('/api/log', (req, res) => {
  try {
    const data = req.body;
    const result = dbRun(
      `INSERT INTO work_log (log_date, start_time, end_time, duration_min, category, sub_category, title, content, related_project_id, tags, is_remedy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.log_date || dayjs().format('YYYY-MM-DD'),
        data.start_time || null,
        data.end_time || null,
        data.duration_min || 0,
        data.category || '事务性工作',
        data.sub_category || '其他事务',
        data.title || '',
        data.content || '',
        data.related_project_id || null,
        Array.isArray(data.tags) ? data.tags.join(',') : (data.tags || ''),
        data.is_remedy ? 1 : 0
      ]
    );
    saveDb();
    const log = dbGet('SELECT * FROM work_log WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(enrichLog(log));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/log/:id', (req, res) => {
  try {
    const log = dbGet('SELECT * FROM work_log WHERE id = ?', [req.params.id]);
    if (!log) return res.status(404).json({ error: 'Not found' });

    const data = req.body;
    const fields = [];
    const params = [];

    if (data.log_date !== undefined) { fields.push('log_date = ?'); params.push(data.log_date); }
    if (data.start_time !== undefined) { fields.push('start_time = ?'); params.push(data.start_time); }
    if (data.end_time !== undefined) { fields.push('end_time = ?'); params.push(data.end_time); }
    if (data.duration_min !== undefined) { fields.push('duration_min = ?'); params.push(data.duration_min); }
    if (data.category !== undefined) { fields.push('category = ?'); params.push(data.category); }
    if (data.sub_category !== undefined) { fields.push('sub_category = ?'); params.push(data.sub_category); }
    if (data.title !== undefined) { fields.push('title = ?'); params.push(data.title); }
    if (data.content !== undefined) { fields.push('content = ?'); params.push(data.content); }
    if (data.related_project_id !== undefined) { fields.push('related_project_id = ?'); params.push(data.related_project_id); }
    if (data.tags !== undefined) { fields.push('tags = ?'); params.push(Array.isArray(data.tags) ? data.tags.join(',') : data.tags); }
    if (data.is_remedy !== undefined) { fields.push('is_remedy = ?'); params.push(data.is_remedy ? 1 : 0); }

    if (fields.length > 0) {
      params.push(req.params.id);
      dbRun(`UPDATE work_log SET ${fields.join(', ')} WHERE id = ?`, params);
      saveDb();
    }

    res.json(enrichLog(dbGet('SELECT * FROM work_log WHERE id = ?', [req.params.id])));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/log/:id', (req, res) => {
  dbRun('DELETE FROM document WHERE related_log_id = ?', [req.params.id]);
  dbRun('DELETE FROM work_log WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ status: 'ok' });
});

// ================== Stats APIs ==================

app.get('/api/stats', (req, res) => {
  try {
    const range = req.query.range || 'week';
    const today = dayjs();
    let sd, ed;

    if (req.query.start_date && req.query.end_date) {
      sd = dayjs(req.query.start_date); ed = dayjs(req.query.end_date);
    } else if (range === 'day') { sd = ed = today; }
    else if (range === 'week') { sd = today.startOf('week'); ed = today; }
    else if (range === 'month') { sd = today.startOf('month'); ed = today; }
    else { sd = today.subtract(30, 'day'); ed = today; }

    const sdStr = sd.format('YYYY-MM-DD');
    const edStr = ed.format('YYYY-MM-DD');

    const logs = dbQuery('SELECT * FROM work_log WHERE log_date >= ? AND log_date <= ?', [sdStr, edStr]);

    const totalMinutes = logs.reduce((s, l) => s + l.duration_min, 0);
    const projectMinutes = logs.filter(l => l.category === '项目性工作').reduce((s, l) => s + l.duration_min, 0);
    const transactionMinutes = logs.filter(l => l.category === '事务性工作').reduce((s, l) => s + l.duration_min, 0);

    const categoryDetail = {};
    const subCategoryDetail = {};
    const dailyData = {};

    logs.forEach(l => {
      dailyData[l.log_date] = (dailyData[l.log_date] || 0) + l.duration_min;
      categoryDetail[l.category] = (categoryDetail[l.category] || 0) + l.duration_min;
      const sc = `${l.category} - ${l.sub_category}`;
      subCategoryDetail[sc] = (subCategoryDetail[sc] || 0) + l.duration_min;
    });

    res.json({
      start_date: sdStr, end_date: edStr,
      total_minutes: totalMinutes,
      total_hours: Math.round(totalMinutes / 60 * 10) / 10,
      project_minutes: projectMinutes, transaction_minutes: transactionMinutes,
      project_percent: totalMinutes ? Math.round(projectMinutes / totalMinutes * 1000) / 10 : 0,
      transaction_percent: totalMinutes ? Math.round(transactionMinutes / totalMinutes * 1000) / 10 : 0,
      category_detail: Object.entries(categoryDetail).map(([k, v]) => ({ name: k, minutes: v })),
      sub_category_detail: Object.entries(subCategoryDetail).map(([k, v]) => ({ name: k, minutes: v })).sort((a, b) => b.minutes - a.minutes),
      daily_chart: Object.entries(dailyData).map(([k, v]) => ({ date: k, minutes: v })).sort((a, b) => a.date.localeCompare(b.date)),
      log_count: logs.length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/stats/weekly-report', (req, res) => {
  const today = dayjs();
  const monday = today.startOf('week');
  const logs = dbQuery(
    'SELECT * FROM work_log WHERE log_date >= ? AND log_date <= ? ORDER BY log_date, start_time',
    [monday.format('YYYY-MM-DD'), today.format('YYYY-MM-DD')]
  );

  const byDate = {};
  logs.forEach(l => {
    const ds = dayjs(l.log_date).format('YYYY-MM-DD dddd');
    if (!byDate[ds]) byDate[ds] = [];
    byDate[ds].push(l);
  });

  const weekdayMap = { Monday: '一', Tuesday: '二', Wednesday: '三', Thursday: '四', Friday: '五', Saturday: '六', Sunday: '日' };
  let lines = [`# 本周工作周报 (${monday.format('YYYY-MM-DD')} ~ ${today.format('YYYY-MM-DD')})`, ''];
  let totalMin = 0;

  Object.keys(byDate).sort().forEach(ds => {
    const dayLogs = byDate[ds];
    const dayMin = dayLogs.reduce((s, l) => s + l.duration_min, 0);
    totalMin += dayMin;
    const cnDay = ds.replace(/[A-Za-z]+/g, m => '周' + (weekdayMap[m] || m));
    lines.push(`## ${cnDay} (合计: ${Math.floor(dayMin / 60)}h${dayMin % 60}min)`);
    dayLogs.forEach(l => {
      const tagStr = l.tags ? ` [${l.tags}]` : '';
      const remedyStr = l.is_remedy ? ' [补录]' : '';
      const timeStr = (l.start_time && l.end_time) ? ` ${l.start_time}-${l.end_time}` : '';
      const proj = l.related_project_id ? dbGet('SELECT name FROM project WHERE id = ?', [l.related_project_id]) : null;
      const projStr = proj ? ` [项目: ${proj.name}]` : '';
      lines.push(`- [${l.sub_category}]${timeStr}${tagStr}${remedyStr}${projStr} ${l.title}`);
    });
    lines.push('');
  });

  lines.push('---');
  lines.push(`**本周总工时: ${Math.floor(totalMin / 60)}h${totalMin % 60}min**`);
  res.json({ report: lines.join('\n') });
});

// ================== Export API ==================

app.get('/api/export/excel', async (req, res) => {
  try {
    let sql = 'SELECT * FROM work_log WHERE 1=1';
    const params = [];
    if (req.query.start_date) { sql += ' AND log_date >= ?'; params.push(req.query.start_date); }
    if (req.query.end_date) { sql += ' AND log_date <= ?'; params.push(req.query.end_date); }
    sql += ' ORDER BY log_date, start_time';

    const logs = dbQuery(sql, params);

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('工作日志');
    const headers = ['日期', '开始时间', '结束时间', '时长(分钟)', '时长(小时)', '一级分类', '二级分类', '标题', '详细内容', '关联项目', '标签', '是否补录'];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      cell.alignment = { horizontal: 'center', vertical: 'center' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    logs.forEach(log => {
      const proj = log.related_project_id ? dbGet('SELECT name FROM project WHERE id = ?', [log.related_project_id]) : null;
      ws.addRow([
        log.log_date, log.start_time || '', log.end_time || '', log.duration_min,
        Math.round(log.duration_min / 60 * 10) / 10, log.category, log.sub_category,
        log.title, log.content || '', proj ? proj.name : '', log.tags || '',
        log.is_remedy ? '是' : '否'
      ]).eachCell(cell => {
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'center', wrapText: true };
      });
    });

    ws.columns = [
      { width: 12 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
      { width: 12 }, { width: 18 }, { width: 30 }, { width: 50 }, { width: 15 }, { width: 15 }, { width: 10 }
    ];

    const fileName = `工作日志导出_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
    const filePath = path.join(UPLOAD_DIR, 'exports', fileName);
    await workbook.xlsx.writeFile(filePath);
    res.download(filePath, fileName);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ================== Project APIs ==================

app.get('/api/projects', (req, res) => {
  const projects = dbQuery('SELECT * FROM project ORDER BY is_closed, stage_change_time DESC');
  const enriched = projects.map(p => {
    const stages = resolveProjectStages(p);
    return {
      ...p,
      stages: JSON.stringify(stages),
      members: p.members || '',
      is_closed: !!p.is_closed,
      stage_label: stages[p.stage] || p.stage,
      last_log_time: dbGet('SELECT log_date FROM work_log WHERE related_project_id = ? ORDER BY log_date DESC LIMIT 1', [p.id])?.log_date || null,
      last_log_title: dbGet('SELECT title FROM work_log WHERE related_project_id = ? ORDER BY log_date DESC LIMIT 1', [p.id])?.title || null
    };
  });
  res.json(enriched);
});

app.get('/api/project/:id', (req, res) => {
  const p = dbGet('SELECT * FROM project WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const stages = resolveProjectStages(p);
  p.is_closed = !!p.is_closed;
  p.stage_label = stages[p.stage] || p.stage;
  p.stages = JSON.stringify(stages);
  p.members = p.members || '';
  p.logs = dbQuery('SELECT * FROM work_log WHERE related_project_id = ? ORDER BY log_date DESC, start_time DESC', [p.id]).map(enrichLog);
  p.documents = dbQuery('SELECT * FROM document WHERE related_project_id = ?', [p.id]);
  res.json(p);
});

app.post('/api/project', (req, res) => {
  const data = req.body;
  const globalStages = getProjectStages();
  const firstStage = Object.keys(globalStages)[0] || 'initial_contact';
  const stagesJson = JSON.stringify(globalStages);
  const result = dbRun(
    'INSERT INTO project (name, customer, stage, note, stages, members) VALUES (?, ?, ?, ?, ?, ?)',
    [data.name || '', data.customer || '', data.stage || firstStage, data.note || '', stagesJson, data.members || '']
  );
  saveDb();
  const p = dbGet('SELECT * FROM project WHERE id = ?', [result.lastInsertRowid]);
  p.is_closed = !!p.is_closed;
  p.stage_label = globalStages[p.stage] || p.stage;
  p.stages = stagesJson;
  p.members = data.members || '';
  res.status(201).json(p);
});

app.put('/api/project/:id', (req, res) => {
  const p = dbGet('SELECT * FROM project WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Not found' });

  const data = req.body;
  const fields = [];
  const params = [];

  if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
  if (data.customer !== undefined) { fields.push('customer = ?'); params.push(data.customer); }
  if (data.stage !== undefined) {
    fields.push('stage = ?'); params.push(data.stage);
    if (data.stage !== p.stage) {
      fields.push('stage_change_time = ?');
      params.push(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    }
  }
  if (data.note !== undefined) { fields.push('note = ?'); params.push(data.note); }
  if (data.is_closed !== undefined) { fields.push('is_closed = ?'); params.push(data.is_closed ? 1 : 0); }
  if (data.stages !== undefined) { fields.push('stages = ?'); params.push(data.stages); }
  if (data.members !== undefined) { fields.push('members = ?'); params.push(data.members); }

  if (fields.length > 0) {
    params.push(req.params.id);
    dbRun(`UPDATE project SET ${fields.join(', ')} WHERE id = ?`, params);
    saveDb();
  }

  const updated = dbGet('SELECT * FROM project WHERE id = ?', [req.params.id]);
  const stages = resolveProjectStages(updated);
  updated.is_closed = !!updated.is_closed;
  updated.stage_label = stages[updated.stage] || updated.stage;
  updated.stages = JSON.stringify(stages);
  updated.members = updated.members || '';
  res.json(updated);
});

app.delete('/api/project/:id', (req, res) => {
  dbRun('UPDATE work_log SET related_project_id = NULL WHERE related_project_id = ?', [req.params.id]);
  dbRun('DELETE FROM document WHERE related_project_id = ?', [req.params.id]);
  dbRun('DELETE FROM project WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ status: 'ok' });
});

// ================== Project Stages Update API ==================

app.put('/api/project/:id/stages', (req, res) => {
  try {
    const p = dbGet('SELECT * FROM project WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Not found' });

    const stages = req.body;
    const stagesJson = JSON.stringify(stages);
    dbRun('UPDATE project SET stages = ? WHERE id = ?', [stagesJson, req.params.id]);
    saveDb();

    const updated = dbGet('SELECT * FROM project WHERE id = ?', [req.params.id]);
    updated.is_closed = !!updated.is_closed;
    updated.stage_label = stages[updated.stage] || updated.stage;
    updated.stages = stagesJson;
    updated.members = updated.members || '';
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ================== File Upload / Document APIs ==================

app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, function(err) {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: '文件上传错误: ' + err.message });
    }
    try {
      if (!req.file) return res.status(400).json({ error: 'No file' });
      const result = dbRun(
        'INSERT INTO document (related_log_id, related_project_id, related_stage, file_name, file_path, file_size) VALUES (?, ?, ?, ?, ?, ?)',
        [req.body.related_log_id || null, req.body.related_project_id || null, req.body.related_stage || null, req.file.originalname, req.file.filename, req.file.size]
      );
      saveDb();
      const doc = dbGet('SELECT * FROM document WHERE id = ?', [result.lastInsertRowid]);
      res.status(201).json(doc);
    } catch (e) {
      console.error('Upload error:', e);
      res.status(500).json({ error: e.message });
    }
  });
});

app.delete('/api/document/:id', (req, res) => {
  const doc = dbGet('SELECT * FROM document WHERE id = ?', [req.params.id]);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const fp = path.join(UPLOAD_DIR, doc.file_path);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  dbRun('DELETE FROM document WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ status: 'ok' });
});

app.get('/api/download/:filename', (req, res) => {
  res.download(path.join(UPLOAD_DIR, req.params.filename));
});

// ================== Config APIs ==================

app.get('/api/config', (req, res) => {
  if (req.query.key) {
    const cfg = dbGet('SELECT config_value FROM system_config WHERE config_key = ?', [req.query.key]);
    return res.json({ key: req.query.key, value: cfg ? cfg.config_value : null });
  }
  const configs = dbQuery('SELECT * FROM system_config');
  const result = {};
  configs.forEach(c => { result[c.config_key] = c.config_value; });
  res.json(result);
});

app.post('/api/config', (req, res) => {
  const data = req.body;
  Object.entries(data).forEach(([k, v]) => {
    const existing = dbGet('SELECT id FROM system_config WHERE config_key = ?', [k]);
    if (existing) {
      dbRun('UPDATE system_config SET config_value = ? WHERE config_key = ?', [String(v), k]);
    } else {
      dbRun('INSERT INTO system_config (config_key, config_value) VALUES (?, ?)', [k, String(v)]);
    }
  });
  saveDb();
  res.json({ status: 'ok' });
});

app.get('/api/categories', (req, res) => {
  const cfg = dbGet("SELECT config_value FROM system_config WHERE config_key = 'categories'");
  res.json(cfg ? JSON.parse(cfg.config_value) : {});
});

app.post('/api/categories', (req, res) => {
  const existing = dbGet("SELECT id FROM system_config WHERE config_key = 'categories'");
  if (existing) {
    dbRun("UPDATE system_config SET config_value = ? WHERE config_key = 'categories'", [JSON.stringify(req.body)]);
  } else {
    dbRun("INSERT INTO system_config (config_key, config_value) VALUES ('categories', ?)", [JSON.stringify(req.body)]);
  }
  saveDb();
  res.json({ status: 'ok' });
});

// ================== Project Stages APIs ==================

app.get('/api/stages', (req, res) => {
  const stages = getProjectStages();
  res.json(stages);
});

app.post('/api/stages', (req, res) => {
  const data = req.body;
  const existing = dbGet("SELECT id FROM system_config WHERE config_key = 'project_stages'");
  if (existing) {
    dbRun("UPDATE system_config SET config_value = ? WHERE config_key = 'project_stages'", [JSON.stringify(data)]);
  } else {
    dbRun("INSERT INTO system_config (config_key, config_value) VALUES ('project_stages', ?)", [JSON.stringify(data)]);
  }
  saveDb();
  res.json({ status: 'ok' });
});

// ================== Backup APIs ==================

app.post('/api/backup', (req, res) => {
  const backupDir = path.join(UPLOAD_DIR, 'backup');
  const backupName = `work_log_backup_${dayjs().format('YYYYMMDD_HHmmss')}.db`;
  const backupPath = path.join(backupDir, backupName);
  saveDb();
  if (fs.existsSync(DB_PATH)) fs.copyFileSync(DB_PATH, backupPath);
  res.json({ status: 'ok', backup_path: backupPath, backup_name: backupName });
});

app.get('/api/backup/list', (req, res) => {
  const backupDir = path.join(UPLOAD_DIR, 'backup');
  if (!fs.existsSync(backupDir)) return res.json([]);
  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.db'))
    .map(f => { const stat = fs.statSync(path.join(backupDir, f)); return { name: f, size: stat.size, time: dayjs(stat.mtime).format('YYYY-MM-DD HH:mm:ss') }; })
    .sort((a, b) => b.time.localeCompare(a.time));
  res.json(files);
});

// ================== Initialize & Start ==================

async function start() {
  const SQL = await initSqlJs();

  let dbExists = false;
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH);
      db = new SQL.Database(data);
      dbExists = true;
    } else {
      db = new SQL.Database();
    }
  } catch (e) {
    db = new SQL.Database();
  }

  initDb();
  if (!dbExists) saveDb();

  app.listen(PORT, '0.0.0.0', () => {
    const msg = `
╔══════════════════════════════════════════╗
║      个人工作日志管理系统                  ║
║      后端服务已启动                       ║
║                                          ║
║      访问地址: http://localhost:${PORT}    ║
║      数据库: work_log.db                 ║
╚══════════════════════════════════════════╝
    `;
    console.log(msg);
  });
}

start().catch(e => {
  console.error('Failed to start:', e);
  process.exit(1);
});
