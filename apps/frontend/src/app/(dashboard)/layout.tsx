"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/components/Toast";

interface SubNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  subItems?: SubNavItem[];
  /** Pathnames that also count as this section being "active" */
  activePaths?: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/inbox",
    label: "Email",
    activePaths: ["/threads", "/compose", "/inbox"],
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
      </svg>
    ),
    subItems: [
      {
        href: "/compose",
        label: "Compose",
        icon: (
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        ),
      },
      {
        href: "/inbox/sync",
        label: "Sync Emails",
        icon: (
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
    ],
  },
  {
    href: "/focus",
    label: "Focus",
    activePaths: ["/focus"],
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
        <path
          fillRule="evenodd"
          d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    href: "/chat",
    label: "Chat",
    activePaths: ["/chat"],
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    href: "/contacts",
    label: "Contacts",
    activePaths: ["/contacts"],
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
    ),
    subItems: [
      {
        href: "/contacts/new",
        label: "Add Contact",
        icon: (
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
      {
        href: "/contacts/duplicates",
        label: "Check Duplicates",
        icon: (
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
    ],
  },
  {
    href: "/settings",
    label: "Settings",
    activePaths: ["/settings"],
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
];

const DEV_NAV_ITEM: NavItem = {
  href: "/dev/sandbox",
  label: "Sandbox",
  activePaths: ["/dev/sandbox"],
  icon: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 2a1 1 0 01.707.293l6 6a1 1 0 010 1.414l-6 6A1 1 0 0110 16H4a2 2 0 01-2-2V8a2 2 0 012-2h6zM7 7a1 1 0 100 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h4a1 1 0 100-2H7z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardContent>{children}</DashboardContent>;
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const unreadCount = useUnreadCount();
  const { showToast, updateToast } = useToast();
  const navItems = useMemo(
    () =>
      process.env.NODE_ENV === "development"
        ? [...NAV_ITEMS, DEV_NAV_ITEM]
        : NAV_ITEMS,
    [],
  );

  const userId = (session?.user as any)?.id as string | undefined;
  // Map AI jobId → toastId so AI_JOB_DONE can update the right toast
  const aiJobToastMap = useRef<Record<string, string>>({});

  // Global AI job progress toasts (via Socket.IO)
  useSocket(userId, {
    AI_JOB_START: ({ jobId, label }: { jobId: string; label: string }) => {
      const toastId = showToast(label, "processing");
      aiJobToastMap.current[jobId] = toastId;
    },
    AI_JOB_DONE: ({
      jobId,
      label,
      success,
    }: {
      jobId: string;
      label: string;
      success: boolean;
    }) => {
      const toastId = aiJobToastMap.current[jobId];
      if (toastId) {
        updateToast(toastId, label, success ? "success" : "info");
        delete aiJobToastMap.current[jobId];
      }
    },
  });

  // Track which nav sections are expanded (by href)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(),
  );

  // Auto-expand section if current path matches it
  useEffect(() => {
    navItems.forEach((item) => {
      const paths = item.activePaths ?? [item.href];
      const inSection =
        paths.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
        item.subItems?.some(
          (s) => pathname === s.href || pathname.startsWith(s.href + "/"),
        );
      if (inSection) {
        setExpandedSections((prev) => new Set(prev).add(item.href));
      }
    });
  }, [pathname, navItems]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  const user = session?.user;
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w: string) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? "?");

  const toggleSection = (href: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  const isSectionActive = (item: NavItem) => {
    const paths = item.activePaths ?? [item.href];
    return (
      paths.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
      (item.subItems?.some(
        (s) => pathname === s.href || pathname.startsWith(s.href + "/"),
      ) ??
        false)
    );
  };

  return (
    <div className="dashboard-layout flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="sidebar fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r border-gray-200 bg-white">
        {/* Logo */}
        <div className="sidebar__logo flex h-14 items-center gap-2.5 border-b border-gray-100 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-900">EmailHub</span>
        </div>

        {/* Nav */}
        <nav className="sidebar__nav flex-1 overflow-y-auto px-2 py-3">
          <ul className="sidebar__nav-list space-y-0.5">
            {navItems.map((item) => {
              const sectionActive = isSectionActive(item);
              const isExpanded = expandedSections.has(item.href);
              const isMainActive = pathname === item.href;

              return (
                <li key={item.href} className="sidebar__nav-item">
                  {/* Parent row */}
                  <div className="flex items-center">
                    <Link
                      href={item.href}
                      className={`flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isMainActive
                          ? "bg-indigo-50 text-indigo-700"
                          : sectionActive
                            ? "text-indigo-600 hover:bg-indigo-50"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <span
                        className={
                          sectionActive ? "text-indigo-600" : "text-gray-400"
                        }
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {item.href === "/inbox" && unreadCount > 0 && (
                        <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </Link>
                    {/* Expand / collapse chevron */}
                    {item.subItems && item.subItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleSection(item.href)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        <svg
                          className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Sub-items */}
                  {item.subItems && isExpanded && (
                    <ul className="sidebar__sub-list mt-0.5 ml-3 space-y-0.5 border-l border-gray-100 pl-2">
                      {item.subItems.map((sub) => {
                        const subActive =
                          pathname === sub.href ||
                          pathname.startsWith(sub.href + "/");
                        return (
                          <li key={sub.href} className="sidebar__sub-item">
                            <Link
                              href={sub.href}
                              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                subActive
                                  ? "bg-indigo-50 text-indigo-700"
                                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                              }`}
                            >
                              <span
                                className={
                                  subActive
                                    ? "text-indigo-500"
                                    : "text-gray-400"
                                }
                              >
                                {sub.icon}
                              </span>
                              {sub.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="sidebar__user border-t border-gray-100 p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? ""}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-900">
                {user?.name ?? user?.email ?? ""}
              </p>
              {user?.name && (
                <p className="truncate text-xs text-gray-400">{user?.email}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
                clipRule="evenodd"
              />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="dashboard-layout__content ml-56 flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
