import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ContactService } from "@/modules/contacts/contact.service";
import { ContactCategory } from "@/models/Contact";

const service = new ContactService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  try {
    const { contactId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const contact = await service.getContactById(userId, contactId);
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    return NextResponse.json(contact);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch contact", details: error.message },
      { status: 500 },
    );
  }
}

const VALID_CATEGORIES: ContactCategory[] = [
  "colleague",
  "customer",
  "spam",
  "other",
  "unknown",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  try {
    const { contactId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      org,
      language,
      alternateEmails,
      category,
      categories,
      categorySource,
      categoryAiSuggestion,
    } = body as {
      name?: string;
      org?: string;
      language?: string;
      alternateEmails?: string[];
      category?: ContactCategory;
      categories?: ContactCategory[];
      categorySource?: "rule" | "ai" | "user";
      categoryAiSuggestion?: ContactCategory | null;
    };

    const fields: Parameters<typeof service.updateContact>[2] = {};
    if (name !== undefined) fields.name = name;
    if (org !== undefined) fields.org = org;
    if (language !== undefined) fields.language = language;
    if (Array.isArray(alternateEmails))
      fields.alternateEmails = alternateEmails;
    if (category !== undefined && VALID_CATEGORIES.includes(category))
      fields.category = category;
    if (Array.isArray(categories))
      fields.categories = categories.filter((c) =>
        VALID_CATEGORIES.includes(c),
      );
    if (categorySource !== undefined) fields.categorySource = categorySource;
    if (categoryAiSuggestion === null)
      (fields as any).categoryAiSuggestion = undefined;
    else if (
      categoryAiSuggestion !== undefined &&
      VALID_CATEGORIES.includes(categoryAiSuggestion)
    )
      fields.categoryAiSuggestion = categoryAiSuggestion;

    const updated = await service.updateContact(userId, contactId, fields);

    if (!updated) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update contact", details: error.message },
      { status: 500 },
    );
  }
}
