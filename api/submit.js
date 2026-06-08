/**
 * Vercel Serverless — 接收前端表单提交，写入飞书多维表格
 *
 * 环境变量（在 Vercel 控制台设置）：
 *   FEISHU_APP_ID      飞书应用 ID
 *   FEISHU_APP_SECRET  飞书应用 Secret
 *   FEISHU_BASE_TOKEN  Base token
 *   FEISHU_TABLE_ID    数据表 ID
 */

// 字段 ID 映射（飞书多维表格字段 ID）
const FIELD_MAP = {
  phone:    'fldm6z8ySi',  // 手机号 (text)
  industry: 'fldgtXEffJ',  // 行业 (select)
  score:    'fldAqFhiiV',  // 测评分数 (number)
  pains:    'fldLLZK12a',  // 痛点 (text)
  size:     'fldkaocC1D',  // 团队规模 (select)
  time:     'fldXYMt3tF',  // 提交时间 (datetime)
};

// 行业标签 → 飞书选项名映射
const INDUSTRY_MAP = {
  ecommerce:     '电商零售',
  food:          '餐饮',
  education:     '教育培训',
  service:       '专业服务',
  manufacturing: '制造业',
  other:         '其他',
};

// 规模标签映射
const SIZE_MAP = {
  micro:  '1-5人',
  small:  '6-20人',
  medium: '21-50人',
  large:  '50人以上',
};

// 痛点标签映射
const PAIN_MAP = {
  customer_service:  '客服消息回不完',
  order_processing:  '订单/预约处理太慢',
  data_reports:      '报表/数据整理耗时',
  marketing_content: '营销内容没空写',
  inventory:         '库存管理混乱',
  accounting:        '财务对账头疼',
  recruiting:        '招聘筛选简历太累',
  follow_up:         '客户跟进不及时',
};

async function getTenantToken() {
  const resp = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET,
    }),
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`Token error: ${data.msg}`);
  return data.tenant_access_token;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { phone, score, industry, pains, size } = req.body || {};

    if (!phone || !score || !industry || !size) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    const token = await getTenantToken();
    const now = new Date();
    const timeStr = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const painLabels = (pains || []).map(p => PAIN_MAP[p] || p).join('、');

    const body = {
      fields: {
        [FIELD_MAP.phone]:    phone,
        [FIELD_MAP.industry]: INDUSTRY_MAP[industry] || industry,
        [FIELD_MAP.score]:    Number(score),
        [FIELD_MAP.pains]:    painLabels,
        [FIELD_MAP.size]:     SIZE_MAP[size] || size,
        [FIELD_MAP.time]:     Date.now(),
      },
    };

    const resp = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${process.env.FEISHU_BASE_TOKEN}/tables/${process.env.FEISHU_TABLE_ID}/records`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    const data = await resp.json();
    if (data.code !== 0) {
      console.error('Bitable write error:', JSON.stringify(data));
      return res.status(500).json({ error: data.msg || '写入失败' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Submit error:', err);
    return res.status(500).json({ error: err.message });
  }
}
