import { z } from "zod";
import { ok, parseBody, withAuth } from "@/lib/api";
import { findPotentialDuplicates } from "@/lib/cases";

const schema = z.object({ categoryId: z.string().optional().nullable(), departmentId: z.string().optional().nullable(), locationAddress: z.string().max(500).optional().nullable(), title: z.string().max(255).optional().nullable(), latitude: z.number().optional().nullable(), longitude: z.number().optional().nullable() });

/** Advisory duplicate preview for the staff intake form. */
export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, schema);
  return ok(await findPotentialDuplicates(user.orgId, body));
});
