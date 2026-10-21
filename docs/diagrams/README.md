# แผนภาพระบบ CPSU ETMS

| ไฟล์ | เนื้อหา |
|---|---|
| `architecture-simple.png` | สถาปัตยกรรมระบบตามรูปแบบเดิมของรายงาน (ผู้ใช้ → Frontend → Backend API → Database) พร้อมโลโก้เทคโนโลยี |
| `architecture.png` | สถาปัตยกรรมระบบ: ผู้ใช้ → การยืนยันตัวตน → Frontend (React) → Caddy → Backend (Go + Gin) → MySQL, บริการภายนอก และการติดตั้งด้วย Docker Compose |
| `use-case-simple.png` | Use Case Diagram แบบขาวดำตามรูปแบบเดิมของรายงาน (3 บทบาท + เข้าสู่ระบบ) |
| `use-case.png` | Use Case Diagram แบบละเอียด: ทุกบทบาท include/extend และงานอัตโนมัติของระบบ |
| `er-diagram.png` | ER Diagram ของฐานข้อมูล `cpsu_etms` ครบ 18 ตาราง (crow's foot) |

ต้นฉบับอยู่ใน `src/` (HTML + CSS วาดเส้นด้วย `connect.js`) โลโก้มาจาก [Simple Icons](https://simpleicons.org) (CC0)

สร้าง PNG ใหม่หลังแก้ต้นฉบับ (ต้องมี Playwright: `npm i playwright`):

```
node render.js use-case-simple   # หรือ architecture-simple / architecture / use-case / er-diagram
```
