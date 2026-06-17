import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL 환경 변수가 설정되지 않았습니다. .env.example을 참고하세요."
  );
}

const adapter = new PrismaPg({ connectionString });

// Next.js HMR에서 모듈이 재실행될 때마다 새 연결이 생기지 않도록 전역 싱글톤 사용
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
