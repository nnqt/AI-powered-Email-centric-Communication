import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ContactService } from "@/modules/contacts/contact.service";

const service = new ContactService();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const { id } = await params;
    const contact = await service.getContactById(userId, id);
    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(contact);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch contact", details: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const { id } = await params;
    const body = await req.json();

    // Only allow known fields
    const allowedFields = [
      "name",
      "org",
      "language",
      "alternateEmails",
      "category",
      "categories",
      "categorySource",
      "categoryAiSuggestion",
    ];
    const fields: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in body) {
        fields[key] = body[key];
      }
    }

    const updated = await service.updateContact(userId, id, fields);
    if (!updated) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update contact", details: error.message },
      { status: 500 },
    );
  }
}
