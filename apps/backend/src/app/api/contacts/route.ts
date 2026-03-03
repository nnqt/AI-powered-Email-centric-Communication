import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  ContactService,
  parseEmailAddress,
} from "@/modules/contacts/contact.service";

const service = new ContactService();

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "30", 10) || 30;
    const skip = parseInt(url.searchParams.get("skip") ?? "0", 10) || 0;

    const result = await service.getContacts(userId, limit, skip);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch contacts", details: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const body = await request.json();
    const { email, name } = body as { email?: string; name?: string };
    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const { email: parsedEmail } = parseEmailAddress(email);
    const contact = await service.upsertContact(userId, parsedEmail, name);
    return NextResponse.json(contact, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create contact", details: error.message },
      { status: 500 },
    );
  }
}
