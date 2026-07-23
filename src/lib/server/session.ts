import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function getServerSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function getSessionFromRequest(request: NextRequest) {
  return auth.api.getSession({
    headers: request.headers,
  });
}

export async function requireSessionUserId(
  request?: NextRequest
): Promise<string> {
  const session = request
    ? await getSessionFromRequest(request)
    : await getServerSession();
  if (!session?.user?.id) {
    throw new SessionRequiredError();
  }
  return session.user.id;
}

export class SessionRequiredError extends Error {
  status = 401;
  constructor(message = "Authentication required") {
    super(message);
    this.name = "SessionRequiredError";
  }
}
