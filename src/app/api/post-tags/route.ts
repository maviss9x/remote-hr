import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseJsonArray, stringifyJsonArray } from "@/lib/json-fields";

interface PostTagItem {
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
}

const DEFAULT_POST_TAGS: PostTagItem[] = [
  { id: "nap-the", name: "Nạp thẻ", color: "#3b82f6", isDefault: true },
  { id: "fastdate", name: "Fastdate", color: "#a855f7", isDefault: true },
  { id: "secret-chat", name: "Secret chat", color: "#ec4899", isDefault: true },
  { id: "other", name: "Các tính năng khác", color: "#10b981", isDefault: true },
];

export async function GET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "post_tags" },
    });

    if (!setting || !setting.value) {
      return NextResponse.json({ tags: DEFAULT_POST_TAGS });
    }

    const tags = parseJsonArray<PostTagItem>(setting.value);
    if (!tags || tags.length === 0) {
      return NextResponse.json({ tags: DEFAULT_POST_TAGS });
    }

    return NextResponse.json({ tags });
  } catch (error: any) {
    console.error("Lỗi khi tải danh sách tag bài viết:", error);
    return NextResponse.json({ tags: DEFAULT_POST_TAGS, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const isAuthorized = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.role);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Bạn không có quyền thay đổi cấu hình tag bài viết" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const rawTags = body.tags;

    if (!Array.isArray(rawTags)) {
      return NextResponse.json({ error: "Dữ liệu tags không hợp lệ (phải là danh sách)" }, { status: 400 });
    }

    // Validate và chuẩn hóa danh sách tag
    const sanitizedTags: PostTagItem[] = [];
    const seenIds = new Set<string>();

    for (const t of rawTags) {
      const name = String(t.name || "").trim();
      if (!name) continue;

      let id = String(t.id || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-");
      if (!id) {
        id = `tag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      }

      // Đảm bảo không trùng ID
      let finalId = id;
      let counter = 1;
      while (seenIds.has(finalId)) {
        finalId = `${id}-${counter++}`;
      }
      seenIds.add(finalId);

      const color = String(t.color || "#3b82f6").trim();

      sanitizedTags.push({
        id: finalId,
        name,
        color: color.startsWith("#") ? color : `#${color}`,
        isDefault: Boolean(t.isDefault),
      });
    }

    if (sanitizedTags.length === 0) {
      return NextResponse.json(
        { error: "Cần giữ lại ít nhất 1 tag bài viết trong hệ thống" },
        { status: 400 }
      );
    }

    await prisma.systemSetting.upsert({
      where: { key: "post_tags" },
      update: {
        value: stringifyJsonArray(sanitizedTags),
        updatedAt: new Date(),
      },
      create: {
        key: "post_tags",
        value: stringifyJsonArray(sanitizedTags),
        description: "Danh mục tag loại bài viết seeding",
      },
    });

    return NextResponse.json({
      message: "Cập nhật danh mục tag bài viết thành công!",
      tags: sanitizedTags,
    });
  } catch (error: any) {
    console.error("Lỗi khi lưu danh mục tag bài viết:", error);
    return NextResponse.json({ error: error.message || "Lỗi máy chủ" }, { status: 500 });
  }
}
