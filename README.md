# 📷 照片智能点评 Pro - 部署指南

## 功能特点

- **AI专业点评**：接入豆包大模型，获得专业摄影点评
- **多维度分析**：构图、光影、色彩、技术、情感等全方位点评
- **学习价值**：每条点评都包含摄影知识和改进建议

## 部署步骤（约5分钟）

### 第一步：获取豆包API Key

1. 访问 [火山引擎控制台](https://console.volcengine.com/)
2. 注册/登录账号
3. 开通「火山方舟」服务（新用户有免费额度）
4. 左侧菜单找到「API Key管理」
5. 点击「创建API Key」
6. 复制保存

### 第二步：部署到Vercel

1. 访问 [Vercel官网](https://vercel.com/)
2. 用GitHub账号登录（没有就注册一个）
3. 点击「Add New Project」
4. 选择「Import Git Repository」
5. 先把项目上传到GitHub：

```bash
# 在项目目录下执行
cd photo-filter-pro

# 初始化git仓库
git init
git add .
git commit -m "初始版本"

# 在GitHub创建新仓库，然后执行
git remote add origin https://github.com/你的用户名/photo-filter-pro.git
git push -u origin main
```

6. 在Vercel中导入这个仓库
7. **重要**：在「Environment Variables」中添加：

| Name | Value |
|------|-------|
| `DOUBAO_API_KEY` | 你的API Key |

8. 点击「Deploy」

### 第三步：访问使用

部署完成后，Vercel会给你一个网址（类似 `https://photo-filter-pro.vercel.app`）

打开这个网址就能使用了！

## 免费额度说明

- **Vercel**：每月100GB流量，够用
- **豆包API**：新用户送200万tokens，大约能分析500-1000张照片

## 常见问题

### Q: 部署失败怎么办？
A: 检查Environment Variables是否正确配置了API Key

### Q: 分析失败？
A: 1. 检查API Key是否正确
   2. 检查豆包服务是否开通
   3. 查看Vercel的Function Logs

### Q: 想修改点评风格？
A: 编辑 `api/analyze.js` 中的prompt变量

## 项目结构

```
photo-filter-pro/
├── api/
│   └── analyze.js      # 云函数，调用豆包API
├── public/
│   ├── index.html      # 前端页面
│   ├── css/style.css   # 样式
│   └── js/app-pro.js   # 前端逻辑
├── vercel.json         # Vercel配置
├── package.json        # 项目配置
└── README.md           # 本文件
```
