import { type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { ok, apiError } from "@/lib/api-response";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "유효하지 않은 요청 형식입니다.", 422);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "이메일과 비밀번호를 입력해주세요.",
      422
    );
  }

  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return apiError(
      "INVALID_CREDENTIALS",
      "이메일 또는 비밀번호가 올바르지 않습니다.",
      401
    );
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return apiError(
      "INVALID_CREDENTIALS",
      "이메일 또는 비밀번호가 올바르지 않습니다.",
      401
    );
  }

  const accessToken = await signToken(user.id, user.role);

  return ok({
    accessToken,
    user: {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    },
  });
}
