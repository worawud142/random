import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'สุ่มคำศัพท์พื้นฐาน ป.1–ป.6',
  description: 'สุ่มคำศัพท์ภาษาไทยและภาษาอังกฤษ 20 คำ แบ่งเป็นคำง่าย คำยากปานกลาง และคำยาก',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
