import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { POST as loginPOST } from "@/app/api/v1/auth/login/route";
import { POST as logoutPOST } from "@/app/api/v1/auth/logout/route";
import { middleware } from "@/middleware";
import { signToken } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

const TEST_PASSWORD = "correct-password-123";
const BASE_URL = "http://localhost";

const mockUserBase = {
  id: 1,
  name: "홍길동",
  email: "sales1@test.com",
  role: "SALES" as const,
  department: "영업 1팀",
  createdAt: new Date("2024-01-01T00:00:00Z"),
};

let testUser: typeof mockUserBase & { passwordHash: string };

beforeAll(async () => {
  testUser = {
    ...mockUserBase,
    passwordHash: await hashPassword(TEST_PASSWORD),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function makeLoginRequest(body: object): NextRequest {
  return new NextRequest(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeApiRequest(path: string, token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new NextRequest(`${BASE_URL}${path}`, { headers });
}

describe("TC-AUTH-001: 로그인 성공", () => {
  it("유효한 이메일·비밀번호로 로그인하면 accessToken과 사용자 정보를 반환한다", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(testUser as any);

    const res = await loginPOST(
      makeLoginRequest({ email: "sales1@test.com", password: TEST_PASSWORD })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.data.accessToken).toBe("string");
    expect(body.data.user.userId).toBe(1);
    expect(body.data.user.name).toBe("홍길동");
    expect(body.data.user.email).toBe("sales1@test.com");
    expect(body.data.user.role).toBe("SALES");
    expect(body.data.user.passwordHash).toBeUndefined();
  });
});

describe("TC-AUTH-002: 로그인 실패 — 비밀번호 불일치", () => {
  it("등록된 이메일과 틀린 비밀번호로 로그인하면 401 INVALID_CREDENTIALS를 반환한다", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(testUser as any);

    const res = await loginPOST(
      makeLoginRequest({ email: "sales1@test.com", password: "wrong-password" })
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("TC-AUTH-003: 로그인 실패 — 존재하지 않는 이메일", () => {
  it("미등록 이메일로 로그인하면 401 INVALID_CREDENTIALS를 반환한다", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);

    const res = await loginPOST(
      makeLoginRequest({ email: "nobody@test.com", password: "any-password" })
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("TC-AUTH-004: 토큰 없이 보호된 API 호출", () => {
  it("Authorization 헤더 없이 API를 호출하면 401 UNAUTHORIZED를 반환한다", async () => {
    const res = await middleware(makeApiRequest("/api/v1/reports"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("TC-AUTH-005: 만료된 토큰으로 API 호출", () => {
  it("만료된 accessToken을 사용하면 401 UNAUTHORIZED를 반환한다", async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const expiredToken = await new SignJWT({ userId: 1, role: "SALES" })
      .setProtectedHeader({ alg: "HS256" })
      .setJti("expired-jti-for-test")
      .setIssuer("sales-report")
      .setAudience("sales-report")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(secret);

    const res = await middleware(makeApiRequest("/api/v1/reports", expiredToken));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("TC-AUTH-006: 로그아웃 후 토큰 재사용", () => {
  it("유효한 토큰으로 로그아웃 후 해당 토큰을 재사용하면 401을 반환한다", async () => {
    const token = await signToken(1, "SALES");

    // 1) 로그아웃
    const logoutRes = await logoutPOST(
      new NextRequest(`${BASE_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(logoutRes.status).toBe(200);
    const logoutBody = await logoutRes.json();
    expect(logoutBody.data.message).toBe("로그아웃 되었습니다.");

    // 2) 로그아웃된 토큰으로 재접근 → 미들웨어에서 401
    const reuseRes = await middleware(makeApiRequest("/api/v1/reports", token));
    const reuseBody = await reuseRes.json();

    expect(reuseRes.status).toBe(401);
    expect(reuseBody.error.code).toBe("UNAUTHORIZED");
  });
});
