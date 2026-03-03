import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ContactService } from "@/modules/contacts/contact.service";
import { AIService } from "@/modules/ai/ai.service";

const contactService = new ContactService();
const aiService = new AIService();

// GET /api/contacts/merge-suggestions
// Fetches all non-merged contacts and asks the AI which ones should be merged.
export async function GET(_request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    // Fetch up to 200 contacts (non-merged) to send to AI
    const { contacts } = await contactService.getContacts(userId, 200, 0);

    if (contacts.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const snippets = contacts.map((c) => ({
      contact_id: c._id,
      email: c.email,
      name: c.name,
      alternate_emails: c.alternateEmails,
      sample_threads: [] as string[],
    }));

    const suggestions = await aiService.suggestMerges(snippets);

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error("[contacts/merge-suggestions] error:", error.message);
    return NextResponse.json(
      { error: "Merge suggestion failed", details: error.message },
      { status: 500 },
    );
  }
}
