import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, ok, parseBody, withPublic } from "@/lib/api";
import { clientInfo, constantTimeEqual, rateLimit } from "@/lib/security";
import { licenceUploadToken, notifyApplicant, paymentState, recordLicencePayment } from "@/lib/licensing";
import { PAYMENT_METHODS } from "@/lib/licenceTypes";

const schema = z.object({
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().min(3).max(80),
  amount: z.number().min(0.01),
  paidAt: z.string().optional().nullable(),
  payerName: z.string().max(160).optional().nullable(),
});

/**
 * An applicant reports that the fee has been paid (EcoCash, bank transfer, cashier receipt). The payment is recorded as
 * awaiting confirmation; Finance matches it against the cashbook and confirms, which lets the licence be issued.
 * Needs the tracking/upload token so only the applicant can do this.
 */
export const POST = withPublic(async (req, { params }) => {
  const ctx = clientInfo(req);
  const rl = rateLimit(`public-licence-pay:${ctx.ip}`, 20, 60 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "Too many submissions. Try again later.");
  const ref = decodeURIComponent(params.ref || "").trim().toUpperCase();
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const l = org ? await prisma.licence.findFirst({ where: { orgId: org.id, referenceNo: ref }, include: { type: { select: { name: true, departmentId: true } }, payments: { select: { amount: true, status: true } } } }) : null;
  if (!l) throw new ApiError(404, "No application found with that reference");
  const token = req.headers.get("x-upload-token") || "";
  if (!token || !constantTimeEqual(token, licenceUploadToken(l.id, l.createdAt))) throw new ApiError(403, "Not allowed");
  if (l.status !== "APPROVED") throw new ApiError(400, "Payment details can be submitted once the application has been approved");
  if (paymentState(l).settled) throw new ApiError(400, "The fee for this application has already been confirmed");
  const body = await parseBody(req, schema);
  const p = await recordLicencePayment(l, { amount: body.amount, method: body.method, reference: body.reference, payerName: body.payerName || l.applicantName, paidAt: body.paidAt ? new Date(body.paidAt) : new Date() }, { id: null, name: l.applicantName });
  void notifyApplicant(l, "payment_received");
  return ok({ id: p.id, status: p.status }, { status: 201 });
});
