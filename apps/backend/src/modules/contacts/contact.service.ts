import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { Contact, IContact } from "@/models/Contact";
import { Thread, IThread } from "@/models/Thread";

/**
 * Parse "Display Name <email@domain>" or "email@domain" → { email, name }
 */
export function parseEmailAddress(raw: string): {
  email: string;
  name?: string;
} {
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^["']|["']$/g, ""),
      email: match[2].trim().toLowerCase(),
    };
  }
  return { email: raw.trim().toLowerCase() };
}

export interface ContactDTO {
  _id: string;
  email: string;
  name?: string;
  org?: string;
  language?: string;
  alternateEmails: string[];
  aiEnriched: boolean;
  mergedInto?: string;
  createdAt: string;
  updatedAt: string;
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
    mergedInto: c.mergedInto?.toString(),
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
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
  ): Promise<IContact> {
    await connectToDatabase();
    const { email, name } = parseEmailAddress(rawEmail);
    const displayName = rawName ?? name;

    const contact = await Contact.findOneAndUpdate(
      { email, userId: new mongoose.Types.ObjectId(userId) },
      {
        $setOnInsert: {
          email,
          userId: new mongoose.Types.ObjectId(userId),
          aiEnriched: false,
          alternateEmails: [],
        },
        ...(displayName ? { $set: { name: displayName } } : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return contact;
  }

  /**
   * Batch upsert from a list of raw participant strings (e.g. from thread.participants).
   */
  async upsertParticipants(
    userId: string,
    participants: string[],
  ): Promise<void> {
    await Promise.all(participants.map((p) => this.upsertContact(userId, p)));
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

    // Match threads where any participant contains one of the contact's emails
    const threads = await Thread.find({
      userId: new mongoose.Types.ObjectId(userId),
      participants: {
        $elemMatch: {
          $regex: emails
            .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|"),
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
   * Update contact fields (name, org, language, aiEnriched).
   */
  async updateContact(
    userId: string,
    contactId: string,
    fields: Partial<Pick<IContact, "name" | "org" | "language" | "aiEnriched">>,
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
