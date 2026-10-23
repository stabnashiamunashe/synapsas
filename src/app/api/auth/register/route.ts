import { prisma } from "@/lib/prisma";
import { hashPassword, issueSessionFor } from "@/lib/auth";
import { ApiError, badRequest, ok, parseBody, withPublic } from "@/lib/api";
import { registerSchema } from "@/lib/validators";
import { audit } from "@/lib/notify";
import { toJson } from "@/lib/json";
import { assertStrongPassword, clientInfo, rateLimit } from "@/lib/security";
import { trialDefaults } from "@/lib/billing";
import { emailVerificationRequired, startEmailVerification } from "@/lib/verification";

const RESERVED_SLUGS = new Set(["www", "app", "api", "admin", "platform", "login", "register", "mail", "static", "assets", "synapsas", "support", "billing", "status"]);

export const POST = withPublic(async (req) => {
  const rl = rateLimit(`register:${clientInfo(req).ip}`, 5, 60 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "Too many workspaces created from this network. Try again later.");
  const body = await parseBody(req, registerSchema);
  const problems = await assertStrongPassword(body.password, [body.name, body.email.split("@")[0], body.orgName]);
  if (problems.length) throw new ApiError(422, "Password is too weak", problems.map((p) => ({ path: "password", message: p })));
  if (RESERVED_SLUGS.has(body.slug)) throw badRequest("That workspace URL is reserved");
  const existing = await prisma.organization.findUnique({ where: { slug: body.slug } });
  if (existing) throw badRequest("That workspace URL is already taken");

  const org = await prisma.organization.create({
    data: {
      name: body.orgName,
      slug: body.slug,
      branding: toJson({ productName: body.orgName, primaryColor: "#003B32", sidebarTheme: "dark", borderRadius: 2 }),
      settings: toJson({ currency: "USD", requireCommentOnReject: true, allowSelfApproval: false }),
      billingEmail: body.email.toLowerCase(),
      ...trialDefaults(), // 14-day Business trial, then Free unless they subscribe
    },
  });
  const requireVerification = emailVerificationRequired();
  const user = await prisma.user.create({
    data: {
      orgId: org.id,
      email: body.email.toLowerCase(),
      name: body.name,
      passwordHash: await hashPassword(body.password),
      role: "OWNER",
      lastLoginAt: requireVerification ? null : new Date(),
      emailVerifiedAt: requireVerification ? null : new Date(),
    },
  });
  const ctx = clientInfo(req);
  await audit(org.id, user.id, "org.created", "Organization", org.id, { slug: org.slug }, ctx);

  if (requireVerification) {
    await startEmailVerification(user);
    return ok({ orgId: org.id, slug: org.slug, userId: user.id, verifyEmail: true });
  }
  await audit(org.id, user.id, "auth.login", "User", user.id, { via: "register" }, ctx);
  await issueSessionFor(user);
  return ok({ orgId: org.id, slug: org.slug, userId: user.id, verifyEmail: false });
});
