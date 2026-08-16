"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import {
  Users,
  FileText,
  History,
  LayoutTemplate,
  Image as ImageIcon,
  Video,
  BookOpen,
  FolderOpen,
  Calendar,
  Bell,
  Award,
  UserCheck,
  Mail,
  MapPin,
  HelpCircle,
  LogOut,
  Home
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  {
    name: "About",
    items: [
      { name: "Leadership", href: "/about/leadership", icon: Users },
      { name: "Constitution", href: "/about/constitution", icon: FileText },
      { name: "History", href: "/about/history", icon: History },
    ],
  },
  {
    name: "Content",
    items: [
      { name: "Blog", href: "/content/blog", icon: LayoutTemplate },
      { name: "Gallery", href: "/content/gallery", icon: ImageIcon },
      { name: "Magazine", href: "/content/magazine", icon: BookOpen },
      { name: "Resources", href: "/content/resources", icon: FolderOpen },
    ],
  },
  {
    name: "Event",
    items: [
      { name: "Log", href: "/event/log", icon: Calendar },
      { name: "Notice", href: "/event/notice", icon: Bell },
    ],
  },
  {
    name: "Verification",
    items: [
      { name: "Certificate", href: "/verification/certificate", icon: Award },
      { name: "Membership", href: "/verification/membership", icon: UserCheck },
    ],
  },
  {
    name: "Contact",
    items: [
      { name: "Location", href: "/contact/location", icon: MapPin },
      { name: "FAQ", href: "/contact/faq", icon: HelpCircle },
    ],
  },
  {
    name: "Settings",
    items: [
      { name: "Footer", href: "/settings/footer", icon: LayoutTemplate },
    ]
  }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-[280px] flex-col bg-white text-slate-700 overflow-y-auto border-r border-slate-200 relative z-20 font-inter">
      <div className="p-6 shrink-0 pt-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-[#F59E0B] rounded-[14px] flex items-center justify-center font-bold text-xl text-white shadow-[0_10px_30px_rgba(245,158,11,0.25)]">C</div>
          <h1 className="font-montserrat font-bold text-2xl tracking-tight text-[#0F172A]">Club Admin</h1>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto pt-2 pb-4 px-4 scrollbar-hide">
        <nav className="flex-1 space-y-1">
          <Link
            href="/"
            className={`flex items-center gap-3 px-4 py-3 rounded-[16px] text-[15px] transition-all duration-300 ${
              pathname === "/" ? "bg-amber-50 text-amber-600 font-medium" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Home className="h-5 w-5 shrink-0" aria-hidden="true" />
            Dashboard
          </Link>

          {navigation.filter(item => item.items).map((section) => (
            <div key={section.name} className="space-y-1">
              <h3 className="px-4 text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-6 mb-3">
                {section.name}
              </h3>
              {section.items?.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-[16px] text-[15px] transition-all duration-300 ${
                      isActive
                        ? "bg-amber-50 text-amber-600 font-medium"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <item.icon
                      className={`h-5 w-5 shrink-0 transition-all duration-300 ${isActive ? 'scale-110' : ''}`}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      <div className="p-4 shrink-0 bg-slate-50 border-t border-slate-200">
        <button
          onClick={() => signOut(auth)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[15px] font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-[16px] transition-all"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
