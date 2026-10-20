# คู่มือขึ้นระบบ CPSU ETMS บน Oracle Cloud (ฟรี)

ทั้งระบบรันบนเครื่องเดียวด้วย Docker Compose:

| ส่วน | ทำหน้าที่ |
|---|---|
| `db` | MySQL 8 เก็บข้อมูลทั้งหมด รวมถึงโปสเตอร์ สลิป และ template เกียรติบัตร |
| `backend` | Go API |
| `web` | Caddy: เสิร์ฟหน้าเว็บ React, ส่ง `/api` ต่อให้ backend และขอใบรับรอง HTTPS ให้อัตโนมัติ |

ใช้เวลาติดตั้งครั้งแรกประมาณ 1 ชั่วโมง

---

## 1. สร้างเครื่องบน Oracle Cloud

1. สมัครที่ <https://www.oracle.com/cloud/free/> (ต้องใช้บัตรเครดิตยืนยันตัวตน ไม่ถูกตัดเงินถ้าใช้ในโควต้า Always Free)
   - **Home Region เลือก Singapore** เลือกครั้งเดียว เปลี่ยนทีหลังไม่ได้
2. ไปที่ **Compute → Instances → Create instance**
   - **Image:** Canonical Ubuntu 24.04
   - **Shape:** Ampere → `VM.Standard.A1.Flex` ตั้ง 2 OCPU / 12 GB (เช็คโควต้า Always Free ปัจจุบันในหน้า Oracle อีกครั้ง)
   - **SSH keys:** ดาวน์โหลด private key เก็บไว้ ใช้เข้าเครื่อง
   - ถ้าขึ้นว่า "Out of capacity" ให้ลองใหม่ภายหลัง หรือเปลี่ยน Availability Domain
3. จด **Public IP** ของเครื่อง

## 2. เปิด port 80 และ 443

ต้องเปิด **2 ที่** ไม่อย่างนั้นเว็บเข้าไม่ได้ และ HTTPS ขอใบรับรองไม่ได้

**2.1 ฝั่ง Oracle:** Instance → Subnet → Security List → **Add Ingress Rules**
- Source `0.0.0.0/0`, TCP, Destination port `80`
- Source `0.0.0.0/0`, TCP, Destination port `443`

**2.2 ฝั่งเครื่อง** (image ของ Oracle บล็อกทุก port ยกเว้น SSH):
```bash
ssh -i <private-key> ubuntu@<PUBLIC_IP>
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 3. ตั้งชื่อโดเมน (ฟรีด้วย DuckDNS)

1. เข้า <https://www.duckdns.org> ด้วยบัญชี Google
2. สร้างโดเมนย่อย เช่น `cpsu-etms` จะได้ `cpsu-etms.duckdns.org`
3. ใส่ Public IP ของเครื่องในช่อง **current ip** แล้วกด update
4. ตรวจจากเครื่องตัวเองว่าโดเมนชี้ถูก: `ping cpsu-etms.duckdns.org` ต้องได้ IP ของเครื่อง Oracle

ถ้ามีโดเมนจริงอยู่แล้ว ตั้ง A record ชี้ไปที่ Public IP แทนได้

## 4. ติดตั้ง Docker และดึงโค้ด

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit        # ออกแล้ว ssh เข้าใหม่ ให้สิทธิ์ docker มีผล

git clone https://github.com/Chairampha21/Event-and-Training-project.git
cd Event-and-Training-project/deploy
```
ถ้า repository เป็น private ให้ใช้ Personal Access Token ของ GitHub แทนรหัสผ่านตอน clone

## 5. ตั้งค่า `.env`

```bash
cp .env.production.example .env
openssl rand -hex 32     # รันหลายครั้ง เอาค่าที่ได้ไปใส่แต่ละช่องรหัส
nano .env
```

| ช่อง | ใส่อะไร |
|---|---|
| `DOMAIN` | โดเมนจากข้อ 3 **ไม่ต้องมี** `https://` เช่น `cpsu-etms.duckdns.org` |
| `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `JWT_SECRET` | ค่าสุ่มจาก `openssl rand -hex 32` คนละค่ากัน |
| `GOOGLE_CLIENT_ID` | ดูข้อ 6 (เว้นว่างได้ ถ้ายังไม่ใช้เข้าสู่ระบบด้วย Google) |

> ⚠️ **ห้าม** commit ไฟล์ `.env` (ถูก `.gitignore` ไว้แล้ว) และห้ามใช้ค่าเดียวกับเครื่อง dev
> ⚠️ **ห้ามย้ายฐานข้อมูล dev มาใช้** เพราะบัญชีทดสอบใช้รหัส `Passw0rd!` ระบบใหม่เริ่มจาก `database/schema.sql` ที่ไม่มีบัญชีใดเลย

## 6. Google Sign-In (ถ้าใช้)

1. <https://console.cloud.google.com> → **APIs & Services → Credentials** → OAuth client ID ที่ใช้อยู่ (ชนิด Web application)
2. **Authorized JavaScript origins:** เพิ่ม `https://<DOMAIN>`
3. ใส่ Client ID ใน `GOOGLE_CLIENT_ID` ของ `.env`

Client ID ถูกฝังในหน้าเว็บตอน build ถ้าแก้ทีหลังต้อง build ใหม่ด้วย `docker compose up -d --build web`

## 7. เปิดระบบ

```bash
docker compose up -d --build
docker compose ps                 # ทั้ง 3 ตัวต้องเป็น Up (db ต้อง healthy)
docker compose logs -f backend    # ต้องเห็น "listening on :4000" แล้วกด Ctrl+C ออก
```
- build ครั้งแรกใช้เวลาประมาณ 5–10 นาที
- เปิด `https://<DOMAIN>` ในเบราว์เซอร์ Caddy ขอใบรับรอง HTTPS ให้เองภายในไม่กี่วินาที
- ฐานข้อมูลถูกสร้างจาก `database/schema.sql` **เฉพาะครั้งแรก**ที่ volume ยังว่าง

## 8. สร้างบัญชีแอดมินคนแรก

```bash
./create-admin.sh
```
ใส่ชื่อ อีเมล @silpakorn.edu และรหัสผ่าน แล้วเข้าสู่ระบบที่หน้าเว็บด้วยอีเมลกับรหัสผ่านนี้ แอดมินคนอื่นและผู้จัดกิจกรรม เพิ่มได้จากหน้า "ผู้ใช้งาน" ของแอดมิน

## 9. สำรองข้อมูลอัตโนมัติ (ต้องทำ)

ข้อมูลทุกอย่าง รวมถึงรูปที่อัปโหลด อยู่ในฐานข้อมูล ถ้าเครื่องหายแล้วไม่มี backup ข้อมูลหายหมด

```bash
./backup.sh                       # ลองรันครั้งแรก ไฟล์อยู่ใน deploy/backups/
crontab -e                        # เพิ่มบรรทัดนี้ เพื่อสำรองทุกวันตี 3
0 3 * * * /home/ubuntu/Event-and-Training-project/deploy/backup.sh >> /home/ubuntu/Event-and-Training-project/deploy/backups/backup.log 2>&1
```
ไฟล์ในเครื่องเก็บไว้ 14 วัน

**แนะนำ: ส่งสำเนาไปเก็บนอกเครื่อง เช่น Google Drive**
```bash
sudo apt install -y rclone
rclone config      # สร้าง remote ชื่อ gdrive แบบ Google Drive (ทำตามที่โปรแกรมถาม)
```
แล้วตั้ง `BACKUP_REMOTE=gdrive:cpsu-etms-backups` ใน `.env`

## 10. อัปเดตระบบเมื่อมีโค้ดใหม่

```bash
cd ~/Event-and-Training-project
./deploy/backup.sh                # สำรองก่อนทุกครั้ง
git pull
cd deploy && docker compose up -d --build
```

> ⚠️ **ถ้าโค้ดใหม่แก้ฐานข้อมูล** (ดูหัวข้อ Migration ใน Pull Request หรือข้อความ commit) ต้องรันคำสั่ง SQL นั้นเอง **ก่อน** `up -d --build` เพราะ `schema.sql` ทำงานแค่ครั้งแรก:
> ```bash
> docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot cpsu_etms' < migration.sql
> ```

## 11. กู้คืนจาก backup

```bash
cd ~/Event-and-Training-project/deploy
gunzip -c backups/cpsu_etms-YYYYMMDD-HHMM.sql.gz \
  | docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot cpsu_etms'
docker compose restart backend
```

---

## แก้ปัญหาที่เจอบ่อย

| อาการ | สาเหตุและวิธีแก้ |
|---|---|
| เปิดเว็บไม่ได้เลย | port 80/443 ยังไม่เปิดครบทั้ง 2 ที่ในข้อ 2 หรือโดเมนยังไม่ชี้มาที่ IP นี้ |
| เว็บขึ้นว่าไม่ปลอดภัย / ไม่มี HTTPS | ดู `docker compose logs web` ส่วนใหญ่เกิดจากข้อ 2 หรือ 3 Caddy ต้องเข้าถึงจากอินเทอร์เน็ตได้จึงขอใบรับรองได้ |
| หน้าเว็บขึ้น แต่ข้อมูลไม่มา (error 502) | backend ยังไม่พร้อมหรือต่อฐานข้อมูลไม่ได้ ดู `docker compose logs backend` |
| backend ล้มพร้อม `JWT_SECRET is required` | ยังไม่ได้ใส่ `JWT_SECRET` ใน `.env` |
| เข้าสู่ระบบด้วย Google ไม่ได้ | ข้อ 6: origin ต้องตรงกับ `https://<DOMAIN>` และต้อง build `web` ใหม่หลังแก้ Client ID |
| เพิ่มคอลัมน์ใน `schema.sql` แล้วไม่มีผล | ปกติ ต้องรัน migration เอง (ข้อ 10) |

ดูสถานะทั้งหมด: `docker compose ps` · ดู log: `docker compose logs -f <db|backend|web>` · รีสตาร์ต: `docker compose restart <ชื่อ>`
