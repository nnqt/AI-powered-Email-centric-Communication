import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db";
import {
  Contact,
  IContact,
  ContactCategory,
  CategorySource,
} from "@/models/Contact";
import { Thread, IThread } from "@/models/Thread";
import { User } from "@/models/User";

// Well-known spam / disposable domains to auto-classify as spam
const SPAM_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwam.com",
  "fakeinbox.com",
  "trashmail.com",
  "maildrop.cc",
  "sharklasers.com",
  "guerrillamailblock.com",
  "grr.la",
  "yopmail.com",
  "dispostable.com",
  "spamgourmet.com",
  "10minutemail.com",
  "minutemail.com",
  "spamgourmet.net",
  "spam4.me",
  "nospam.ze.tc",
  "spamfree24.org",
  "spamfree24.de",
]);

// Windows-1252 (CP1252) special code points in the 0x80-0x9F range that differ from Latin-1.
// These bytes map to printable Unicode chars in CP1252 but are C1 controls in Latin-1.
const CP1252_TO_CODEPOINT: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
};

/** Reverse map: Unicode code point → original CP1252 byte */
const CP1252_UNICODE_TO_BYTE = new Map<number, number>(
  Object.entries(CP1252_TO_CODEPOINT).map(([b, u]) => [u, Number(b)]),
);

/**
 * Try to reverse one layer of "UTF-8 bytes misread as Windows-1252/Latin-1" (Mojibake).
 * Safe: returns the original string unchanged if any character falls outside the
 * Latin-1 + CP1252-special range (i.e. the string is already proper Unicode).
 */
function decodeMojibake(str: string): string {
  const bytes: number[] = [];
  let hasNonAscii = false;
  for (const c of str) {
    const cp = c.charCodeAt(0);
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp <= 0xff) {
      bytes.push(cp);
      hasNonAscii = true;
    } else {
      const byte = CP1252_UNICODE_TO_BYTE.get(cp);
      if (byte !== undefined) {
        bytes.push(byte);
        hasNonAscii = true;
      } else {
        // Real Unicode character beyond Latin-1/CP1252 range → not Mojibake
        return str;
      }
    }
  }
  if (!hasNonAscii) return str; // Pure ASCII — no fix needed
  try {
    const decoded = Buffer.from(bytes).toString("utf8");
    if (!decoded.includes("\uFFFD") && decoded !== str) {
      return decoded;
    }
  } catch {
    /* empty */
  }
  return str;
}

/**
 * Decode RFC 2047 encoded-word sequences in email header values.
 * Handles  =?charset?B?base64?=  (Base64) and  =?charset?Q?...?=  (Quoted-Printable).
 * Adjacent encoded-words separated only by whitespace are concatenated per RFC 2047 §6.2.
 */
function decodeRfc2047(str: string): string {
  // Replace sequences of encoded-words (possibly separated by linear whitespace)
  const decoded = str.replace(
    /(=\?[^?]+\?[BbQq]\?[^?]*\?=)(\s+=\?[^?]+\?[BbQq]\?[^?]*\?=)*/g,
    (segment) =>
      segment.replace(
        /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
        (original, charset: string, encoding: string, text: string) => {
          try {
            let buf: Buffer;
            if (encoding.toUpperCase() === "B") {
              buf = Buffer.from(text, "base64");
            } else {
              // Q encoding: _ → space, =XX → byte
              const bytes = text
                .replace(/_/g, " ")
                .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
                  String.fromCharCode(parseInt(hex, 16)),
                );
              buf = Buffer.from(bytes, "binary");
            }
            const cs = charset.toLowerCase().replace(/[^a-z0-9]/g, "");
            const bufEncoding =
              cs === "utf8" || cs === "utf8" ? "utf-8" : "latin1";
            return buf.toString(bufEncoding as BufferEncoding);
          } catch {
            return original;
          }
        },
      ),
  );
  return decoded;
}

/**
 * Full email header decode: RFC 2047 first, then up to 2 passes of Mojibake fix.
 * Exported so gmail.service.ts can pre-process raw `From` / `To` header values
 * before storing them in Thread.participants and Message.from.
 */
export function decodeEmailHeader(raw: string): string {
  let out = decodeRfc2047(raw);
  // Vietnamese names can be double-Mojibake encoded (UTF-8 → Latin-1 → CP1252 → UTF-8 again)
  out = decodeMojibake(out);
  out = decodeMojibake(out);
  return out;
}

/**
 * Parse "Display Name <email@domain>" or "email@domain" → { email, name }
 * Decodes RFC 2047 encoded display names (e.g. Vietnamese, CJK characters).
 */
export function parseEmailAddress(raw: string): {
  email: string;
  name?: string;
} {
  const decoded = decodeEmailHeader(raw);
  const match = decoded.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^["']|["']$/g, ""),
      email: match[2].trim().toLowerCase(),
    };
  }
  return { email: decoded.trim().toLowerCase() };
}

/**
 * Rule-based contact classification.
 * Returns { category, source } — source is always "rule".
 */
export function classifyByRule(
  contactEmail: string,
  userEmailDomain?: string,
): { category: ContactCategory; source: CategorySource } {
  const domain = contactEmail.split("@")[1]?.toLowerCase();
  if (!domain) return { category: "unknown", source: "rule" };

  if (SPAM_DOMAINS.has(domain)) return { category: "spam", source: "rule" };
  if (userEmailDomain && domain === userEmailDomain.toLowerCase())
    return { category: "colleague", source: "rule" };

  return { category: "unknown", source: "rule" };
}

export interface ContactDTO {
  _id: string;
  email: string;
  name?: string;
  org?: string;
  language?: string;
  alternateEmails: string[];
  aiEnriched: boolean;
  enrichedAt?: string;
  mergedInto?: string;
  createdAt: string;
  updatedAt: string;
  category: ContactCategory;
  categories: ContactCategory[];
  categorySource: CategorySource;
  categoryAiSuggestion?: ContactCategory;
}

export interface ContactSnippetDTO {
  contact_id: string;
  email: string;
  name?: string;
  alternate_emails: string[];
  sample_threads: string[];
}

export interface PaginatedContactsResult {
  contacts: ContactDTO[];
  total: number;
  hasNext: boolean;
}

function toDTO(c: IContact): ContactDTO {
  const doc = c as any;
  return {
    _id: doc._id.toString(),
    email: c.email,
    name: c.name,
    org: c.org,
    language: c.language,
    alternateEmails: c.alternateEmails,
    aiEnriched: c.aiEnriched,
    enrichedAt: c.enrichedAt?.toISOString(),
    mergedInto: c.mergedInto?.toString(),
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
    category: c.category ?? "unknown",
    categories: (c as any).categories ?? [],
    categorySource: c.categorySource ?? "rule",
    categoryAiSuggestion: c.categoryAiSuggestion,
  };
}

export class ContactService {
  /**
   * Idempotent upsert: create or update contact by (userId, email).
   * Called automatically during email sync for each participant.
   */
  async upsertContact(
    userId: string,
    rawEmail: string,
    rawName?: string,
    userEmailDomain?: string,
  ): Promise<IContact> {
    await connectToDatabase();
    const { email, name } = parseEmailAddress(rawEmail);
    const displayName = rawName ?? name;

    const { category, source } = classifyByRule(email, userEmailDomain);

    const contact = await Contact.findOneAndUpdate(
      { email, userId: new mongoose.Types.ObjectId(userId) },
      {
        $setOnInsert: {
          email,
          userId: new mongoose.Types.ObjectId(userId),
          aiEnriched: false,
          alternateEmails: [],
          category,
          categorySource: source,
        },
        ...(displayName ? { $set: { name: displayName } } : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return contact;
  }

  /**
   * Batch upsert from a list of raw participant strings (e.g. from thread.participants).
   * Looks up user email once to enable same-domain colleague detection.
   */
  async upsertParticipants(
    userId: string,
    participants: string[],
  ): Promise<void> {
    await connectToDatabase();
    // Look up user email once for domain-based colleague detection
    const user = await User.findById(userId).lean();
    const userEmailDomain = user?.email?.split("@")[1];
    await Promise.all(
      participants.map((p) =>
        this.upsertContact(userId, p, undefined, userEmailDomain),
      ),
    );
  }

  async getContacts(
    userId: string,
    limit = 30,
    skip = 0,
  ): Promise<PaginatedContactsResult> {
    await connectToDatabase();
    const uid = new mongoose.Types.ObjectId(userId);

    // Exclude contacts that have been merged into another
    const query = { userId: uid, mergedInto: { $exists: false } };

    const [contacts, total] = await Promise.all([
      Contact.find(query)
        .sort({ name: 1, email: 1 })
        .skip(skip)
        .limit(limit)
        .lean<IContact[]>(),
      Contact.countDocuments(query),
    ]);

    return {
      contacts: contacts.map(toDTO),
      total,
      hasNext: skip + contacts.length < total,
    };
  }

  /**
   * Return contacts whose user-confirmed categories array is still empty
   * (not yet verified) and whose category was not set by the user manually.
   * Excludes spam (auto-detected) and merged contacts.
   */
  async getUnverifiedContacts(
    userId: string,
    limit = 200,
    skip = 0,
  ): Promise<PaginatedContactsResult> {
    await connectToDatabase();
    const uid = new mongoose.Types.ObjectId(userId);

    const query = {
      userId: uid,
      mergedInto: { $exists: false },
      categorySource: { $ne: "user" },
      $or: [{ categories: { $size: 0 } }, { categories: { $exists: false } }],
    };

    const [contacts, total] = await Promise.all([
      Contact.find(query)
        .sort({ name: 1, email: 1 })
        .skip(skip)
        .limit(limit)
        .lean<IContact[]>(),
      Contact.countDocuments(query),
    ]);

    return {
      contacts: contacts.map(toDTO),
      total,
      hasNext: skip + contacts.length < total,
    };
  }

  async getContactById(
    userId: string,
    contactId: string,
  ): Promise<ContactDTO | null> {
    await connectToDatabase();
    const contact = await Contact.findOne({
      _id: new mongoose.Types.ObjectId(contactId),
      userId: new mongoose.Types.ObjectId(userId),
    }).lean<IContact>();
    return contact ? toDTO(contact) : null;
  }

  /**
   * Get all threads where this contact (or any of their alternateEmails) is a participant.
   */
  async getContactTimeline(
    userId: string,
    contactId: string,
  ): Promise<IThread[]> {
    await connectToDatabase();
    const contact = await Contact.findOne({
      _id: new mongoose.Types.ObjectId(contactId),
      userId: new mongoose.Types.ObjectId(userId),
    }).lean<IContact>();

    if (!contact) return [];

    const emails = [contact.email, ...contact.alternateEmails];

    // Build per-email pattern that anchors to real email boundaries.
    // Participants are stored as either:
    //   "email@domain"  (plain)
    //   "Display Name <email@domain>"  (with display name)
    // Using (?:^|<) / (?:>|$) prevents substring matches like
    // "notjohn@x.com" accidentally matching contact "john@x.com".
    const emailPatterns = emails
      .map((e) => `(?:^|<)${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:>|$)`)
      .join("|");

    // Match threads where any participant contains one of the contact's emails
    const threads = await Thread.find({
      userId: new mongoose.Types.ObjectId(userId),
      participants: {
        $elemMatch: {
          $regex: emailPatterns,
          $options: "i",
        },
      },
    })
      .sort({ lastMessageDate: -1 })
      .lean<IThread[]>();

    return threads;
  }

  /**
   * Soft-merge sourceContact into targetContact.
   * Sets sourceContact.mergedInto = targetContactId and copies alternateEmails.
   */
  async mergeContacts(
    userId: string,
    sourceId: string,
    targetId: string,
  ): Promise<ContactDTO> {
    await connectToDatabase();
    const uid = new mongoose.Types.ObjectId(userId);

    const [source, target] = await Promise.all([
      Contact.findOne({
        _id: new mongoose.Types.ObjectId(sourceId),
        userId: uid,
      }),
      Contact.findOne({
        _id: new mongoose.Types.ObjectId(targetId),
        userId: uid,
      }),
    ]);

    if (!source || !target) {
      throw new Error("Contact not found");
    }

    // Add source email + its alternates into target's alternateEmails
    const newAlternates = Array.from(
      new Set([
        ...target.alternateEmails,
        source.email,
        ...source.alternateEmails,
      ]),
    ).filter((e) => e !== target.email);

    await Contact.findByIdAndUpdate(targetId, {
      alternateEmails: newAlternates,
    });

    // Mark source as merged
    await Contact.findByIdAndUpdate(sourceId, {
      mergedInto: new mongoose.Types.ObjectId(targetId),
    });

    const updated = await Contact.findById(targetId).lean<IContact>();
    return toDTO(updated!);
  }

  /**
   * Fetch contacts with bulk-resolved thread snippets for AI merge suggestions.
   * Uses 2 DB queries instead of N+1 (one for contacts, one for recent threads).
   * Capped at 100 contacts to align with AI service processing limit.
   */
  async getContactsForMergeSuggestions(
    userId: string,
  ): Promise<ContactSnippetDTO[]> {
    await connectToDatabase();
    const uid = new mongoose.Types.ObjectId(userId);

    const contacts = await Contact.find({
      userId: uid,
      mergedInto: { $exists: false },
    })
      .sort({ name: 1, email: 1 })
      .limit(100)
      .lean<IContact[]>();

    if (contacts.length < 2) return [];

    // Build a Set of all emails already claimed as alternateEmails by some contact.
    // Any contact whose primary email appears in this set is already linked to another
    // contact — no need to suggest merging them again.
    const claimedAltEmails = new Set<string>(
      contacts.flatMap((c) => c.alternateEmails.map((e) => e.toLowerCase())),
    );

    const candidates = contacts.filter(
      (c) => !claimedAltEmails.has(c.email.toLowerCase()),
    );

    if (candidates.length < 2) return [];

    // Single bulk query for recent threads — avoids N+1 per contact
    const recentThreads = (await Thread.find({ userId: uid })
      .sort({ lastMessageDate: -1 })
      .limit(300)
      .select("snippet participants subject")
      .lean()) as Array<{
      snippet?: string;
      participants?: string[];
      subject?: string;
    }>;

    return candidates.map((c) => {
      const allEmails = [c.email, ...c.alternateEmails].map((e) =>
        e.toLowerCase(),
      );
      const threadSnippets = recentThreads
        .filter((t) =>
          (t.participants ?? []).some((p) => {
            const pl = p.toLowerCase();
            // Exact match OR bounded by angle brackets (display-name format)
            return allEmails.some(
              (e) =>
                pl === e || pl.includes(`<${e}>`) || pl.startsWith(`${e}>`),
            );
          }),
        )
        .slice(0, 2)
        .map((t) => t.snippet || t.subject || "")
        .filter(Boolean);

      return {
        contact_id: (c as any)._id.toString(),
        email: c.email,
        name: c.name,
        alternate_emails: c.alternateEmails,
        sample_threads: threadSnippets,
      };
    });
  }

  /**
   * Update contact fields.
   */
  async updateContact(
    userId: string,
    contactId: string,
    fields: Partial<
      Pick<
        IContact,
        | "name"
        | "org"
        | "language"
        | "aiEnriched"
        | "enrichedAt"
        | "alternateEmails"
        | "category"
        | "categories"
        | "categorySource"
        | "categoryAiSuggestion"
      >
    >,
  ): Promise<ContactDTO | null> {
    await connectToDatabase();
    const updated = await Contact.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(contactId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { $set: fields },
      { new: true },
    ).lean<IContact>();
    return updated ? toDTO(updated) : null;
  }
}
