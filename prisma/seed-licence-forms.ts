/**
 * Apply the paper-form definitions in licence-forms.ts to an existing database (idempotent):
 * sets the application form, office-use section, kinds and notes on the matching licence types and creates the
 * types the forms introduce (registration of premises, general application) if they do not exist.
 *
 *   npx tsx prisma/seed-licence-forms.ts
 *   docker compose --profile seed run --rm seed npx tsx prisma/seed-licence-forms.ts
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { EXTRA_TYPES, LICENCE_FORMS } from "./licence-forms";

const prisma = new PrismaClient();

export async function applyLicenceForms(orgId: string) {
  const depts = await prisma.department.findMany({ where: { orgId }, select: { id: true, code: true } });
  const dept = (code: string) => depts.find((d) => d.code === code)?.id || null;
  for (const t of EXTRA_TYPES) {
    const exists = await prisma.licenceType.findUnique({ where: { orgId_code: { orgId, code: t.code } } });
    if (!exists) await prisma.licenceType.create({ data: { orgId, code: t.code, name: t.name, category: t.category, fee: t.fee, currency: "USD", validityMonths: t.validityMonths, requiresInspection: t.requiresInspection, departmentId: dept(t.deptCode), requirements: t.requirements, description: t.description } });
  }
  let applied = 0;
  for (const [code, f] of Object.entries(LICENCE_FORMS)) {
    const t = await prisma.licenceType.findUnique({ where: { orgId_code: { orgId, code } } });
    if (!t) continue;
    await prisma.licenceType.update({ where: { id: t.id }, data: { formTitle: f.formTitle, legalBasis: f.legalBasis || null, instructions: f.instructions || null, kinds: f.kinds, fields: f.fields as unknown as Prisma.InputJsonValue, officeFields: f.officeFields as unknown as Prisma.InputJsonValue } });
    applied++;
  }
  return applied;
}

if (require.main === module) {
  (async () => {
    const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
    if (!org) throw new Error("No organisation found. Run the main seed first.");
    const n = await applyLicenceForms(org.id);
    console.log(`Applied ${n} licence forms to ${org.name}.`);
  })().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
}
