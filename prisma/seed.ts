import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL 환경 변수가 설정되지 않았습니다.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = "password123";

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  // 사용자 시드 (test-spec.md §1 기준) — email unique 제약으로 upsert 사용
  await prisma.user.upsert({
    where: { email: "sales1@test.com" },
    update: {},
    create: {
      name: "홍길동",
      email: "sales1@test.com",
      passwordHash,
      role: "SALES",
      department: "영업 1팀",
    },
  });

  await prisma.user.upsert({
    where: { email: "sales2@test.com" },
    update: {},
    create: {
      name: "이순신",
      email: "sales2@test.com",
      passwordHash,
      role: "SALES",
      department: "영업 2팀",
    },
  });

  await prisma.user.upsert({
    where: { email: "manager@test.com" },
    update: {},
    create: {
      name: "김팀장",
      email: "manager@test.com",
      passwordHash,
      role: "MANAGER",
      department: "영업 1팀",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@test.com" },
    update: {},
    create: {
      name: "박관리",
      email: "admin@test.com",
      passwordHash,
      role: "ADMIN",
      department: "관리팀",
    },
  });

  // 고객 샘플 데이터 — companyName에 unique 제약이 없으므로 findFirst 후 조건부 생성
  const customerSeeds = [
    {
      companyName: "㈜ABC",
      contactName: "이담당",
      phone: "010-1234-5678",
      address: "서울시 강남구 테헤란로 123",
    },
    {
      companyName: "㈜DEF",
      contactName: "박담당",
      phone: "010-2345-6789",
      address: "서울시 서초구 반포대로 456",
    },
    {
      companyName: "㈜GHI",
      contactName: "최담당",
      phone: "010-3456-7890",
      address: "서울시 마포구 홍익로 789",
    },
  ];

  for (const seed of customerSeeds) {
    const existing = await prisma.customer.findFirst({
      where: { companyName: seed.companyName },
    });
    if (!existing) {
      await prisma.customer.create({ data: seed });
    }
  }

  console.log("시드 데이터 생성 완료");
  console.log("계정 비밀번호:", DEFAULT_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
