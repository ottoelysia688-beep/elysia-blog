+++
title = "从零开始：用 VPS 搭建自己的代理服务器（完整记录）"
date = 2026-07-21
draft = false
tags = ["VPS", "代理", "Hysteria2", "3x-ui", "RackNerd"]
categories = ["折腾记录"]
summary = "从什么是 VPS、怎么选购、怎么登录，到搭建代理节点、速度优化、安全加固的完整记录。从小白视角出发，含踩坑经验。"
+++

## 写在前面

这篇文章记录了我从零搭建个人代理服务器的全过程。不是那种"我已经搭好了来教你"的事后总结，而是真实经历了"买了 VPS → 装了面板 → 速度只有 20kbps → 各种优化 → 最终 6000kbps"的完整折腾路径。

如果你也想过自己搭一个，但不知道从哪开始，这篇文章应该能帮到你。

---

## 一、概念篇：什么是 VPS？什么是代理？

### VPS 是什么

**VPS（虚拟专用服务器）** 简单理解就是一台"在国外的、永远开机的、有公网 IP 的电脑"。

商家把一台物理服务器切成多份虚拟机，你买其中一份。它和家用电脑的区别：

| 区别 | 家用电脑 | VPS |
|------|----------|-----|
| 位置 | 家里 | 机房（空调、不断电） |
| IP | 内网 IP（192.168.x.x） | **公网 IP**（全世界能访问） |
| 带宽 | 家用宽带 | 机房大带宽（1Gbps+） |
| 运行时间 | 你关机就没了 | 24 小时运行 |
| 操作方式 | 显示器+键盘 | 远程登录（SSH） |

### 代理是什么

你平时上网：`你的电脑 → 直接访问 → 网站`

用代理后：`你的电脑 → 加密隧道 → VPS → 访问 → 网站 → VPS → 加密返回 → 你的电脑`

VPS 就像一个在国外的"中间人"，帮你访问被墙的网站，再把结果加密传回来。

### 为什么自建（而不是买机场）

| 维度 | 买机场 | 自建 VPS |
|------|--------|----------|
| 价格 | 10-30 元/月 | 约 15-30 元/月（年付均摊） |
| 速度 | 共享带宽，高峰拥堵 | **独享带宽，稳定** |
| 隐私 | 商家能看到你的流量 | **只有你自己知道** |
| 可控性 | 节点被封只能等 | 自己换协议/换端口 |
| 稳定性 | 商家跑路风险 | **自己掌控** |
| 上手难度 | 简单 | 有学习成本 |

**结论**：如果你愿意花一个下午学习，自建完胜。如果完全不想折腾，买机场也行。两者可以并存。

---

## 二、选购篇：买哪台 VPS？

### 选什么商家

我买的是 **RackNerd**，理由很简单：**便宜**。年付 $10-20（折合人民币 70-140 元/年），也就是每月不到 10 块钱。

主流商家对比：

| 商家 | 起步价（年付） | 特点 |
|------|----------------|------|
| **RackNerd** ⭐ | $10-20/年 | 性价比之王，常年促销 |
| 搬瓦工（BandwagonHost） | $49.99/年起 | CN2 GIA 线路好但贵 |
| Vultr | $2.5-3.5/月 | 按小时计费，灵活 |
| CloudCone | $15-20/年 | 洛杉矶，性价比不错 |

> 💡 RackNerd 黑五（11月）和新年（1月）促销最划算，$10/年 的 1核512M 套餐经常有。

### 选什么配置

| 配置 | 最低要求 | 推荐 | 说明 |
|------|----------|------|------|
| CPU | 1 核 | 1 核 | 代理很轻量，1 核够 |
| 内存 | 512MB | **1GB** | 面板+协议约用 200MB |
| 硬盘 | 10GB | 15-20GB | 系统占 7G |
| 流量 | 1TB/月 | **2-4TB/月** | 越多越好 |
| 端口速度 | 100Mbps | 1Gbps | 影响峰值速度 |

我买的是 1核/1GB/19GB/4TB 流量，完全够用。

### 选什么位置

| 位置 | 延迟 | 速度 | 推荐 |
|------|------|------|------|
| **美西（洛杉矶）** ⭐ | 150-180ms | 快 | **首选** |
| 美东（纽约/新泽西） | 180-220ms | 中 | 次选 |
| 日本/韩国 | 60-120ms | 不一定快 | 带宽小、容易封 |
| 欧洲 | 200-250ms | 慢 | 不推荐 |

> ⚠️ **延迟低 ≠ 速度快**。很多日本 VPS 带宽小、晚高峰拥堵，实际体验不如美西大带宽。后面会讲到，**协议选择比位置更重要**。

### 购买流程

1. 去 [RackNerd 官网](https://www.racknerd.com/) 或促销页选套餐
2. 选 Los Angeles 机房
3. 系统选 **Ubuntu 22.04 LTS**
4. 用 PayPal / 信用卡付款
5. 几分钟后收到邮件，里面有：
   - **IP 地址**（如 `192.255.160.32`）
   - **root 密码**
   - **SSH 端口**（默认 22）
6. **保存好这些信息！** 后面全靠它

---

## 三、域名篇：为什么要买域名？

### 域名的作用

不是所有协议都需要域名，但有一个会更灵活：

- **申请 SSL 证书**（HTTPS 加密需要）
- **CDN 中转**（IP 被墙时走 Cloudflare CDN）
- **面板访问**（用域名代替 IP，更好记）

### 怎么买

| 商家 | 价格 | 特点 |
|------|------|------|
| **Namesilo** | $7-9/年 | 支持支付宝 |
| Cloudflare Registrar | ~$9/年 | 成本价无加价 |
| Porkbun | $9-10/年 | 界面友好 |

我买的是 `ottoelysia.top`，`.top` 后缀便宜（$1-3/年首年）。

### 接入 Cloudflare

1. 注册 [Cloudflare](https://cloudflare.com) 账号（免费）
2. 添加你的域名
3. 在域名注册商处把 NS 改成 Cloudflare 给的两个地址
4. 等 DNS 生效（几分钟到几小时）
5. 在 Cloudflare DNS 面板添加 A 记录：`子域名` → `VPS IP`

> 💡 Cloudflare 橙色云朵 = 走 CDN（隐藏 IP 但限速），灰色云朵 = 纯 DNS 解析（直连不限速）。

---

## 四、登录篇：怎么连接 VPS？

### SSH 是什么

SSH（Secure Shell）就是远程登录服务器的协议。连上后就像在 VPS 上开了一个命令行窗口，敲命令操作。

### SSH 工具推荐

| 工具 | 特点 | 适合 |
|------|------|------|
| **FinalShell** ⭐ | 中文界面、可视化文件管理 | **小白首选** |
| Termius | 界面好看、多设备同步 | 多设备用户 |
| 系统自带 ssh 命令 | Win10+ / Mac / Linux | 临时用 |

### FinalShell 连接步骤

1. 下载安装 FinalShell
2. 新建连接 → SSH
3. 填写：

| 字段 | 填什么 |
|------|--------|
| 主机 | VPS 的 IP 地址 |
| 端口 | 22（默认） |
| 用户名 | root |
| 密码 | 邮件里的 root 密码 |

4. 连接 → 出现 `root@xxx:~#` 就成功了

### 首次登录建议做的事

```bash
# 查看系统版本
cat /etc/os-release

# 查看资源
free -h    # 内存
df -h      # 硬盘

# 更新系统
apt update && apt upgrade -y

# 改时区
timedatectl set-timezone Asia/Shanghai
```

---

## 五、搭建篇：安装 3x-ui 面板

### 什么是 3x-ui

3x-ui 是基于 Xray 内核的**可视化代理管理面板**。就像路由器的管理后台——点点鼠标就能配代理节点，不用记命令。

### 一键安装

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)
```

安装过程中会让你设置：

| 设置项 | 建议 |
|--------|------|
| 用户名 | 不要用 admin |
| 密码 | 强密码 |
| 面板端口 | 改高位端口（如 20130） |
| 面板路径 | 随机字符串（如 `/aTotyBXg7fMneJwTbB/`） |

> ⚠️ **第一件事就改默认端口和路径**，否则很快被扫描器爆破。

### 访问面板

浏览器打开 `http://你的IP:你的端口/你的路径/`

进去后就能看到管理界面，可以添加节点、查看流量、管理证书等。

---

## 六、节点篇：从 20kbps 到 6000kbps

### 第一次尝试：VLESS + Reality

在 3x-ui 面板里添加入站：

- 协议：VLESS
- 传输：TCP
- 安全：Reality
- 伪装目标：www.apple.com:443

配置好后导出链接，v2rayN 导入，连上——**能用，但速度只有 20kbps**。

看 YouTube 480p 都卡，更别说 1080p。

### 问题诊断

SSH 登录 VPS 测试：

```bash
# 测试 VPS 本身下载速度
curl -o /dev/null -w 'Speed: %{speed_download} bytes/s' https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
```

结果：**80MB/s（640Mbps）**——VPS 本身飞快！

问题出在：
1. **没开 BBR**（用的是老旧的 cubic 拥塞控制算法）
2. **TCP 协议被 GFW QoS 限速**（443 端口重点关照）

### 第二次尝试：Hysteria2

Hysteria2 基于 **UDP/QUIC 协议**，不走 TCP 限速通道，有 **BRUTAL 拥塞控制**，更凶猛地抢带宽。

```bash
# 安装 Hysteria2
bash <(curl -fsSL https://get.hy2.sh/)
```

配置文件 `/etc/hysteria/config.yaml`：

```yaml
listen: :36712

tls:
  cert: /etc/hysteria/cert/fullchain.pem
  key: /etc/hysteria/cert/privkey.pem

obfs:
  type: salamander
  salamander:
    password: 你的混淆密码

auth:
  type: password
  password: 你的密码

masquerade:
  type: proxy
  proxy:
    url: https://www.bing.com/
    rewriteHost: true

bandwidth:
  up: 500 mbps
  down: 500 mbps
```

> 💡 **salamander 混淆**：让 UDP 流量看起来像随机噪声，GFW 无法识别为 Hysteria2

连上后：**300-400kbps**。好了一些但还不够。

### 第三次优化：端口跳跃 + 大缓冲区

GFW 会针对特定 UDP 端口限速。用 iptables 做端口跳跃：

```bash
# 把 20000-50000 的 UDP 流量都转到 Hysteria2 端口
iptables -t nat -A PREROUTING -i eth0 -p udp --dport 20000:50000 -j REDIRECT --to-ports 36712
netfilter-persistent save
```

同时增大网络缓冲区：

```bash
echo "net.core.rmem_max=16777216" >> /etc/sysctl.conf
echo "net.core.wmem_max=16777216" >> /etc/sysctl.conf
sysctl -p
```

结果：**4000-6000kbps** ✅

### 速度优化历程

| 阶段 | 改动 | 速度 |
|------|------|------|
| VLESS Reality（无 BBR） | — | 20 kbps |
| Hysteria2 基础版 | UDP + BBR | 300-400 kbps |
| + salamander 混淆 | 换端口 36712 | 400 kbps |
| **+ 端口跳跃 + 500Mbps** | 20000-50000 跳跃 | **4000-6000 kbps** ✅ |
| + 16MB 网络缓冲区 | rmem/wmem 调优 | 稳定 5000+ kbps |

> 🎯 **核心教训：协议选择比线路选择更重要。** 同一台 VPS，换个协议速度差 300 倍。

---

## 七、安全篇：别让 VPS 裸奔

### 防火墙（UFW）

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 58322/tcp       # SSH（换了高位端口）
ufw allow 36712/udp       # Hysteria2
ufw allow 20000:50000/udp # 端口跳跃
ufw allow 20130/tcp       # 面板
ufw enable
```

### SSH 加固

```bash
# 改 SSH 端口（22 → 58322）
sed -i 's/^#Port 22/Port 58322/' /etc/ssh/sshd_config
systemctl restart sshd

# 装 fail2ban（3次试错自动封IP）
apt install fail2ban -y
```

### 面板安全

- 改默认端口和路径（安装时就要改）
- 强密码
- fail2ban 保护面板端口

---

## 八、客户端篇：各设备怎么用？

### 客户端推荐

| 设备 | 推荐 App | 价格 |
|------|----------|------|
| Windows | **v2rayN** | 免费 |
| 安卓 | **v2rayNG** | 免费 |
| iPhone/iPad | **Shadowrocket** | $2.99 |
| | Streisand | 免费 |

### 使用方法

1. 在 3x-ui 面板复制节点链接
2. 打开客户端 → 导入链接（或扫码）
3. 选中节点 → 启动
4. 路由模式选「绕过大陆」（国内直连，国外走代理）

### Hysteria2 链接格式

```
hysteria2://密码@域名:36712?obfs=salamander&obfs-password=混淆密码&insecure=0&sni=域名#节点名
```

> ⚠️ v2rayN 的 sing-box 内核不支持端口跳跃参数（mport），用单端口连接即可。需要端口跳跃用 Hysteria2 官方客户端。

---

## 九、踩坑记录

| 坑 | 原因 | 解决 |
|----|------|------|
| 速度只有 20kbps | TCP 被 QoS + 没开 BBR | 换 Hysteria2 + 开 BBR |
| Hysteria2 证书权限拒绝 | hysteria 用户读不到 root 目录 | 复制证书到 /etc/hysteria/cert/ |
| UDP 443 被限速 | GFW 针对 443 UDP QoS | 换高位端口 + 端口跳跃 |
| SSH 改端口后断连 | 先改端口再放行防火墙 | 先 UFW 放行新端口再改 |
| v2rayN 不支持 mport | sing-box 内核限制 | 去掉 mport，单端口连接 |
| 面板被爆破 | 默认端口+弱密码 | 改高位端口+随机路径+fail2ban |

---

## 十、自动化运维

### 证书自动续期

```bash
~/.acme.sh/acme.sh --install-cert -d 你的域名 --ecc \
  --fullchain-file /root/cert/域名/fullchain.pem \
  --key-file /root/cert/域名/privkey.pem \
  --reloadcmd "systemctl restart hysteria-server"
```

### Hysteria2 崩溃自动重启

```bash
mkdir -p /etc/systemd/system/hysteria-server.service.d
cat > /etc/systemd/system/hysteria-server.service.d/override.conf << 'EOF'
[Service]
Restart=always
RestartSec=5
EOF
systemctl daemon-reload
```

### 流量监控

```bash
apt install vnstat -y
systemctl enable vnstat
vnstat -m    # 查看月流量
```

---

## CDN 备用节点

提前用 Cloudflare 配好一个 VLESS+WebSocket+TLS 备用节点，走 CDN 中转。万一 IP 被墙，切到 CDN 节点照样能用。

> ⚠️ Hysteria2 是 UDP 协议，**不能走 Cloudflare CDN**（CF 只转发 TCP）。所以 CDN 备用节点必须用 TCP 协议（VLESS+WS+TLS）。

---

## 总结

自建代理最大的优势是**完全掌控**——速度、安全、功能都自己说了算。整个过程踩了不少坑，但最终效果：

- **速度**：6000kbps，1080p YouTube 无压力
- **安全**：防火墙 + fail2ban + 面板隐藏
- **稳定**：自动重启 + 自动续证书 + CDN 备用
- **多端**：电脑 + 手机 + 平板

如果你也在犹豫要不要自建，我的建议是：**买个最便宜的 RackNerd（$10/年），花一个下午折腾，值得。**

---

*如果有问题欢迎交流，我也还在学习中。*
