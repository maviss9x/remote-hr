"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { alertModal } from "@/components/ui";
import {
  X,
  Printer,
  Download,
  FileText,
  FileDown,
  Eye,
  RefreshCw,
  RotateCcw,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikeIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Sparkles,
  Check,
  Edit3,
  Eraser,
  Save,
} from "lucide-react";

interface ContractPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated?: () => void;
  user: {
    id: number;
    fullName: string;
    phone: string;
    email?: string;
    cccd?: string;
    cccdDate?: string;
    cccdPlace?: string;
    currentAddress?: string;
    permanentAddress?: string;
    bankAccount?: string;
    bankName?: string;
    startDate: string;
    dateOfBirth?: string;
    latestContract?: {
      startDate: string;
      endDate: string;
      contractType?: string;
    } | null;
  } | null;
}

function formatDateParts(dateStr?: string): { day: string; month: string; year: string } {
  if (!dateStr) {
    const now = new Date();
    return {
      day: String(now.getDate()).padStart(2, "0"),
      month: String(now.getMonth() + 1).padStart(2, "0"),
      year: String(now.getFullYear()),
    };
  }

  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return {
        day: parts[0].padStart(2, "0"),
        month: parts[1].padStart(2, "0"),
        year: parts[2].trim(),
      };
    }
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return {
      day: String(now.getDate()).padStart(2, "0"),
      month: String(now.getMonth() + 1).padStart(2, "0"),
      year: String(now.getFullYear()),
    };
  }

  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: String(d.getMonth() + 1).padStart(2, "0"),
    year: String(d.getFullYear()),
  };
}

// ============================================================================
// HÀM TẠO HTML BỐ CỤC CHUẨN A4 BẢO ĐẢM KHÔNG VỠ KHUNG
// ============================================================================
function generateStandardA4Html(data: {
  agreementDate: string;
  fullName: string;
  dob: string;
  currentAddress: string;
  permanentAddress: string;
  cccd: string;
  cccdDate: string;
  cccdPlace: string;
  bankAccount: string;
  bankName: string;
  startDate: string;
  endDate: string;
}) {
  const agree = formatDateParts(data.agreementDate);
  const start = formatDateParts(data.startDate);
  const end = formatDateParts(data.endDate);

  return `
    <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 20px;">
      <tr>
        <td style="width: 46%; text-align: center; vertical-align: top; border: none; padding: 0;">
          <div style="font-weight: bold; font-size: 11pt; text-transform: uppercase;">CÔNG TY CỔ PHẦN</div>
          <div style="font-weight: bold; font-size: 11pt; text-transform: uppercase;">THƯƠNG MẠI FREETRIP</div>
          <div style="width: 80px; height: 1px; background-color: #000; margin: 4px auto 0;"></div>
        </td>
        <td style="width: 54%; text-align: center; vertical-align: top; border: none; padding: 0;">
          <div style="font-weight: bold; font-size: 11pt; text-transform: uppercase;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div style="font-weight: bold; font-size: 11.5pt;">Độc lập - Tự do - Hạnh phúc</div>
          <div style="width: 110px; height: 1px; background-color: #000; margin: 4px auto 0;"></div>
        </td>
      </tr>
    </table>

    <div style="text-align: center; margin: 26px 0 18px 0;">
      <span style="font-weight: bold; font-size: 15pt; text-transform: uppercase; letter-spacing: 0.5px;">BIÊN BẢN THỎA THUẬN LÀM VIỆC</span>
    </div>

    <div style="font-style: italic; font-size: 12pt; margin-bottom: 12px;">
      <div>- Căn cứ Bộ luật Dân sự 2015;</div>
      <div>- Căn cứ vào ý chí của các bên.</div>
    </div>

    <div style="font-style: italic; margin-bottom: 14px; text-align: justify;">
      Hôm nay, ngày ${agree.day} tháng ${agree.month} năm ${agree.year}, tại Công ty Cổ phần Thương mại Freetrip.
    </div>

    <div style="font-weight: bold; margin-bottom: 6px;">Chúng tôi gồm có:</div>

    <div style="margin-bottom: 12px;">
      <div style="font-weight: bold;">BÊN A (BÊN THUÊ):</div>
      <div style="padding-left: 20px;">
        <div style="font-weight: bold;">CÔNG TY CỔ PHẦN THƯƠNG MẠI FREETRIP</div>
        <div>Địa chỉ: 11A Nguyễn Hoàng Tôn, Tây Hồ, Hà Nội</div>
        <div>Điện thoại: 0989 811 555</div>
        <div>Đại diện: <strong>Bà Phạm Thị Quyên</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Chức vụ: Giám đốc</div>
      </div>
    </div>

    <div style="margin-bottom: 14px;">
      <div style="font-weight: bold;">BÊN B (BÊN NHẬN VIỆC):</div>
      <div style="padding-left: 20px;">
        <div>Ông/Bà: <strong style="text-transform: uppercase;">${data.fullName || "…………………………………………………………………………………"}</strong></div>
        <div>Sinh ngày: ${data.dob || "………………………………………………………………………………"}</div>
        <div>Nơi ở hiện nay: ${data.currentAddress || "…………………………………………………………………………"}</div>
        <div>Địa chỉ thường trú: ${data.permanentAddress || "……………………………………………………………………..."}</div>
        <div>CMND/CCCD số: <strong>${data.cccd || "……………………"}</strong> &nbsp;&nbsp; Ngày cấp: ${data.cccdDate || "… / … / ……"} &nbsp;&nbsp; Nơi cấp: ${data.cccdPlace || "…………………..."}</div>
        <div>Số tài khoản: <strong>${data.bankAccount || "………………………………"}</strong> &nbsp;&nbsp; Ngân hàng: <strong>${data.bankName || "………………………………"}</strong></div>
      </div>
    </div>

    <div style="font-style: italic; margin-bottom: 14px; text-align: justify;">
      Cùng thống nhất ký kết Bản thỏa thuận với những điều, khoản sau:
    </div>

    <div style="margin-bottom: 12px;">
      <div style="font-weight: bold;">Điều 1. Nội dung & yêu cầu công việc</div>
      <div style="font-weight: bold; padding-left: 14px;">1.1. Nhiệm vụ cơ bản</div>
      <div style="padding-left: 20px;">
        - Tải ứng dụng Freetrip, trải nghiệm và đánh giá trên App Store hoặc CH Play.<br />
        - Chủ động tìm hiểu, nắm vững thông tin về sản phẩm của công ty.
      </div>
      <div style="font-weight: bold; padding-left: 14px; margin-top: 4px;">1.2. Nhiệm vụ Seeding</div>
      <div style="padding-left: 20px;">
        - <strong>Đăng bài:</strong> Triển khai nội dung chất lượng, bám sát xu hướng theo chiến dịch truyền thông của Công ty.<br />
        - <strong>Bình luận:</strong> Tương tác tự nhiên, phù hợp với ngữ cảnh nhằm khéo léo quảng bá và điều hướng theo đúng mục tiêu.
      </div>
    </div>

    <div style="page-break-before: always; break-before: page; margin-bottom: 12px;">
      <div style="font-weight: bold;">Điều 2. Thời gian thực hiện công việc</div>
      <div style="padding-left: 20px;">
        Thời gian thực hiện công việc: <strong>03 tháng</strong><br />
        Bắt đầu từ ngày <strong>${start.day}</strong> tháng <strong>${start.month}</strong> năm <strong>${start.year}</strong> đến ngày <strong>${end.day}</strong> tháng <strong>${end.month}</strong> năm <strong>${end.year}</strong>.
      </div>
    </div>

    <div style="margin-bottom: 12px;">
      <div style="font-weight: bold;">Điều 3. Thù lao và tiến độ thanh toán</div>
      <div style="padding-left: 20px; text-align: justify;">
        <div>3.1. Bên A sẽ trả thù lao cho Bên B để thực hiện các công việc nêu tại Điều 1 của Biên bản thỏa thuận làm việc này.</div>
        <div style="padding-left: 14px; margin: 4px 0;">
          Mức thù lao:<br />
          - Ca ngày: <strong>25.000 VNĐ / giờ làm việc</strong><br />
          - Ca tối: <strong>33.000 VNĐ / giờ làm việc</strong><br />
          - Thưởng hiệu suất (nếu đạt yêu cầu theo các mức trong quy định).
        </div>
        <div>3.2. Bên A sẽ thanh toán tiền thù lao cho bên B vào ngày 10 tháng kế tiếp.</div>
        <div>3.3. Hình thức thanh toán: Chuyển khoản.</div>
      </div>
    </div>

    <div style="margin-bottom: 12px;">
      <div style="font-weight: bold;">Điều 4. Quyền và nghĩa vụ của Bên A</div>
      <div style="padding-left: 20px; text-align: justify;">
        4.1. Cung cấp đầy đủ thông tin sản phẩm, nội dung mẫu và hướng dẫn quy trình làm việc chi tiết để Bên B có thể thực hiện tốt các công việc được giao.<br />
        4.2. Thanh toán đầy đủ, đúng thời hạn và đúng phương thức tiền thù lao cho Bên B như đã thoả thuận tại Điều 3 của Biên bản này.<br />
        4.3. Có quyền kiểm tra, giám sát chất lượng và số lượng công việc của Bên B. Bên A được quyền yêu cầu Bên B chỉnh sửa hoặc làm bù nếu công việc không đạt yêu cầu, đi lệch thông điệp hoặc vi phạm quy tắc vận hành của dự án.<br />
        4.4. Được quyền đơn phương chấm dứt thỏa thuận và từ chối thanh toán thù lao nếu Bên B thường xuyên bỏ dở công việc không rõ lý do, không hoàn thành đủ khối lượng và chất lượng công việc hoặc có hành vi không chuẩn mực và làm ảnh hưởng xấu đến hình ảnh, uy tín của Công ty.<br />
        4.5. Các quyền và nghĩa vụ khác theo quy định của Biên bản này và của pháp luật.
      </div>
    </div>

    <div style="margin-bottom: 12px;">
      <div style="font-weight: bold;">Điều 5. Quyền và nghĩa vụ của Bên B</div>
      <div style="padding-left: 20px; text-align: justify;">
        5.1. Thực hiện đầy đủ, chính xác số lượng, chất lượng công việc và đăng bài đúng theo yêu cầu của Bên A. Tuân thủ các quy tắc vận hành công việc do Bên A đề ra.<br />
        5.2. Chủ động cập nhật đúng tiến độ, báo cáo kết quả công việc vào bảng báo cáo nội dung theo yêu cầu của Bên A.<br />
        5.3. Bảo mật tuyệt đối các thông tin về định hướng công việc và tài liệu nội bộ của Bên A. Không sử dụng các thông tin công việc cho mục đích cá nhân hoặc tiết lộ cho bất kỳ bên thứ ba nào.<br />
        5.4. Có quyền yêu cầu Bên A hỗ trợ, giải đáp thắc mắc về sản phẩm và cung cấp các tài nguyên cần thiết trong quá trình làm việc.<br />
        5.5. Yêu cầu Bên A thanh toán thù lao đầy đủ và đúng hạn sau khi đã đối soát xong tiến độ, khối lượng và chất lượng công việc.<br />
        5.6. Các quyền và nghĩa vụ khác theo quy định của Biên bản này và quy định của pháp luật.
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <div style="font-weight: bold;">Điều 6. Điều khoản chung</div>
      <div style="padding-left: 20px; text-align: justify;">
        6.1. Hai bên cam kết thi hành nghiêm chỉnh các điều khoản của Biên bản này;<br />
        6.2. Mọi tranh chấp phát sinh trong quá trình thực hiện Biên bản sẽ được giải quyết trước tiên thông qua thương lượng. Trường hợp không thương lượng được thì tranh chấp sẽ do bên thứ ba có thẩm quyền giải quyết;<br />
        6.3. Biên bản này có hiệu lực và được thực hiện kể từ ngày ký;<br />
        6.4. Biên bản này gồm 03 trang 06 Điều, được lập thành 02 bản có hiệu lực như nhau do mỗi bên giữ 01 bản.
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; border: none; margin-top: 28px; page-break-inside: avoid;">
      <tr>
        <td style="width: 50%; text-align: center; vertical-align: top; border: none; padding: 0;">
          <div style="font-weight: bold;">BÊN A</div>
          <div style="font-style: italic; font-size: 11pt; margin-top: 2px;">(Ký, ghi rõ họ tên)</div>
          <div style="height: 65px;"></div>
        </td>
        <td style="width: 50%; text-align: center; vertical-align: top; border: none; padding: 0;">
          <div style="font-weight: bold;">BÊN B</div>
          <div style="font-style: italic; font-size: 11pt; margin-top: 2px;">(Ký, ghi rõ họ tên)</div>
          <div style="height: 65px;"></div>
        </td>
      </tr>
    </table>
  `;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function ContractPrintModal({
  isOpen,
  onClose,
  onUserUpdated,
  user,
}: ContractPrintModalProps) {
  const [mounted, setMounted] = useState(false);
  const documentAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Form State
  const [formData, setFormData] = useState({
    agreementDate: new Date().toISOString().slice(0, 10),
    fullName: "",
    dob: "",
    currentAddress: "",
    permanentAddress: "",
    cccd: "",
    cccdDate: "",
    cccdPlace: "",
    bankAccount: "",
    bankName: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
  });

  const [activeTab, setActiveTab] = useState<"both" | "preview" | "edit">("both");
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [savingToProfile, setSavingToProfile] = useState(false);
  const [syncToast, setSyncToast] = useState(false);

  // Khởi tạo formData từ user Hybrid
  const initFormData = (currentUser: NonNullable<ContractPrintModalProps["user"]>) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const defaultStartDate = currentUser.latestContract
      ? new Date(currentUser.latestContract.startDate).toISOString().slice(0, 10)
      : new Date(currentUser.startDate).toISOString().slice(0, 10);

    let defaultEndDate = "";
    if (currentUser.latestContract?.endDate) {
      defaultEndDate = new Date(currentUser.latestContract.endDate).toISOString().slice(0, 10);
    } else {
      const d = new Date(defaultStartDate);
      d.setMonth(d.getMonth() + 3);
      defaultEndDate = d.toISOString().slice(0, 10);
    }

    let defaultDob = "";
    if (currentUser.dateOfBirth) {
      const parts = currentUser.dateOfBirth.split("T")[0].split("-");
      if (parts.length === 3) {
        defaultDob = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    let defaultCccdDate = "";
    if (currentUser.cccdDate) {
      const parts = currentUser.cccdDate.split("T")[0].split("-");
      if (parts.length === 3) {
        defaultCccdDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    return {
      agreementDate: todayStr,
      fullName: currentUser.fullName || "",
      dob: defaultDob,
      currentAddress: currentUser.currentAddress || "",
      permanentAddress: currentUser.permanentAddress || "",
      cccd: currentUser.cccd || "",
      cccdDate: defaultCccdDate,
      cccdPlace: currentUser.cccdPlace || "",
      bankAccount: currentUser.bankAccount || "",
      bankName: currentUser.bankName || "",
      startDate: defaultStartDate,
      endDate: defaultEndDate,
    };
  };

  // Nạp lại nội dung HTML vào trang A4 khi khởi tạo hoặc thay đổi user
  useEffect(() => {
    if (user && documentAreaRef.current) {
      const initial = initFormData(user);
      setFormData(initial);
      documentAreaRef.current.innerHTML = generateStandardA4Html(initial);
    }
  }, [user, isOpen]);

  if (!mounted || !isOpen || !user) return null;

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Điền lại thông tin form vào văn bản A4
  const handleApplyFormToDoc = () => {
    if (documentAreaRef.current) {
      documentAreaRef.current.innerHTML = generateStandardA4Html(formData);
      setSyncToast(true);
      setTimeout(() => setSyncToast(false), 2000);
    }
  };

  // Khôi phục lại mẫu gốc ban đầu
  const handleResetToDefault = () => {
    if (user && documentAreaRef.current) {
      const defaultData = initFormData(user);
      setFormData(defaultData);
      documentAreaRef.current.innerHTML = generateStandardA4Html(defaultData);
      setSyncToast(true);
      setTimeout(() => setSyncToast(false), 2000);
    }
  };

  // Lưu thông tin trực tiếp vào hồ sơ nhân sự Hybrid trong Database
  const handleSaveToUserDatabase = async () => {
    if (!user) return;
    try {
      setSavingToProfile(true);

      const parseDateToIso = (str?: string) => {
        if (!str || !str.trim()) return null;
        const s = str.trim();
        if (s.includes("/")) {
          const parts = s.split("/");
          if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          }
        }
        if (s.includes("-") && s.length >= 10) {
          return s.slice(0, 10);
        }
        return null;
      };

      const payload = {
        fullName: formData.fullName,
        cccd: formData.cccd || null,
        cccdDate: parseDateToIso(formData.cccdDate),
        cccdPlace: formData.cccdPlace || null,
        currentAddress: formData.currentAddress || null,
        permanentAddress: formData.permanentAddress || null,
        bankAccount: formData.bankAccount || null,
        bankName: formData.bankName || null,
        dateOfBirth: parseDateToIso(formData.dob),
        contractStartDate: formData.startDate,
        contractEndDate: formData.endDate,
      };

      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể lưu vào hồ sơ nhân sự");

      alertModal({
        title: "Đã lưu vào hồ sơ",
        message: `Đã đồng bộ thông tin của nhân sự ${formData.fullName} vào cơ sở dữ liệu thành công!`,
        type: "success",
      });

      if (onUserUpdated) onUserUpdated();
    } catch (err: any) {
      alertModal({
        title: "Lỗi lưu dữ liệu",
        message: err.message,
        type: "danger",
      });
    } finally {
      setSavingToProfile(false);
    }
  };

  // Thực thi lệnh định dạng tài liệu (Document Formatting Tools)
  const executeDocCommand = (cmd: string, val: string = "") => {
    if (documentAreaRef.current) {
      documentAreaRef.current.focus();
    }
    document.execCommand(cmd, false, val);
  };

  // Tải file DOCX
  const handleDownloadDocx = async () => {
    try {
      setDownloadingDocx(true);
      const res = await fetch(`/api/users/${user.id}/contract-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Không thể tạo file Word");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (formData.fullName || "nhan_vien").replace(/\s+/g, "_");
      a.download = `BB_Thoa_thuan_lam_viec_${safeName}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alertModal({
        title: "Lỗi tải file",
        message: "Lỗi khi tải file DOCX: " + err.message,
        type: "danger",
      });
    } finally {
      setDownloadingDocx(false);
    }
  };

  // In hoặc Lưu PDF trực tiếp nội dung đang chỉnh sửa
  const printContractDocument = () => {
    if (!documentAreaRef.current) return;
    const contentHtml = documentAreaRef.current.innerHTML;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    const docTitle = `BB_Thoa_thuan_lam_viec_${(formData.fullName || "nhan_vien").replace(/\s+/g, "_")}`;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="vi">
        <head>
          <title>${docTitle}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 15mm 15mm 15mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: "Times New Roman", Times, serif;
              font-size: 13pt;
              line-height: 1.45;
              color: #000000 !important;
              background: #ffffff !important;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            table {
              border-collapse: collapse;
            }
            .page-break-before {
              page-break-before: always !important;
              break-before: page !important;
            }
            .avoid-break {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          </style>
        </head>
        <body>
          <div style="width: 100%; padding: 0;">
            ${contentHtml}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Lỗi khi mở hộp thoại in:", err);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }
    }, 300);
  };

  const modalContent = (
    <div
      className="contract-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 999999,
        backgroundColor: "rgba(8, 12, 22, 0.88)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        boxSizing: "border-box",
      }}
    >
      <div
        className="contract-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#151928",
          borderRadius: "16px",
          width: "96vw",
          maxWidth: activeTab === "preview" ? "980px" : "1420px",
          height: "94vh",
          maxHeight: "94vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.8)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          overflow: "hidden",
          transition: "max-width 0.25s ease",
          zIndex: 1000000,
        }}
      >
        {/* MODAL HEADER */}
        <div
          className="contract-modal-header"
          style={{
            padding: "0.875rem 1.5rem",
            minHeight: "68px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#1e243a",
            flexShrink: 0,
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: "rgba(249, 115, 22, 0.15)",
                color: "#f97316",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1.125rem", color: "#ffffff" }}>
                Biên Bản Thỏa Thuận Làm Việc
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
                Nhân sự: <strong style={{ color: "#f97316" }}>{user.fullName}</strong> • SĐT: {user.phone}
              </div>
            </div>
          </div>

          {/* Action Toolbar Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
            {/* View switcher */}
            <div
              style={{
                display: "flex",
                backgroundColor: "#121624",
                padding: "3px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("both")}
                style={{
                  padding: "6px 12px",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: activeTab === "both" ? "#f97316" : "transparent",
                  color: activeTab === "both" ? "#ffffff" : "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Edit3 size={14} /> Chỉnh sửa & Xem
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                style={{
                  padding: "6px 12px",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: activeTab === "preview" ? "#f97316" : "transparent",
                  color: activeTab === "preview" ? "#ffffff" : "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Eye size={14} /> Chỉ xem A4
              </button>
            </div>

            {/* Tải DOCX */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownloadDocx}
              disabled={downloadingDocx}
              style={{
                padding: "0.5rem 0.875rem",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 600,
                fontSize: "0.875rem",
              }}
              title="Tải file Word nguyên bản (.docx)"
            >
              {downloadingDocx ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <FileDown size={16} color="#38bdf8" />
              )}
              Tải DOCX
            </button>

            {/* Tải PDF */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={printContractDocument}
              style={{
                padding: "0.5rem 0.875rem",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 600,
                fontSize: "0.875rem",
              }}
              title="Xuất file PDF"
            >
              <Download size={16} color="#f59e0b" />
              Tải PDF
            </button>

            {/* In Biên Bản */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={printContractDocument}
              style={{
                padding: "0.5rem 1rem",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 700,
                fontSize: "0.875rem",
              }}
            >
              <Printer size={16} />
              In Biên Bản
            </button>

            {/* Đóng Modal */}
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              onClick={onClose}
              style={{ padding: "8px", marginLeft: "4px" }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div
          className="contract-modal-body"
          style={{
            display: "flex",
            flex: 1,
            overflow: "hidden",
            backgroundColor: "#101420",
          }}
        >
          {/* CỘT TRÁI: FORM ĐIỀN THÔNG TIN BỔ SUNG */}
          {activeTab !== "preview" && (
            <div
              className="contract-modal-sidebar no-print"
              style={{
                width: activeTab === "edit" ? "100%" : "380px",
                minWidth: "340px",
                maxWidth: "420px",
                padding: "1.25rem",
                overflowY: "auto",
                borderRight: "1px solid rgba(255, 255, 255, 0.08)",
                backgroundColor: "#151928",
                display: "flex",
                flexDirection: "column",
                gap: "0.875rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.25rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Edit3 size={16} color="#f97316" />
                  Thông Tin Nhân Sự Remote
                </div>

                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="btn btn-secondary"
                  style={{
                    padding: "4px 8px",
                    fontSize: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title="Khôi phục lại nội dung mẫu ban đầu"
                >
                  <RotateCcw size={12} />
                  Mẫu gốc
                </button>
              </div>

              {/* Action Buttons: Điền vào văn bản & Lưu vào hồ sơ Database */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={handleApplyFormToDoc}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.875rem",
                    borderRadius: "8px",
                    border: "1px solid rgba(249, 115, 22, 0.4)",
                    backgroundColor: "rgba(249, 115, 22, 0.12)",
                    color: "#f97316",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Sparkles size={15} />
                  Điền lại thông tin form vào văn bản
                </button>

                <button
                  type="button"
                  onClick={handleSaveToUserDatabase}
                  disabled={savingToProfile}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.875rem",
                    borderRadius: "8px",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                    backgroundColor: "rgba(56, 189, 248, 0.12)",
                    color: "#38bdf8",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                  }}
                  title="Lưu các thông tin đã nhập vào Database nhân sự"
                >
                  {savingToProfile ? (
                    <RefreshCw size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  Lưu cập nhật vào hồ sơ nhân sự
                </button>
              </div>

              {syncToast && (
                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(34, 197, 94, 0.15)",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    color: "#4ade80",
                    fontSize: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Check size={14} />
                  <span>Đã cập nhật dữ liệu vào văn bản A4!</span>
                </div>
              )}

              {/* Ngày lập biên bản */}
              <div>
                <label className="label" style={{ fontSize: "0.75rem" }}>
                  Ngày lập biên bản
                </label>
                <input
                  type="date"
                  className="input input-sm"
                  value={formData.agreementDate}
                  onChange={(e) => handleInputChange("agreementDate", e.target.value)}
                />
              </div>

              {/* Họ và tên */}
              <div>
                <label className="label" style={{ fontSize: "0.75rem" }}>
                  Họ và tên nhân sự (Bên B) *
                </label>
                <input
                  type="text"
                  className="input input-sm"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange("fullName", e.target.value)}
                />
              </div>

              {/* Sinh ngày */}
              <div>
                <label className="label" style={{ fontSize: "0.75rem" }}>
                  Sinh ngày (ví dụ: 15/08/2000)
                </label>
                <input
                  type="text"
                  className="input input-sm"
                  placeholder="DD/MM/YYYY"
                  value={formData.dob}
                  onChange={(e) => handleInputChange("dob", e.target.value)}
                />
              </div>

              {/* CCCD & Ngày cấp */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label className="label" style={{ fontSize: "0.75rem" }}>
                    Số CMND/CCCD
                  </label>
                  <input
                    type="text"
                    className="input input-sm"
                    placeholder="12 chữ số"
                    value={formData.cccd}
                    onChange={(e) => handleInputChange("cccd", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: "0.75rem" }}>
                    Ngày cấp
                  </label>
                  <input
                    type="text"
                    className="input input-sm"
                    placeholder="DD/MM/YYYY"
                    value={formData.cccdDate}
                    onChange={(e) => handleInputChange("cccdDate", e.target.value)}
                  />
                </div>
              </div>

              {/* Nơi cấp CCCD */}
              <div>
                <label className="label" style={{ fontSize: "0.75rem" }}>
                  Nơi cấp CMND/CCCD
                </label>
                <input
                  type="text"
                  className="input input-sm"
                  placeholder="Nhập nơi cấp (VD: Cục Cảnh sát QLHC về TTXH)"
                  value={formData.cccdPlace}
                  onChange={(e) => handleInputChange("cccdPlace", e.target.value)}
                />
              </div>

              {/* Nơi ở hiện nay */}
              <div>
                <label className="label" style={{ fontSize: "0.75rem" }}>
                  Nơi ở hiện nay
                </label>
                <input
                  type="text"
                  className="input input-sm"
                  placeholder="Số nhà, đường, phường/xã, tỉnh/TP"
                  value={formData.currentAddress}
                  onChange={(e) => handleInputChange("currentAddress", e.target.value)}
                />
              </div>

              {/* Địa chỉ thường trú */}
              <div>
                <label className="label" style={{ fontSize: "0.75rem" }}>
                  Địa chỉ thường trú
                </label>
                <input
                  type="text"
                  className="input input-sm"
                  placeholder="Theo hộ khẩu / CCCD"
                  value={formData.permanentAddress}
                  onChange={(e) => handleInputChange("permanentAddress", e.target.value)}
                />
              </div>

              {/* Tài khoản & Ngân hàng */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label className="label" style={{ fontSize: "0.75rem" }}>
                    Số tài khoản NH
                  </label>
                  <input
                    type="text"
                    className="input input-sm"
                    value={formData.bankAccount}
                    onChange={(e) => handleInputChange("bankAccount", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: "0.75rem" }}>
                    Ngân hàng
                  </label>
                  <input
                    type="text"
                    className="input input-sm"
                    value={formData.bankName}
                    onChange={(e) => handleInputChange("bankName", e.target.value)}
                  />
                </div>
              </div>

              {/* Thời hạn hợp đồng */}
              <div
                style={{
                  backgroundColor: "rgba(249, 115, 22, 0.08)",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(249, 115, 22, 0.2)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#f97316",
                    marginBottom: "0.5rem",
                  }}
                >
                  Thời Gian Thực Hiện Hợp Đồng
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label className="label" style={{ fontSize: "0.7rem" }}>
                      Bắt đầu
                    </label>
                    <input
                      type="date"
                      className="input input-sm"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange("startDate", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "0.7rem" }}>
                      Kết thúc
                    </label>
                    <input
                      type="date"
                      className="input input-sm"
                      value={formData.endDate}
                      onChange={(e) => handleInputChange("endDate", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CỘT PHẢI: KHÔNG GIAN BÀN LÀM VIỆC & TRANG GIẤY A4 SOẠN THẢO */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1.25rem 2rem 3.5rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              backgroundColor: "#0d111d",
            }}
          >
            {/* THANH CÔNG CỤ SOẠN THẢO TÀI LIỆU (DOCUMENT EDITOR TOOLBAR) */}
            <div
              className="contract-editor-toolbar no-print"
              style={{
                width: "210mm",
                maxWidth: "100%",
                marginBottom: "1rem",
                padding: "8px 12px",
                borderRadius: "10px",
                backgroundColor: "#1e243a",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                flexWrap: "wrap",
                boxShadow: "0 6px 20px rgba(0, 0, 0, 0.4)",
                position: "sticky",
                top: 0,
                zIndex: 30,
              }}
            >
              {/* Lịch sử */}
              <button
                type="button"
                onClick={() => executeDocCommand("undo")}
                className="toolbar-btn"
                style={toolBtnStyle}
                title="Hoàn tác (Ctrl+Z)"
              >
                <Undo2 size={16} />
              </button>
              <button
                type="button"
                onClick={() => executeDocCommand("redo")}
                className="toolbar-btn"
                style={toolBtnStyle}
                title="Làm lại (Ctrl+Y)"
              >
                <Redo2 size={16} />
              </button>

              <div style={toolDividerStyle} />

              {/* Định dạng văn bản */}
              <button
                type="button"
                onClick={() => executeDocCommand("bold")}
                className="toolbar-btn"
                style={toolBtnStyle}
                title="In đậm (Ctrl+B)"
              >
                <BoldIcon size={16} />
              </button>
              <button
                type="button"
                onClick={() => executeDocCommand("italic")}
                className="toolbar-btn"
                style={toolBtnStyle}
                title="In nghiêng (Ctrl+I)"
              >
                <ItalicIcon size={16} />
              </button>
              <button
                type="button"
                onClick={() => executeDocCommand("underline")}
                className="toolbar-btn"
                style={toolBtnStyle}
                title="Gạch chân (Ctrl+U)"
              >
                <UnderlineIcon size={16} />
              </button>
              <button
                type="button"
                onClick={() => executeDocCommand("strikeThrough")}
                className="toolbar-btn"
                style={toolBtnStyle}
                title="Gạch ngang chữ"
              >
                <StrikeIcon size={16} />
              </button>

              <div style={toolDividerStyle} />

              {/* Căn lề */}
              <button
                type="button"
                onClick={() => executeDocCommand("justifyLeft")}
                className="toolbar-btn"
                style={toolBtnStyle}
                title="Căn lề trái"
              >
                <AlignLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => executeDocCommand("justifyCenter")}
                className="toolbar-btn"
                style={toolBtnStyle}
                title="Căn giữa"
              >
                <AlignCenter size={16} />
              </button>
              <button
                type="button"
                onClick={() => executeDocCommand("justifyRight")}
                className="toolbar-btn"
                style={toolBtnStyle}
                title="Căn lề phải"
              >
                <AlignRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => executeDocCommand("justifyFull")}
                className="toolbar-btn"
                style={toolBtnStyle}
                title="Căn đều hai bên (Justify)"
              >
                <AlignJustify size={16} />
              </button>

              <div style={toolDividerStyle} />

              {/* Danh sách */}
              <button
                type="button"
                onClick={() => executeDocCommand("insertUnorderedList")}
                className="toolbar-btn"
                style={toolBtnStyle}
                title="Danh sách gạch đầu dòng"
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={() => executeDocCommand("insertOrderedList")}
                className="toolbar-btn"
                style={toolBtnStyle}
                title="Danh sách số"
              >
                <ListOrdered size={16} />
              </button>

              {/* Xóa định dạng */}
              <button
                type="button"
                onClick={() => executeDocCommand("removeFormat")}
                className="toolbar-btn"
                style={toolBtnStyle}
                title="Xóa định dạng đang chọn"
              >
                <Eraser size={16} />
              </button>

              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  ✍️ Nhấp trực tiếp vào bất kỳ chỗ nào trên trang giấy để sửa
                </span>
              </div>
            </div>

            {/* TRANG GIẤY A4 TRẮNG TINH SOẠN THẢO (CONTENT EDITABLE LIVE) */}
            <div
              style={{
                width: "210mm",
                minHeight: "297mm",
                backgroundColor: "#ffffff",
                boxShadow: "0 14px 40px rgba(0, 0, 0, 0.55)",
                borderRadius: "3px",
                position: "relative",
                boxSizing: "border-box",
                overflow: "visible",
              }}
            >
              <div
                ref={documentAreaRef}
                id="contract-print-document"
                contentEditable={true}
                suppressContentEditableWarning={true}
                spellCheck={false}
                style={{
                  width: "100%",
                  minHeight: "297mm",
                  backgroundColor: "#ffffff",
                  color: "#111827",
                  padding: "20mm 20mm",
                  boxSizing: "border-box",
                  fontFamily: "'Times New Roman', Times, serif",
                  fontSize: "13.5pt",
                  lineHeight: 1.45,
                  outline: "none",
                  cursor: "text",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Helpers CSS Toolbar
const toolBtnStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: "6px",
  border: "none",
  cursor: "pointer",
  backgroundColor: "transparent",
  color: "#cbd5e1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.15s ease",
};

const toolDividerStyle: React.CSSProperties = {
  width: "1px",
  height: "18px",
  backgroundColor: "rgba(255, 255, 255, 0.18)",
  margin: "0 3px",
};
