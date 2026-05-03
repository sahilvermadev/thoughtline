"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useWorkbench } from "@/lib/workbench-context";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/agents", label: "Agents" },
  { href: "/create", label: "Create" },
  { href: "/breed", label: "Breed" },
] as const;

export function TopNav() {
  const { genesis } = useWorkbench();
  const pathname = usePathname();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const shortAddress = genesis.address
    ? `${genesis.address.slice(0, 6)}...${genesis.address.slice(-4)}`
    : null;

  return (
    <nav className="topbar">
      <Link href="/" className="brand">
        <span className="brand-mark">
          <Image
            alt=""
            className="brand-mark-image"
            height={36}
            priority
            src="/logo.png"
            width={36}
          />
        </span>
        <span className="brand-wordmark">ThoughtLine</span>
      </Link>
      <div className="topbar-links">
        {NAV_LINKS.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={active ? "topbar-link active" : "topbar-link"}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
      {genesis.address ? (
        <div className="wallet-menu">
          <button
            aria-expanded={accountMenuOpen}
            aria-haspopup="menu"
            onClick={() => setAccountMenuOpen((open) => !open)}
            type="button"
          >
            {shortAddress}
          </button>
          {accountMenuOpen ? (
            <div className="wallet-popover" role="menu">
              <div>
                <span>Connected wallet</span>
                <code>{genesis.address}</code>
              </div>
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setAccountMenuOpen(false);
                  void genesis.disconnectWallet();
                }}
              >
                Disconnect
              </button>
              <p>To switch accounts, change the active account in your wallet.</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="wallet-menu">
          <button onClick={genesis.connectWallet} type="button">
            Connect wallet
          </button>
          {genesis.error ? (
            <p className="wallet-inline-error">{genesis.error}</p>
          ) : null}
        </div>
      )}
    </nav>
  );
}
