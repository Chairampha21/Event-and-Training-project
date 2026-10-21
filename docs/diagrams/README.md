# แผนภาพระบบ CPSU ETMS

| ไฟล์ | เนื้อหา |
|---|---|
| `architecture.png` | สถาปัตยกรรมระบบ: ผู้ใช้ → การยืนยันตัวตน → Frontend (React) → Caddy → Backend (Go + Gin) → MySQL, บริการภายนอก และการติดตั้งด้วย Docker Compose |
| `use-case.png` | Use Case Diagram ของทุกบทบาท และงานอัตโนมัติของระบบ |
| `er-diagram.png` | ER Diagram ของฐานข้อมูล `cpsu_etms` ครบ 18 ตาราง (crow's foot) |

ต้นฉบับอยู่ใน `src/` (HTML + CSS วาดเส้นด้วย `connect.js`) โลโก้มาจาก [Simple Icons](https://simpleicons.org) (CC0)

สร้าง PNG ใหม่หลังแก้ต้นฉบับ: เปิดไฟล์ใน `src/` ผ่าน web server ใดก็ได้ (เช่น `python3 -m http.server` ในโฟลเดอร์ `src`)
แล้วเรียก `drawWires()` และจับภาพ `#canvas` ที่ความละเอียด 2 เท่า
