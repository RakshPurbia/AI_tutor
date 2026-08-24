import Link from "next/link";
import { useRouter } from "next/router";

const LINKS = [
  { href: "/teacher/dashboard", label: "Dashboard" },
  { href: "/teacher/upload", label: "Upload Content" },
  { href: "/teacher/quiz-create", label: "Quizzes" },
];

export default function TeacherNav({ children }) {
  const router = useRouter();

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="sidebar-layout">
        <div className="sidebar">
          <div className="sidebar-label" style={{ fontWeight: 700, color: "var(--purple-dark)" }}>
            MENU
          </div>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={router.pathname === l.href ? "active" : ""}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="main-content">{children}</div>
      </div>
    </div>
  );
}
