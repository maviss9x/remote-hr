import fs from "fs";
import path from "path";
import PizZip from "pizzip";

export interface ContractDocData {
  agreementDate?: string;
  fullName: string;
  dob?: string;
  currentAddress?: string;
  permanentAddress?: string;
  cccd?: string;
  cccdDate?: string;
  cccdPlace?: string;
  bankAccount?: string;
  bankName?: string;
  startDate?: string;
  endDate?: string;
}

function escapeXml(unsafe?: string): string {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

function parseDateComponents(dateStr?: string) {
  if (!dateStr) {
    const now = new Date();
    return {
      day: padZero(now.getDate()),
      month: padZero(now.getMonth() + 1),
      year: String(now.getFullYear()),
      yearPrefix: String(now.getFullYear()).slice(0, 2),
      yearSuffix: String(now.getFullYear()).slice(2),
    };
  }

  // Format DD/MM/YYYY
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return {
        day: padZero(parseInt(parts[0], 10)),
        month: padZero(parseInt(parts[1], 10)),
        year: parts[2].trim(),
        yearPrefix: parts[2].trim().slice(0, 2),
        yearSuffix: parts[2].trim().slice(2),
      };
    }
  }

  // ISO format or other Date parseable
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return {
      day: padZero(now.getDate()),
      month: padZero(now.getMonth() + 1),
      year: String(now.getFullYear()),
      yearPrefix: String(now.getFullYear()).slice(0, 2),
      yearSuffix: String(now.getFullYear()).slice(2),
    };
  }

  return {
    day: padZero(d.getDate()),
    month: padZero(d.getMonth() + 1),
    year: String(d.getFullYear()),
    yearPrefix: String(d.getFullYear()).slice(0, 2),
    yearSuffix: String(d.getFullYear()).slice(2),
  };
}

function getTemplateBuffer(): Buffer {
  const candidatePaths = [
    path.join(process.cwd(), "src/templates/bien_ban_thoa_thuan_lam_viec.docx"),
    path.join(process.cwd(), "app/src/templates/bien_ban_thoa_thuan_lam_viec.docx"),
    path.join(process.cwd(), "../TaiLieu/Quy Trinh Quan Ly nhan su/BB Thỏa thuận làm việc.docx"),
    path.join(process.cwd(), "TaiLieu/Quy Trinh Quan Ly nhan su/BB Thỏa thuận làm việc.docx"),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate);
    }
  }

  throw new Error("Không tìm thấy tệp mẫu docx 'BB Thỏa thuận làm việc.docx'");
}

/**
 * Tạo file docx biên bản thỏa thuận làm việc với dữ liệu nhân viên,
 * giữ nguyên 100% định dạng, layout, styles, và font chữ gốc.
 */
export function generateContractDocx(data: ContractDocData): Buffer {
  const templateBuffer = getTemplateBuffer();
  const zip = new PizZip(templateBuffer);
  let xml = zip.file("word/document.xml")?.asText();

  if (!xml) {
    throw new Error("Không thể đọc word/document.xml từ tệp mẫu");
  }

  const agreeDate = parseDateComponents(data.agreementDate);
  const startDate = parseDateComponents(data.startDate);
  const endDate = parseDateComponents(data.endDate);

  // 1. Ngày tháng năm lập biên bản (Hôm nay, ngày ... tháng ... năm ...)
  const pAgreeRegex = /(<w:p [^>]*w14:paraId="2E756B53"[^>]*>[\s\S]*?<\/w:p>)/;
  xml = xml.replace(pAgreeRegex, (pXml) => {
    let modified = pXml;
    modified = modified.replace(
      /(<w:t xml:space="preserve">\s*)01(\s*<\/w:t>)/,
      `$1${agreeDate.day}$2`
    );
    modified = modified.replace(/(<w:t>)09(<\/w:t>)/, `$1${agreeDate.month}$2`);
    modified = modified.replace(
      /(<w:t xml:space="preserve">\s*)20(<\/w:t>)/,
      `$1${agreeDate.yearPrefix}$2`
    );
    modified = modified.replace(/(<w:t>)26(<\/w:t>)/, `$1${agreeDate.yearSuffix}$2`);
    return modified;
  });

  // 2. Họ và tên Bên B
  xml = xml.replace(
    "<w:t>…………………………………………………………………………………</w:t>",
    `<w:t>${escapeXml(data.fullName ? data.fullName.toUpperCase() : "")}</w:t>`
  );

  // 3. Sinh ngày
  xml = xml.replace(
    "<w:t>………………………………………………………………………………</w:t>",
    `<w:t>${escapeXml(data.dob || "………………………………………………………………………………")}</w:t>`
  );

  // 4. Nơi ở hiện nay
  xml = xml.replace(
    '<w:t xml:space="preserve"> …………………………………………………………………………</w:t>',
    `<w:t xml:space="preserve"> ${escapeXml(data.currentAddress || "…………………………………………………………………………")}</w:t>`
  );

  // 5. Địa chỉ thường trú
  if (data.permanentAddress) {
    xml = xml.replace(
      '<w:t xml:space="preserve"> ……………………………………………………</w:t>',
      `<w:t xml:space="preserve"> ${escapeXml(data.permanentAddress)}</w:t>`
    );
    xml = xml.replace("<w:t>………………...</w:t>", "<w:t></w:t>");
  }

  // 6. CMND / CCCD
  if (data.cccd) {
    xml = xml.replace(
      '<w:t xml:space="preserve">…………………… </w:t>',
      `<w:t xml:space="preserve">${escapeXml(data.cccd)} </w:t>`
    );
  }
  if (data.cccdDate) {
    xml = xml.replace(
      "<w:t>: … / … / ……</w:t>",
      `<w:t>: ${escapeXml(data.cccdDate)}</w:t>`
    );
  }
  if (data.cccdPlace) {
    xml = xml.replace(
      '<w:t xml:space="preserve"> …………………...</w:t>',
      `<w:t xml:space="preserve"> ${escapeXml(data.cccdPlace)}</w:t>`
    );
  }

  // 7. Số tài khoản & Ngân hàng
  if (data.bankAccount) {
    xml = xml.replace(
      "<w:t>: ………………………………</w:t>",
      `<w:t>: ${escapeXml(data.bankAccount)}</w:t>`
    );
  }
  if (data.bankName) {
    xml = xml.replace(
      "<w:t>………………………………</w:t>",
      `<w:t>${escapeXml(data.bankName)}</w:t>`
    );
  }

  // 8. Bắt đầu từ ngày ... đến ngày ...
  const pTermRegex = /(<w:p [^>]*w14:paraId="6B49C23F"[^>]*>[\s\S]*?<\/w:p>)/;
  xml = xml.replace(pTermRegex, (pXml) => {
    let modified = pXml;
    let replacedCount = 0;
    modified = modified.replace(/<w:t>01<\/w:t>/g, () => {
      replacedCount++;
      return replacedCount === 1 ? `<w:t>${startDate.day}</w:t>` : `<w:t>${endDate.day}</w:t>`;
    });
    modified = modified.replace("<w:t>09<\/w:t>", `<w:t>${startDate.month}</w:t>`);
    modified = modified.replace("<w:t>12<\/w:t>", `<w:t>${endDate.month}</w:t>`);
    modified = modified.replace(
      '<w:t xml:space="preserve"> 2026 </w:t>',
      `<w:t xml:space="preserve"> ${startDate.year} </w:t>`
    );
    modified = modified.replace(
      '<w:t xml:space="preserve"> 2026<\/w:t>',
      `<w:t xml:space="preserve"> ${endDate.year}</w:t>`
    );
    return modified;
  });

  zip.file("word/document.xml", xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
