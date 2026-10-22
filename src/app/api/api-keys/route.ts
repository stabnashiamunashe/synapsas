import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, parseBody, withAuth } from "@/lib/api";
import { hashApiKey } from "@/lib/auth";
import { limitsFor } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing";
import { audit } from "@/lib/notify";
import { hydrate } from "@/lib/json";

export const GET = withAuth(async (_req, { user }) => {
  const keys = await prisma.apiKey.findMany({ where: { orgId: user.orgId, revokedAt: null }, orderBy: { createdAt: "desc" } });
  return ok(keys.map((k) => ({ ...hydrate(k, ["scopes"]), keyHash: undefined })));
}, "ADMIN");

/** Creates a key. The raw key is returned ONCE; only its hash is stored. */
export const POST = withAuth(async (req, { user }) => {
  const { name } = await parseBody(req, z.object({ name: z.string().min(1).max(60) }));
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  if (!limitsFor(effectivePlan(org!)).apiAccess) throw badRequest("API access requires the Starter plan or higher");
  const prefix = `wf_${nanoid(6)}`;
  const raw = `${prefix}_${nanoid(32)}`;
  const key = await prisma.apiKey.create({
    data: { orgId: user.orgId, name, prefix, keyHash: hashApiKey(raw) },
  });
  await audit(user.orgId, user.id, "apikey.created", "ApiKey", key.id, { name });
  return ok({ id: key.id, name: key.name, prefix: key.prefix, createdAt: key.createdAt, key: raw }, { status: 201 });
}, "ADMIN");
