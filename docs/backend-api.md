# 后端接口约定（Spring Boot 4 + PostgreSQL）

本文档是前端已经写死并验证过的接口契约。按此实现，前端把 `.env.development` 里的
`VITE_USE_MOCK` 改成 `false` 即可直接跑通，不需要改任何业务代码。

> 前端代码里所有字段名都可以在 `src/types/index.ts` 找到对应类型，接口调用见 `src/api/*.ts`。

---

## 1. 总体约定

| 项目 | 约定 |
| --- | --- |
| 基础路径 | `/api`（建议 `server.servlet.context-path: /api`，前端不做路径重写） |
| 端口 | 本地 `9081`（与 `.env.development` 的 `API_PROXY_TARGET` 一致） |
| 数据格式 | `application/json; charset=UTF-8` |
| 金额 | JSON 数字，单位「元」，两位小数；Java 用 `BigDecimal(12,2)` |
| 日期 | `yyyy-MM-dd`，Java 用 `LocalDate`（不传时间，避免时区偏移） |
| 月份 | `yyyy-MM`，Java 用 `YearMonth` 或 `String` |
| 枚举 | `EXPENSE`（支出）/ `INCOME`（收入），Java 用同名 enum |
| 分页 | `page` 从 **1** 开始；`size` 默认 10，最大 100 |
| 鉴权 | 除 `/api/auth/login` 外，请求头必须带 `Authorization: Bearer <token>`，缺失或失效返回 401 |
| 错误响应 | RFC 7807 `ProblemDetail`，前端读取 `detail` 字段展示 |
| 时区 | 统一 `Asia/Shanghai`；金额统计按 `LocalDate` 所属自然月 |

> 端口约定：本机 9080 被 NahimicService（MSI 音频服务）占用，因此
> **开发环境统一用 `9081`**（与 `.env.development` 的 `API_PROXY_TARGET` 一致）。
> 生产环境尚未部署，端口待定；届时让 Nginx upstream、后端 `server.port`
> 与 `.env.production` 的 `API_PROXY_TARGET` 三者保持一致即可。
> 在此之前，`vite preview` 也会回落到开发端口 `9081`。

### 1.1 成功响应

直接返回业务数据，**不包** `{ code, data, message }` 外壳。列表类接口结构见下文。

### 1.2 错误响应

统一使用 Spring 自带的 `ProblemDetail`（`org.springframework.http.ProblemDetail`）：

```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "该分类下还有 12 条流水，无法删除",
  "instance": "/api/categories/3"
}
```

前端只依赖 `detail`（缺失时回退到 `title`），所以 **detail 请写用户能看懂的中文**。

| 状态码 | 场景 |
| --- | --- |
| 400 | 参数校验失败（金额 ≤ 0、日期格式错误、分类与类型不匹配等） |
| 401 | 未登录 / 令牌无效或过期 |
| 404 | 资源不存在（流水 / 分类 / 预算月份不存在） |
| 409 | 业务冲突（分类重名、删除仍被引用的分类） |
| 500 | 未预期异常（`detail` 建议给通用文案，详细堆栈打日志） |

### 1.3 鉴权

采用 **Bearer Token**（建议 JWT），前后端职责如下：

```text
POST /api/auth/login   →  { token, user }
后续所有请求           →  Authorization: Bearer <token>
令牌失效 / 未携带       →  401 + ProblemDetail
```

- 前端把 `token` 存在 `localStorage`，每个请求由 axios 拦截器自动附加；
- 任何接口返回 **401**，前端会清空本地会话并跳回 `/login?redirect=原地址`；
- **登录接口本身返回 401 不会被当成会话失效**，而是作为「账号或密码错误」展示；
- **修改密码时「原密码不正确」必须返回 400**，用 401 会把用户直接踢下线；
- 前端不解析 token 内容（不信任其负载），只透传。

单用户自用场景推荐做法：账号密码写在 `application.yml`（密码存 BCrypt），登录成功签发 JWT，
不做用户表和注册流程；以后要扩成多用户再引入 `user` 表即可，接口不用改。

### 1.4 分页结构

前端期望的列表结构（**不是** Spring Data `Page` 的原始 JSON）：

```json
{
  "items": [],
  "page": 1,
  "size": 10,
  "total": 34,
  "totalPages": 4
}
```

`Page` → `PageResult` 的转换建议：

```java
public record PageResult<T>(List<T> items, int page, int size, long total, int totalPages) {
    public static <T> PageResult<T> of(Page<T> page) {
        return new PageResult<>(
            page.getContent(),
            page.getNumber() + 1,                  // Spring 从 0 开始，前端从 1 开始
            page.getSize(),
            page.getTotalElements(),
            Math.max(page.getTotalPages(), 1)      // 空数据也给 1，前端分页器不会除零
        );
    }
}
```

---

## 2. 数据模型

### 2.1 表结构（PostgreSQL）

```sql
-- 分类
CREATE TABLE category (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(12) NOT NULL,
    type        VARCHAR(10) NOT NULL CHECK (type IN ('EXPENSE', 'INCOME')),
    color       CHAR(7)     NOT NULL DEFAULT '#8A94A6',   -- #RRGGBB
    icon        VARCHAR(8)  NOT NULL DEFAULT '✨',        -- emoji
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_category_name_type UNIQUE (name, type)
);

-- 流水（表名不要用 transaction，是 SQL 关键字）
CREATE TABLE tx_record (
    id          BIGSERIAL PRIMARY KEY,
    type        VARCHAR(10)   NOT NULL CHECK (type IN ('EXPENSE', 'INCOME')),
    amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    category_id BIGINT        NOT NULL REFERENCES category (id),
    tx_date     DATE          NOT NULL,                   -- 对应接口字段 date
    note        VARCHAR(50)   NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_tx_date          ON tx_record (tx_date DESC);
CREATE INDEX idx_tx_category      ON tx_record (category_id);
CREATE INDEX idx_tx_type_date     ON tx_record (type, tx_date);

-- 月度预算（一个月一条）
CREATE TABLE budget (
    id           BIGSERIAL PRIMARY KEY,
    month        CHAR(7)     NOT NULL UNIQUE,             -- yyyy-MM
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 分类预算（同一个月内一个分类一条）
CREATE TABLE budget_item (
    id          BIGSERIAL PRIMARY KEY,
    budget_id   BIGINT NOT NULL REFERENCES budget (id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES category (id),
    amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    CONSTRAINT uk_budget_item UNIQUE (budget_id, category_id)
);
```

### 2.2 接口对象

**Category**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 主键 |
| `name` | string | 分类名，≤12 字 |
| `type` | `EXPENSE` \| `INCOME` | 收支类型 |
| `color` | string | `#RRGGBB`，用于图表 |
| `icon` | string | emoji，如 `🍜` |

**Transaction**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 主键 |
| `type` | `EXPENSE` \| `INCOME` | 收支类型 |
| `amount` | number | 正数，方向由 `type` 决定 |
| `categoryId` | number | 分类 id |
| `categoryName` | string | 分类名（列表展示用，建议 join 得到） |
| `categoryColor` | string | 分类颜色 |
| `categoryIcon` | string | 分类图标 |
| `date` | string | `yyyy-MM-dd` |
| `note` | string | 备注，≤50 字，可为空串 |
| `createdAt` | string | ISO 8601，如 `2026-10-26T12:30:00+08:00` |

> `categoryName / categoryColor / categoryIcon` 是**读模型字段**。推荐在查询时 join `category` 表返回，
> 这样分类改名、换色后历史流水自动跟随，不需要在流水表里冗余存储。

**Budget**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `month` | string | `yyyy-MM` |
| `totalAmount` | number | 总额度，未设置时为 0 |
| `totalSpent` | number | 当月**全部支出**合计（含未单独设预算的分类） |
| `items` | array | 已设预算的分类：`{ categoryId, amount, spent }` |

---

## 3. 接口总览

| 方法 | 路径 | 用途 | 前端调用处 |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | 账号密码登录 | 登录页 |
| GET | `/api/auth/me` | 校验令牌并返回用户 | 刷新页面（预留） |
| POST | `/api/auth/password` | 修改密码 | 顶栏用户菜单 |
| POST | `/api/auth/logout` | 退出登录 | 顶栏用户菜单 |
| GET | `/api/categories` | 全部分类 | 应用启动、分类页 |
| POST | `/api/categories` | 新建分类 | 分类页 |
| PUT | `/api/categories/{id}` | 编辑分类 | 分类页 |
| DELETE | `/api/categories/{id}` | 删除分类 | 分类页 |
| GET | `/api/transactions` | 流水分页查询 | 明细页 |
| POST | `/api/transactions` | 新增流水 | 记一笔 |
| PUT | `/api/transactions/{id}` | 编辑流水 | 明细页 |
| DELETE | `/api/transactions/{id}` | 删除流水 | 明细页 |
| GET | `/api/transactions/summary` | 筛选条件汇总 | 明细页顶部 |
| GET | `/api/transactions/export` | 导出 Excel | 明细页「导出」 |
| GET | `/api/stats/monthly` | 月度收支序列 | 总览、统计页 |
| GET | `/api/stats/categories` | 分类占比 | 总览、统计、预算页 |
| GET | `/api/budgets/{month}` | 某月预算 | 预算页、总览 |
| PUT | `/api/budgets/{month}` | 保存某月预算 | 预算页 |

---

## 4. 接口详情

### 4.0 鉴权接口

#### 4.0.1 POST /api/auth/login

无需令牌。请求：

```json
{ "username": "admin", "password": "admin123" }
```

成功响应 `200`：

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresAt": "2026-11-02T19:30:00+08:00",
  "user": { "username": "admin", "displayName": "管理员" }
}
```

- `username` 或 `password` 为空 → `400`；
- 账号或密码错误 → **`401`**，`detail` 写「账号或密码不正确」；
- 建议令牌有效期 7 天，与前端「登录状态保留」的提示一致；
- 可选：连续失败 5 次锁定 10 分钟，防止公网暴露时被暴力破解。

#### 4.0.2 GET /api/auth/me

请求头带 `Authorization: Bearer <token>`，返回：

```json
{ "username": "admin", "displayName": "管理员" }
```

令牌无效 / 过期 → `401`。前端目前只在需要刷新用户资料时调用（预留）。

#### 4.0.3 POST /api/auth/password

修改当前账号的密码，需要带令牌。请求：

```json
{ "oldPassword": "admin123", "newPassword": "newpass123" }
```

成功：`204 No Content`。

| 情况 | 响应 |
| --- | --- |
| 原密码错误 | **`400`**，`detail: "原密码不正确"`（不要用 401） |
| 新密码长度不在 6-32 | `400` |
| 新密码与原密码相同 | `400` |
| 未携带或令牌失效 | `401`（由安全过滤器统一返回） |

实现建议：

- 用 `passwordEncoder.matches(old, storedHash)` 校验原密码，成功后写入 `passwordEncoder.encode(new)`；
- 密码只在配置文件里时，改为**可持久化的账号表**（单行 `app_user`）或写回配置（不推荐）；
- 可选：改密后让旧令牌失效（记录 `token_version` 或按签发时间判断），前端不需要感知——下次请求 401 会自动回登录页。

#### 4.0.4 POST /api/auth/logout

`204 No Content`。JWT 是无状态的，服务端可选择：

- 什么都不做（前端清掉令牌即退出，最简单，单用户足够）；
- 或维护一个「已注销令牌」黑名单直到过期（多端强制下线时需要）。

### 4.1 GET /api/categories

返回全部分类（支出 + 收入），前端自行按 `type` 过滤。

```json
[
  { "id": 1, "name": "餐饮", "type": "EXPENSE", "color": "#E0703C", "icon": "🍜" },
  { "id": 10, "name": "工资", "type": "INCOME", "color": "#0F7A63", "icon": "💼" }
]
```

### 4.2 POST /api/categories

请求：

```json
{ "name": "宠物", "type": "EXPENSE", "color": "#8A94A6", "icon": "🐱" }
```

响应：`201 Created` + 创建后的 `Category`。

校验：

- `name` 去空格后非空、≤12 字；
- 同类型下不允许重名 → `409`；
- `color` 必须匹配 `^#[0-9a-fA-F]{6}$` → 否则 `400`；
- `type` 只能是 `EXPENSE` / `INCOME`。

### 4.3 PUT /api/categories/{id}

请求体同 4.2。响应：更新后的 `Category`。

额外规则：

- 分类已被流水引用时，**不允许修改 `type`** → `409`（否则历史统计会错乱）；
- 改名不需要同步流水表（读模型 join 即可）。

### 4.4 DELETE /api/categories/{id}

- 成功：`204 No Content`；
- 分类不存在：`404`；
- 分类下仍有流水：`409`，`detail` 形如 `该分类下还有 12 条流水，无法删除`；
- 若该分类出现在某些月份的 `budget_item` 中，建议一并删除这些预算项（或返回 409 由前端处理），前端已按「一并删除」的语义实现 mock。

### 4.5 GET /api/transactions

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `page` | int | 否 | 默认 1 |
| `size` | int | 否 | 默认 10，最大 100 |
| `startDate` | date | 否 | `yyyy-MM-dd`，含当天 |
| `endDate` | date | 否 | `yyyy-MM-dd`，含当天 |
| `type` | enum | 否 | `EXPENSE` / `INCOME`，缺省为全部 |
| `categoryId` | long | 否 | 按分类过滤 |
| `keyword` | string | 否 | 模糊匹配备注或分类名，忽略大小写 |

排序：`tx_date DESC, id DESC`（同一天里新录入的在前）。

响应：

```json
{
  "items": [
    {
      "id": 812,
      "type": "EXPENSE",
      "amount": 128.5,
      "categoryId": 1,
      "categoryName": "餐饮",
      "categoryColor": "#E0703C",
      "categoryIcon": "🍜",
      "date": "2026-10-26",
      "note": "和同事吃午饭",
      "createdAt": "2026-10-26T12:30:00+08:00"
    }
  ],
  "page": 1,
  "size": 10,
  "total": 34,
  "totalPages": 4
}
```

### 4.6 POST /api/transactions

请求：

```json
{
  "type": "EXPENSE",
  "amount": 128.5,
  "categoryId": 1,
  "date": "2026-10-26",
  "note": "和同事吃午饭"
}
```

响应：`201 Created` + 完整 `Transaction`（含分类快照字段）。

校验：

| 规则 | 错误码 |
| --- | --- |
| `amount > 0` 且 ≤ 99,999,999.99，最多两位小数 | 400 |
| `categoryId` 必须存在 | 400 |
| 分类的 `type` 必须与流水 `type` 一致 | 400 |
| `date` 必须是合法日期（建议不允许晚于今天） | 400 |
| `note` ≤ 50 字 | 400 |

### 4.7 PUT /api/transactions/{id}

请求体同 4.6，整体覆盖。`404` 表示流水不存在。

### 4.8 DELETE /api/transactions/{id}

成功 `204`，不存在 `404`。

### 4.9 GET /api/transactions/summary

与列表接口**相同的筛选参数**（不含 `page/size`），返回汇总：

```json
{ "income": 19795.60, "expense": 6510.20, "balance": 13285.40, "count": 34 }
```

- `balance = income - expense`；
- 金额合计务必用 `BigDecimal` 或「分」为单位的整数计算，避免浮点误差。

### 4.10 GET /api/transactions/export

与列表接口相同的筛选参数（不含 `page/size`），返回 **xlsx 二进制流**：

```http
HTTP/1.1 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename*=UTF-8''%E6%94%B6%E6%94%AF%E6%98%8E%E7%BB%86-2026-10-26.xlsx
```

实现要点（Apache POI）：

- 用 `SXSSFWorkbook` 流式写，避免大数据量内存占用；
- 表头：`日期 | 类型 | 分类 | 金额 | 备注`，加粗、浅灰底、冻结首行；
- 类型输出中文「收入 / 支出」；
- 金额单元格用数值格式 `#,##0.00`；
- 文件名带导出日期，中文用 `filename*=UTF-8''` 编码，前端会解析并保存。

> 注意：前端在 mock 模式下导出的是 `.csv`（浏览器端生成），接真实后端后即为 `.xlsx`，前端无需改动。

### 4.11 GET /api/stats/monthly

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `months` | int | 否 | 1~24，默认 6 |
| `endMonth` | string | 否 | `yyyy-MM`，默认当前月 |

响应：按月份**升序**、**零填充**，长度恰好等于 `months`：

```json
[
  { "month": "2026-05", "income": 18620.00, "expense": 5900.12 },
  { "month": "2026-06", "income": 18500.00, "expense": 6120.00 }
]
```

实现提示：一条 SQL 按月 `GROUP BY`，Java 端按月补齐没有数据的月份（收入/支出填 0）。

### 4.12 GET /api/stats/categories

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `startDate` | date | 是 | 区间开始（含） |
| `endDate` | date | 是 | 区间结束（含） |
| `type` | enum | 是 | 目前前端固定传 `EXPENSE` |

响应：按金额降序，`percent` 为该分类占同类型总额的百分比（保留一位小数）：

```json
[
  { "categoryId": 4, "name": "居住", "icon": "🏠", "color": "#6B7A8F", "amount": 3200.00, "percent": 48.3 },
  { "categoryId": 3, "name": "购物", "icon": "🛍️", "color": "#B25FB0", "amount": 1555.20, "percent": 23.5 }
]
```

总额为 0 时返回 `[]`，不要把 `percent` 算成 `NaN`。

### 4.13 GET /api/budgets/{month}

`month` 形如 `2026-10`。响应：

```json
{
  "month": "2026-10",
  "totalAmount": 8000.00,
  "totalSpent": 6510.20,
  "items": [
    { "categoryId": 1, "amount": 2000.00, "spent": 574.90 },
    { "categoryId": 5, "amount": 600.00, "spent": 342.20 }
  ]
}
```

规则：

- 该月没设置预算时：`totalAmount = 0`、`items = []`，但 `totalSpent` 仍要按当月实际支出计算；
- `spent` = 该分类当月支出合计；`totalSpent` = 当月**所有**支出合计（不限于已设预算的分类）；
- `items` 只包含**已设置预算**的支出分类（amount > 0 的那些）。

### 4.14 PUT /api/budgets/{month}

请求（整体覆盖，幂等）：

```json
{
  "totalAmount": 8000,
  "items": [
    { "categoryId": 1, "amount": 2000 },
    { "categoryId": 5, "amount": 600 }
  ]
}
```

响应：与 4.13 相同（含重新计算的 `spent` / `totalSpent`），前端保存后直接用它刷新。

校验：

- `month` 格式必须为 `yyyy-MM` → 400；
- `totalAmount ≥ 0`，`items[].amount ≥ 0` → 400；
- `categoryId` 必须存在且为**支出**分类 → 400；
- 同一 `categoryId` 不能重复 → 400。

实现建议：`@Transactional` 内先删旧 `budget_item` 再插入，`budget` 行 upsert（`ON CONFLICT (month) DO UPDATE`）。

---

## 5. 业务规则汇总

1. **分类与流水类型必须一致**：支出流水只能挂支出分类，反之亦然（前后端都要校验）。
2. **删除分类**：有流水引用时拒绝（409）；有预算引用时级联删除预算项。
3. **分类改名/换色**：不要复制到流水表；查询时 join 即可，历史数据自动更新。
4. **统计口径**：一切统计都基于 `tx_date` 的自然月；不使用 `created_at`。
5. **金额精度**：聚合用整数分或 `BigDecimal`，禁止 `double` 累加。
6. **空数据**：列表返回空数组；统计返回空数组或零填充序列，前端都有空状态兜底。
7. **鉴权边界**：除 `/auth/login` 外所有接口都要求有效令牌；缺失/过期统一 `401`。

---

## 6. Spring Boot 落地建议

### 6.1 依赖

```xml
<dependency>spring-boot-starter-web</dependency>
<dependency>spring-boot-starter-data-jpa</dependency>
<dependency>spring-boot-starter-validation</dependency>
<dependency>spring-boot-starter-security</dependency>
<dependency>org.postgresql:postgresql</dependency>
<dependency>org.apache.poi:poi-ooxml</dependency>
<!-- JWT：jjwt 或 spring-security-oauth2-jose 任选 -->
<dependency>io.jsonwebtoken:jjwt-api</dependency>
<dependency>io.jsonwebtoken:jjwt-impl</dependency>
<dependency>io.jsonwebtoken:jjwt-jackson</dependency>
<!-- 可选：数据库版本管理 -->
<dependency>org.flywaydb:flyway-core</dependency>
```

### 6.2 application.yml

```yaml
server:
  # 开发环境固定 9081；生产部署时用 SERVER_PORT 覆盖
  port: ${SERVER_PORT:9081}
  servlet:
    context-path: /api

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/personal_finance
    username: finance
    password: finance
  jpa:
    hibernate:
      ddl-auto: validate      # 表结构用 Flyway/init.sql 管理
    open-in-view: false
    properties:
      hibernate:
        jdbc:
          time_zone: Asia/Shanghai
  jackson:
    default-property-inclusion: non_null
    time-zone: Asia/Shanghai

# 单用户自用：账号与密码哈希直接配置
app:
  auth:
    username: admin
    # BCrypt 哈希，明文 admin123 加密后得到；生产环境换成自己的
    password-hash: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
    # HS256 密钥，至少 32 字节，务必自行替换
    jwt-secret: "change-me-please-use-a-long-random-secret-key"
    token-ttl: 7d
```

> 端口：目前只跑开发环境，固定 `9081`（前端 Vite 代理目标）。
> 之后上生产时用 `SERVER_PORT` 环境变量覆盖即可，部署相关配置到时候再定。

### 6.3 鉴权实现（Spring Security + JWT）

```java
@Configuration
@EnableWebSecurity
class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, JwtAuthFilter jwtAuthFilter) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/auth/login").permitAll()
                .anyRequest().authenticated())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .exceptionHandling(e -> e.authenticationEntryPoint((req, res, ex) -> {
                res.setStatus(401);
                res.setContentType("application/problem+json;charset=UTF-8");
                res.getWriter().write("""
                    {"title":"Unauthorized","status":401,"detail":"登录状态已失效，请重新登录"}
                    """);
            }))
            .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

登录接口校验配置里的账号与密码哈希，签发 JWT：

```java
@PostMapping("/auth/login")
LoginResponse login(@Valid @RequestBody LoginRequest request) {
    boolean ok = request.username().equals(props.username())
        && passwordEncoder.matches(request.password(), props.passwordHash());
    if (!ok) {
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "账号或密码不正确");
    }
    String token = jwtService.issue(request.username(), props.tokenTtl());
    return new LoginResponse(token, jwtService.expiresAt(token), new AuthUser("admin", "管理员"));
}
```

> 令牌放 `Authorization: Bearer <token>`，不要放 URL 参数（会进日志）。

修改密码（注意：原密码错误返回 **400**，不能抛 401）：

```java
@PostMapping("/auth/password")
@ResponseStatus(HttpStatus.NO_CONTENT)
void changePassword(@Valid @RequestBody ChangePasswordRequest request) {
    if (!passwordEncoder.matches(request.oldPassword(), props.passwordHash())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "原密码不正确");
    }
    if (request.newPassword().equals(request.oldPassword())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "新密码不能与原密码相同");
    }
    userRepository.updatePassword(passwordEncoder.encode(request.newPassword()));
}
```

### 6.4 关键实现片段

**统计查询（分类占比）**

```java
@Query("""
    select new com.example.finance.dto.CategoryAmount(
        t.categoryId, sum(t.amount))
    from TxRecord t
    where t.type = :type and t.date between :start and :end
    group by t.categoryId
    order by sum(t.amount) desc
    """)
List<CategoryAmount> sumByCategory(TxType type, LocalDate start, LocalDate end);
```

百分比在 Java 端计算：`amount.divide(total, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).setScale(1, RoundingMode.HALF_UP)`。

**预算的 spent**

```java
// 当月某分类支出
BigDecimal spent = txRepo.sumAmountByCategoryBetween(categoryId, monthStart, monthEnd);
// 当月总支出（预算 totalSpent）
BigDecimal totalSpent = txRepo.sumAmountByTypeBetween(TYPE_EXPENSE, monthStart, monthEnd);
```

**统一异常**

```java
@RestControllerAdvice
class ApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    ProblemDetail onBadRequest(IllegalArgumentException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(EntityNotFoundException.class)
    ProblemDetail onNotFound(EntityNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }
}
```

> Spring Boot 4 默认已把 `ProblemDetail` 序列化为 `application/problem+json`，前端兼容。

**CORS**

开发阶段前端走 Vite 代理，无需 CORS。若以后前后端分域部署，需要放行前端域名：

```java
@Bean
CorsConfigurationSource corsConfigurationSource() {
    var config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("http://localhost:5173"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    var source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}
```

### 6.5 初始化数据

建议用 Flyway `V1__init.sql` 建表 + `V2__seed.sql` 灌入默认分类：

```sql
INSERT INTO category (name, type, color, icon) VALUES
  ('餐饮', 'EXPENSE', '#E0703C', '🍜'),
  ('交通', 'EXPENSE', '#3C7DBF', '🚇'),
  ('购物', 'EXPENSE', '#B25FB0', '🛍️'),
  ('居住', 'EXPENSE', '#6B7A8F', '🏠'),
  ('娱乐', 'EXPENSE', '#D9A13B', '🎮'),
  ('医疗', 'EXPENSE', '#4C9E9E', '💊'),
  ('学习', 'EXPENSE', '#5B6BD6', '📚'),
  ('人情', 'EXPENSE', '#D45F7C', '🎁'),
  ('其他', 'EXPENSE', '#8A94A6', '✨'),
  ('工资', 'INCOME',  '#0F7A63', '💼'),
  ('奖金', 'INCOME',  '#2E9E7E', '🏆'),
  ('理财', 'INCOME',  '#3C7DBF', '📈'),
  ('兼职', 'INCOME',  '#7C6BD6', '🧾'),
  ('其他收入', 'INCOME', '#8A94A6', '💰');
```

---

## 7. 联调与自测

启动后端（`http://localhost:9081/api`）后，可以直接用 curl 验证：

```bash
# 0. 先登录拿 token（后续请求都要带）
TOKEN=$(curl -s -X POST http://localhost:9081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)

# 分类
curl -H "Authorization: Bearer $TOKEN" http://localhost:9081/api/categories

# 新增一笔
curl -X POST http://localhost:9081/api/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"EXPENSE","amount":128.5,"categoryId":1,"date":"2026-10-26","note":"午饭"}'

# 列表 + 筛选
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9081/api/transactions?page=1&size=10&startDate=2026-10-01&endDate=2026-10-31&type=EXPENSE&keyword=午饭"

# 汇总
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9081/api/transactions/summary?startDate=2026-05-01&endDate=2026-10-31"

# 统计
curl -H "Authorization: Bearer $TOKEN" "http://localhost:9081/api/stats/monthly?months=6&endMonth=2026-10"
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9081/api/stats/categories?startDate=2026-10-01&endDate=2026-10-31&type=EXPENSE"

# 预算
curl -H "Authorization: Bearer $TOKEN" http://localhost:9081/api/budgets/2026-10
curl -X PUT http://localhost:9081/api/budgets/2026-10 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"totalAmount":8000,"items":[{"categoryId":1,"amount":2000}]}'

# 导出
curl -OJ -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9081/api/transactions/export?startDate=2026-10-01&endDate=2026-10-31"

# 修改密码（原密码错误应为 400，不会踢下线）
curl -i -X POST http://localhost:9081/api/auth/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"oldPassword":"admin123","newPassword":"newpass123"}'

# 验证鉴权：不带 token 应当返回 401
curl -i http://localhost:9081/api/categories
```

前端侧：把 `.env.development` 的 `VITE_USE_MOCK` 改为 `false`，重启 `npm run dev`，
依次过一遍：登录 → 总览 → 记一笔 → 明细（筛选/分页/编辑/删除/导出）→ 统计 → 预算 → 分类 → 修改密码 → 退出登录。

---

## 8. 前端功能 → 接口对照表

| 前端行为 | 调用 |
| --- | --- |
| 登录 / 退出 | `POST /auth/login`、`POST /auth/logout` |
| 修改密码 | `POST /auth/password` |
| 应用启动加载分类下拉 | `GET /categories` |
| 总览（切月） | `GET /transactions/summary`、`GET /stats/monthly`、`GET /stats/categories`、`GET /budgets/{month}`、`GET /transactions`（size=5） |
| 记一笔 / 编辑 | `POST /transactions`、`PUT /transactions/{id}` |
| 明细筛选 | `GET /transactions` + `GET /transactions/summary` |
| 删除记录 | `DELETE /transactions/{id}` |
| 导出 | `GET /transactions/export`（响应必须是二进制） |
| 统计页 | `GET /stats/monthly`、`GET /stats/categories` |
| 预算页 | `GET /budgets/{month}`、`PUT /budgets/{month}`、`GET /stats/categories` |
| 分类页 | `GET/POST/PUT/DELETE /categories` |

---

## 9. mock 与真实后端的差异

| 项目 | mock（开发期） | 真实后端 |
| --- | --- | --- |
| 数据存储 | 浏览器 `localStorage` | PostgreSQL |
| 导出格式 | CSV（浏览器生成） | XLSX（Apache POI） |
| 鉴权 | 固定演示账号 admin / admin123，令牌为本地生成的假 JWT | 真实账号 + 签发 JWT，令牌可校验、可吊销 |
| 跨月行为 | 换月后自动重新生成示例数据 | 无此逻辑 |

模拟数据仅用于演示，接入真实后端后可以把整个 `src/mock/` 目录删掉（`main.ts` 里的动态 `import` 会随之失效，记得同步删掉那几行）。
