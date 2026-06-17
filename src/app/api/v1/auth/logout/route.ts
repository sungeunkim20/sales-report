import { type NextRequest } from "next/server";
import { verifyToken, revokeToken } from "@/lib/auth";
import { ok, apiError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return apiError("UNAUTHORIZED", "인증 토큰이 필요합니다.", 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);
  if (!payload) {
    return apiError("UNAUTHORIZED", "유효하지 않은 토큰입니다.", 401);
  }

  revokeToken(payload.jti);

  return ok({ message: "로그아웃 되었습니다." });
}
