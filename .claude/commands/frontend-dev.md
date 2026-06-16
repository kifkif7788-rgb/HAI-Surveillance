# Frontend Dev Skill

คุณกำลังทำงานด้าน frontend ของโปรเจ็ค little-hai-helper ซึ่งเป็น React + TypeScript + Tailwind CSS + shadcn/ui

## Stack
- **Framework**: React 18 + TypeScript (strict)
- **Styling**: Tailwind CSS v4 + CSS custom properties (ดู src/styles.css)
- **Components**: shadcn/ui อยู่ใน src/components/ui/
- **Routing**: TanStack Router (file-based ใน src/routes/)
- **State**: Zustand store ใน src/lib/hai-store.ts
- **Build**: Vite + Bun

## Design System (src/styles.css)
สีที่ใช้งานในโปรเจ็คนี้เป็น semantic tokens:
- `bg-pink` / `text-pink-foreground` — accent สีชมพู
- `bg-sky` / `text-sky-foreground` — accent สีฟ้า
- `bg-mint` / `text-mint-foreground` — accent สีเขียว
- `bg-lemon` / `text-lemon-foreground` — accent สีเหลือง
- `bg-lavender` / `text-lavender-foreground` — accent สีม่วง
- `card-soft` — class สำหรับ card มาตรฐานของโปรเจ็ค
- ห้าม hardcode สีโดยตรง ให้ใช้ token เสมอ

## Conventions
- Component ใช้ named export (`export function MyComponent`)
- Props interface ชื่อ `Props` เสมอ ไม่ต้องนำหน้าด้วย I
- Responsive ต้องรองรับ mobile-first: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- ใช้ `cn()` จาก `@/lib/utils` สำหรับ conditional className เสมอ
- ไม่สร้าง component ใหม่ถ้าสามารถ extend ของเดิมได้
- ไม่เพิ่ม comment ที่อธิบายว่าโค้ดทำอะไร ถ้า code อ่านแล้วชัดเจนอยู่แล้ว

## เมื่อเพิ่ม Component ใหม่
1. วางใน `src/components/` (ถ้าเป็น reusable) หรือ `src/components/views/` (ถ้าเป็น page-level)
2. ใช้ shadcn/ui เป็น base ก่อนเขียนใหม่
3. ตรวจสอบ spacing ให้สอดคล้องกับ component รอบข้าง
4. ทดสอบ responsive ทั้ง mobile และ desktop

## เมื่อแก้ไข Style
1. ใช้ token จาก design system ก่อนเสมอ
2. ถ้าต้องเพิ่ม token ใหม่ ให้เพิ่มใน `src/styles.css`
3. ไม่ใช้ arbitrary values ใน Tailwind ([value]) ถ้าหลีกเลี่ยงได้

## เมื่อลบ Component หรือ Feature
1. ตรวจ import ทั้งหมดก่อนลบ (`grep -r "ComponentName" src/`)
2. ลบ type/interface ที่ใช้เฉพาะ component นั้นออกด้วย
3. ตรวจสอบว่า route ที่เกี่ยวข้องยังทำงานได้
