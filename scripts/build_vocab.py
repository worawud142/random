import json
import re
from pathlib import Path

from pypdf import PdfReader


PROJECT = Path(__file__).resolve().parents[1]
SOURCE = PROJECT.parent
OUTPUT = PROJECT / "app" / "vocabulary.json"

# The PDFs use a legacy Thai font whose ToUnicode map represents sara-am as
# mai-ek + sara-aa. These are the affected vocabulary entries, transcribed
# from the rendered source pages. Genuine mai-ek words are intentionally not
# included here.
THAI_GLYPH_FIXES = {
    "ก่าเนิด": "กำเนิด", "ก่าลัง": "กำลัง", "คว่า": "คว่ำ",
    "ค่านับ": "คำนับ", "ท่าเล": "ทำเล", "ล่าไย": "ลำไย",
    "อ่าเภอ": "อำเภอ", "ขย้่า": "ขย้ำ", "ประจ่า": "ประจำ",
    "กระดานด่า": "กระดานดำ", "กะหล่าปลี": "กะหล่ำปลี",
    "ครูประจ่าชั้น": "ครูประจำชั้น", "ดินน้่ามัน": "ดินน้ำมัน",
    "ต้มย่า": "ต้มยำ", "ท่าไร่": "ทำไร่", "ท่าลาย": "ทำลาย",
    "น้่าเกลือ": "น้ำเกลือ", "น้่าแข็ง": "น้ำแข็ง",
    "น้่าเงิน": "น้ำเงิน", "น้่าปลา": "น้ำปลา", "น้่าผึ้ง": "น้ำผึ้ง",
    "น้่าส้มสายชู": "น้ำส้มสายชู", "น้่าหวาน": "น้ำหวาน",
    "ผักต่าลึง": "ผักตำลึง", "แม่น้่า": "แม่น้ำ", "ส้มต่า": "ส้มตำ",
    "หมอล่า": "หมอลำ", "อาบน้่า": "อาบน้ำ", "ต่ารวจ": "ตำรวจ",
    "ส่าคัญ": "สำคัญ", "ก่าไล": "กำไล", "ด่าเนิน": "ดำเนิน",
    "ระย่า": "ระยำ", "ส่าลี": "สำลี", "อ่าลา": "อำลา",
    "ก๊อกน้่า": "ก๊อกน้ำ", "ก่ามือ": "กำมือ", "ก่าไร": "กำไร",
    "ก่าลังกาย": "กำลังกาย", "ค่าตอบ": "คำตอบ", "จ่าเป็น": "จำเป็น",
    "ต้นคว่าตายหงายเป็น": "ต้นคว่ำตายหงายเป็น", "น้่าประปา": "น้ำประปา",
    "น้่าอัดลม": "น้ำอัดลม", "ฟ้อนร่า": "ฟ้อนรำ", "ล่าพัง": "ลำพัง",
    "ส่านักงาน": "สำนักงาน", "ซ่าหริ่ม": "ซาหริ่ม", "ความส่าคัญ": "ความสำคัญ",
    "ค่าปฏิญาณ": "คำปฏิญาณ", "น้่ามนต์": "น้ำมนต์", "สถานีต่ารวจ": "สถานีตำรวจ",
    "สม่าเสมอ": "สม่ำเสมอ", "ก่าหนด": "กำหนด", "ค่านวณ": "คำนวณ",
    "เงินบ่านาญ": "เงินบำนาญ", "จ่านรรจา": "จำนรรจา", "ดึกด่าบรรพ์": "ดึกดำบรรพ์",
    "เต้นก่าร่าเคียว": "เต้นกำรำเคียว", "น้่ากรด": "น้ำกรด",
    "น้่าขี้เถ้า": "น้ำขี้เถ้า", "น้่าพักน้่าแรง": "น้ำพักน้ำแรง",
    "บ่านาญ": "บำนาญ", "พระต่าหนัก": "พระตำหนัก", "พระราชด่ารัส": "พระราชดำรัส",
    "พลบค่า": "พลบค่ำ", "แม่นย่า": "แม่นยำ", "ย่าเกรง": "ยำเกรง",
    "ร่ามะนา": "รำมะนา", "ล่าธาร": "ลำธาร", "ล่าพูน": "ลำพูน",
    "ล่าสัน": "ลำสัน", "สรุ่ยสุร่าย": "สุรุ่ยสุร่าย", "ส่าเนียง": "สำเนียง",
    "ส่ารวจ": "สำรวจ", "เสนาอ่านาตย์": "เสนาอำมาตย์", "ก่านัล": "กำนัล",
    "คร่าคร่า": "คร่ำคร่า", "ค่าประพันธ์": "คำประพันธ์", "จ่านรรจ์": "จำนรรจ์",
    "ใจไม้ไส้ระก่า": "ใจไม้ไส้ระกำ", "ช่าระ": "ชำระ", "ต้นก่าเนิด": "ต้นกำเนิด",
    "ต่านาน": "ตำนาน", "น้่าเนตร": "น้ำเนตร", "บ่าเพ็ญ": "บำเพ็ญ",
    "พระด่าริ": "พระดำริ", "พรายน้่า": "พรายน้ำ", "พ่านัก": "พำนัก",
    "เพาะช่า": "เพาะชำ", "ละล่าละลัก": "ละล่ำละลัก", "ล่าน้่าเหมือง": "ลำน้ำเหมือง",
    "ล้่าเลิศ": "ล้ำเลิศ", "ส่าเร็จ": "สำเร็จ", "เหยือกน้่า": "เหยือกน้ำ",
    "กงเกวียนก่าเกวียน": "กงเกวียนกำเกวียน", "ก่ายาน": "กำยาน", "ค่าสาป": "คำสาป",
    "ช่านาญ": "ชำนาญ", "ธารน้่าใจ": "ธารน้ำใจ", "น้่าอมฤต": "น้ำอมฤต",
    "พระธ่ามรงค์": "พระธำมรงค์", "พระราชด่าริ": "พระราชดำริ", "ล่าเค็ญ": "ลำเค็ญ",
    "อ่ามาตย์": "อำมาตย์",
}

ENGLISH_MEANING_FIXES = {
    "น ้าชา": "น้ำชา", "น ้าแข็ง": "น้ำแข็ง", "น ้าตาล": "น้ำตาล",
    "น ้าหมึก": "น้ำหมึก", "แม่น ้า": "แม่น้ำ", "น ้าผลไม้": "น้ำผลไม้",
    "น ้ามะนาว": "น้ำมะนาว", "ท้าความสะอาด": "ทำความสะอาด",
    "วันนี": "วันนี้", "นิ วมือ": "นิ้วมือ", "เสื อแขนยาว": "เสื้อแขนยาว",
    "สัตว์เลี ยง": "สัตว์เลี้ยง", "ยิ ม": "ยิ้ม", "คดเคี ยว": "คดเคี้ยว",
    "เสื อสุภาพสตรี": "เสื้อสุภาพสตรี", "อาหารค่้า": "อาหารค่ำ",
    "ออกก้าลังกาย": "ออกกำลังกาย", "ส้านักงาน": "สำนักงาน",
    "พูดซ ้า": "พูดซ้ำ", "กิจวัตรประจ้าวัน": "กิจวัตรประจำวัน",
    "เสื อกันหนาว": "เสื้อกันหนาว", "พรุ่งนี": "พรุ่งนี้",
    "อัลบั ม": "อัลบั้ม", "เพื่อนร่วมชั น": "เพื่อนร่วมชั้น", "เต้นร้า": "เต้นรำ",
    "พื น": "พื้น", "มีความจ้าเป็น": "มีความจำเป็น", "ริบบิ น": "ริบบิ้น",
    "เสื อยืด": "เสื้อยืด", "ชั นบน": "ชั้นบน", "ทิศทาง / ค้าแนะน้า": "ทิศทาง / คำแนะนำ",
    "ร้านช้า": "ร้านค้า", "พื นดิน": "พื้นดิน", "ส้าคัญ": "สำคัญ",
    "เสื อแจ็คเก็ต": "เสื้อแจ็คเก็ต", "ขี เกียจ": "ขี้เกียจ", "ที่ตั ง": "ที่ตั้ง",
    "จ้าเป็น": "จำเป็น", "จดจ้า": "จดจำ", "ส้ารวจ": "สำรวจ",
}


def numbered_segments(line: str):
    matches = list(re.finditer(r"(?<!\S)(\d{1,4})\s+", line))
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(line)
        yield int(match.group(1)), line[match.end():end].strip()


def extract_pdf(filename: str) -> str:
    reader = PdfReader(SOURCE / filename)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def read_thai(grade: int):
    text = extract_pdf(f"คำศัพท์พื้นฐาน ภาษาไทย ป.{grade}.pdf")
    limit = 300 if grade <= 3 else 500
    words = {}
    for line in text.splitlines():
        for number, value in numbered_segments(line):
            if 1 <= number <= limit and value:
                words[number] = THAI_GLYPH_FIXES.get(value, value)
    if sorted(words) != list(range(1, limit + 1)):
        raise ValueError(f"Thai grade {grade}: source sequence is incomplete")
    return [{"id": number, "word": words[number]} for number in sorted(words)]


def read_english(grade: int):
    text = extract_pdf(f"คำศัพท์พื้นฐาน ภาษาอังกฤษ ป.{grade}.pdf")
    limit = 50 if grade <= 3 else 100
    words = {}
    for line in text.splitlines():
        for number, value in numbered_segments(line):
            if not (1 <= number <= limit and value):
                continue
            parts = re.match(r"^([A-Za-z][A-Za-z .,'-]*?)\s+([ก-๙].*)$", value)
            if parts:
                word, meaning = parts.groups()
                words[number] = {
                    "id": number,
                    "word": word.strip(),
                    "meaning": ENGLISH_MEANING_FIXES.get(meaning.strip(), meaning.strip()),
                }
    if sorted(words) != list(range(1, limit + 1)):
        raise ValueError(f"English grade {grade}: source sequence is incomplete")
    return [words[number] for number in sorted(words)]


def main():
    data = {"thai": {}, "english": {}}
    for grade in range(1, 7):
        data["thai"][str(grade)] = read_thai(grade)
        data["english"][str(grade)] = read_english(grade)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(
        f"wrote {OUTPUT}: "
        f"{sum(map(len, data['thai'].values()))} Thai + "
        f"{sum(map(len, data['english'].values()))} English entries"
    )


if __name__ == "__main__":
    main()
