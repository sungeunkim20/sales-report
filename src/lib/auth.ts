import { SignJWT, jwtVerify } from "jose";

const ISSUER = "sales-report";
const AUDIENCE = "sales-report";
const EXPIRY = "8h";

export type JwtPayload = {
  userId: number;
  role: string;
  jti: string;
};

// 로그아웃된 토큰의 JTI를 저장하는 블랙리스트
// 프로덕션 환경에서는 Redis 또는 DB 테이블로 교체 필요
const revokedJtis = new Set<string>();

function getSecret(): Uint8Array {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET 환경 변수가 설정되지 않았습니다.");
  }
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

export async function signToken(
  userId: number,
  role: string
): Promise<string> {
  const jti = crypto.randomUUID();
  return new SignJWT({ userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    const jti = payload.jti;
    const userId = payload["userId"] as number | undefined;
    const role = payload["role"] as string | undefined;

    if (!jti || userId == null || !role || revokedJtis.has(jti)) {
      return null;
    }

    return { userId, role, jti };
  } catch {
    return null;
  }
}

export function revokeToken(jti: string): void {
  revokedJtis.add(jti);
}
