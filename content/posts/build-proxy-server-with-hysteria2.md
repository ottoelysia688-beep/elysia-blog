+++
title = "从零搭建自己的代理服务器（Hysteria2 + Cloudflare CDN）"
date = 2026-07-21
draft = false
tags = ["VPS", "代理", "Hysteria2", "Cloudflare"]
categories = ["折腾记录"]
summary = "记录我用 RackNerd VPS + Hysteria2 + Cloudflare 搭建私人代理的全过程，包括踩坑记录和速度优化。"
+++

## 前言

之前一直用着免费的代理工具，速度不稳定，看 YouTube 1080p 总是卡。这次决定自己买 VPS 搭一个，记录一下全过程和遇到的坑。

最终效果：**20kbps → 6000kbps**，提速 300 倍。

## 配置信息

| 项目 | 配置 |
|------|------|
| VPS | RackNerd 洛杉矶 |
| 系统 | Ubuntu 22.04 LTS |
| 配置 | 1GB RAM / 19GB SSD |
| 月流量 | 4TB |
| 域名 | ottoelysia.top（Cloudflare 托管） |
| 协议 | Hysteria2（UDP/QUIC） |

## 为什么选 Hysteria2？

之前用 VLESS + Reality（TCP 协议），速度只有 20kbps。排查后发现：

- VPS 本身下载速度 **80MB/s（640Mbps）**，完全没问题
- 没开 **BBR** 拥塞控制，用的是老旧的 cubic 算法
- **TCP 协议被 GFW QoS 限速**，443 端口重点关照

Hysteria2 基于 **UDP/QUIC 协议**，不走 TCP 限速通道，而且有 **BRUTAL 拥塞控制**，更凶猛地抢带宽。

## 搭建过程

### 1. 开启 BBR 加速

这一步最关键！BBR 是 Google 开发的拥塞控制算法，比默认的 cubic 快很多：

```bash
echo 'net.core.default_qdisc=fq' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_congestion_control=bbr' >> /etc/sysctl.conf
sysctl -p
```

验证：
```bash
sysctl net.ipv4.tcp_congestion_control
# 输出: net.ipv4.tcp_congestion_control = bbr
```

### 2. 安装 Hysteria2

```bash
bash <(curl -fsSL https://get.hy2.sh/)
```

一行命令搞定，会自动安装到 `/usr/local/bin/hysteria`。

### 3. 配置文件

编辑 `/etc/hysteria/config.yaml`：

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

quic:
  initStreamReceiveWindow: 33554432
  maxStreamReceiveWindow: 33554432
  initConnReceiveWindow: 67108864
  maxConnReceiveWindow: 67108864
  maxIdleTimeout: 30s
  maxIncomingStreams: 8192
  disablePathMTUDiscovery: false

bandwidth:
  up: 500 mbps
  down: 500 mbps
```

### 4. 证书问题（第一个坑）

Hysteria2 以 `hysteria` 用户运行，读不到 `/root/cert/` 下的证书：

```
FATAL: failed to load server config: tls.cert: permission denied
```

**解决方案**：复制证书到 Hysteria2 可读的目录：

```bash
mkdir -p /etc/hysteria/cert
cp /root/cert/your-domain/fullchain.pem /etc/hysteria/cert/
cp /root/cert/your-domain/privkey.pem /etc/hysteria/cert/
chown -R hysteria:hysteria /etc/hysteria/cert/
```

### 5. 端口跳跃（关键优化）

GFW 会针对特定 UDP 端口限速。用 iptables 做端口跳跃，让流量在 20000-50000 之间随机切换：

```bash
iptables -t nat -A PREROUTING -i eth0 -p udp --dport 20000:50000 -j REDIRECT --to-ports 36712
netfilter-persistent save
```

### 6. 客户端连接

v2rayN 导入链接格式：

```
hysteria2://密码@域名:36712?obfs=salamander&obfs-password=混淆密码&insecure=0&sni=域名#节点名
```

## 速度优化历程

| 阶段 | 改动 | 速度 |
|------|------|------|
| 初始（VLESS+Reality，无BBR） | 无 | 20 kbps |
| Hysteria2 基础版 | UDP 443 + 100Mbps | 300-400 kbps |
| + salamander 混淆 | 换端口 36712 | 400 kbps |
| + 端口跳跃 + 500Mbps | 20000-50000 跳跃 | 4000-6000 kbps ✅ |
| + 16MB 网络缓冲区 | rmem/wmem 调优 | 稳定 5000+ kbps |

## 安全加固

搭好代理后，安全也要跟上：

### 关闭不必要的端口
```bash
ufw default deny incoming
ufw allow 58322/tcp    # SSH（换了高位端口）
ufw allow 36712/udp    # Hysteria2
ufw allow 20000:50000/udp  # 端口跳跃
```

### SSH 换端口 + fail2ban
```bash
# 改 SSH 端口
sed -i 's/^#Port 22/Port 58322/' /etc/ssh/sshd_config

# fail2ban 配置
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = 58322
maxretry = 3
bantime = 3600
EOF
```

### CDN 备用节点

提前用 Cloudflare 配好一个 VLESS+WebSocket+TLS 备用节点，走 CDN 中转。万一 IP 被墙，切到 CDN 节点照样能用。

## 自动化运维

### 证书自动续期
```bash
~/.acme.sh/acme.sh --install-cert -d your-domain --ecc \
  --fullchain-file /root/cert/your-domain/fullchain.pem \
  --key-file /root/cert/your-domain/privkey.pem \
  --reloadcmd "cp /root/cert/your-domain/*.pem /etc/hysteria/cert/ && chown hysteria:hysteria /etc/hysteria/cert/* && systemctl restart hysteria-server"
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

## 踩坑总结

| 坑 | 原因 | 解决 |
|----|------|------|
| 证书权限拒绝 | Hysteria2 用户读不到 root 目录 | 复制到 /etc/hysteria/cert/ |
| 速度上不去 | UDP 443 被 QoS + 缓冲区太小 | 换端口 + salamander + 端口跳跃 |
| v2rayN 不支持 mport | sing-box 内核不支持端口跳跃参数 | 去掉 mport，用单端口 |
| SSH 改端口后断连 | 先改端口再放行防火墙 | 先 UFW 放行新端口再改 |

## 总结

自建代理最大的优势是**完全掌控**——速度、安全、功能都自己说了算。整个过程踩了不少坑，但最终效果非常好：

- **速度**：6000kbps，看 1080p YouTube 无压力
- **安全**：防火墙 + fail2ban + 面板隐藏
- **稳定**：自动重启 + 自动续证书 + CDN 备用
- **多端**：电脑 v2rayN + 手机 v2rayNG + 平板

如果这篇文章帮到了你，欢迎留言交流～
