import { createWorker } from "tesseract.js";

export interface OCRResult {
  hn: string;
  an: string;
  firstName: string;
  lastName: string;
  age: number | "";
  sex: "male" | "female" | "";
}

/** รัน Tesseract OCR บนรูปภาพ และ parse ข้อมูลผู้ป่วยจากสติ๊กเกอร์ */
export async function ocrPatientLabel(
  imageFile: File,
  onProgress?: (pct: number) => void,
): Promise<OCRResult> {
  const worker = await createWorker("tha+eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  try {
    const url = URL.createObjectURL(imageFile);
    const { data: { text } } = await worker.recognize(url);
    URL.revokeObjectURL(url);
    return parsePatientText(text);
  } finally {
    await worker.terminate();
  }
}

/** แยกข้อมูลจากข้อความที่ OCR ได้ */
export function parsePatientText(text: string): OCRResult {
  const result: OCRResult = { hn: "", an: "", firstName: "", lastName: "", age: "", sex: "" };

  // normalize: ลบขึ้นบรรทัดซ้อน + ช่องว่างหลายตัว
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const flat  = lines.join(" ");

  // HN / AN
  const hnMatch = flat.match(/HN\s*[:\s]\s*(\d{6,12})/i);
  const anMatch = flat.match(/AN\s*[:\s]\s*(\d{6,12})/i);
  if (hnMatch) result.hn = hnMatch[1];
  if (anMatch) result.an = anMatch[1];

  // เพศ + ชื่อ-นามสกุล
  // รูปแบบ: ด.ช.ชื่อ นามสกุล หรือ ด.ญ.ชื่อ นามสกุล
  // หรือ นาย/นาง/นางสาว ชื่อ นามสกุล
  const nameLineIdx = lines.findIndex((l) =>
    /ด\.[ชญ]\.|นาย|นาง|น\.ส\.|เด็กชาย|เด็กหญิง/i.test(l),
  );

  if (nameLineIdx >= 0) {
    const nameLine = lines[nameLineIdx];

    // เพศจาก prefix
    if (/ด\.ช\.|เด็กชาย|นาย/.test(nameLine))         result.sex = "male";
    else if (/ด\.ญ\.|เด็กหญิง|นาง(?!สาว)|น\.ส\./.test(nameLine)) result.sex = "female";

    // ลบ prefix ออก แล้วตัดชื่อ-นามสกุล
    const stripped = nameLine
      .replace(/ด\.[ชญ]\.|เด็กชาย|เด็กหญิง|นาย|นางสาว|น\.ส\.|นาง/g, "")
      .trim();

    // ตัดส่วน "อายุ N ปี..." ออก
    const nameOnly = stripped.replace(/\s+อายุ.*$/i, "").replace(/\s+\d+\s+ปี.*$/i, "").trim();

    const parts = nameOnly.split(/\s+/);
    if (parts.length >= 1) result.firstName = parts[0];
    if (parts.length >= 2) result.lastName  = parts[1];
  }

  // อายุ — หาจาก "อายุ N ปี" หรือ "N ปี N เดือน"
  const ageMatch = flat.match(/อายุ\s*(\d+)\s*ปี/i) || flat.match(/(\d+)\s*ปี\s*\d+\s*เดือน/i);
  if (ageMatch) result.age = Number(ageMatch[1]);

  return result;
}
