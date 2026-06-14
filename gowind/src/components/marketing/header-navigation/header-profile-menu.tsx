import { Link } from "react-router";
import { LogOut01, Settings01, User01 } from "@untitledui/icons";
import { Button as AriaButton, DialogTrigger as AriaDialogTrigger, Popover as AriaPopover } from "react-aria-components";
import { Avatar } from "@/components/base/avatar/avatar";
import { useAuth } from "@/providers/auth-provider";
import { cx } from "@/utils/cx";

const menuItemClass =
    "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-secondary outline-focus-ring hover:bg-primary_hover hover:text-secondary_hover focus-visible:outline-2 focus-visible:outline-offset-2";

export const HeaderProfileMenu = ({ size = "sm" }: { size?: "sm" | "md" }) => {
    const { user, isAdmin, logout } = useAuth();

    if (!user) return null;

    const initials = user.name
        ? user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
        : user.email?.slice(0, 2).toUpperCase();

    return (
        <AriaDialogTrigger>
            <AriaButton
                aria-label="Account menu"
                className={cx(
                    "flex cursor-pointer items-center justify-center rounded-full outline-focus-ring transition duration-100 ease-linear hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2",
                    size === "sm" && "p-0.5",
                    size === "md" && "p-1",
                )}
            >
                <Avatar
                    size={size === "sm" ? "sm" : "md"}
                    src={user.image}
                    initials={initials}
                    placeholderIcon={User01}
                />
            </AriaButton>
            <AriaPopover
                placement="bottom end"
                offset={8}
                className={({ isEntering, isExiting }) =>
                    cx(
                        "origin-top will-change-transform",
                        isEntering && "duration-150 ease-out animate-in fade-in slide-in-from-top-1",
                        isExiting && "duration-100 ease-in animate-out fade-out slide-out-to-top-1",
                    )
                }
            >
                <div className="min-w-48 rounded-xl border border-secondary bg-white py-1 shadow-lg dark:bg-primary">
                    <div className="border-b border-secondary px-3 py-2">
                        <p className="truncate text-sm font-semibold text-primary">{user.email}</p>
                        {user.name && <p className="truncate text-xs text-tertiary">{user.name}</p>}
                    </div>
                    <div className="py-1">
                        <Link
                            to="/account/settings"
                            className={menuItemClass}
                            onClick={() => (document.activeElement as HTMLElement)?.blur?.()}
                        >
                            <Settings01 className="size-5 text-fg-quaternary" />
                            Account settings
                        </Link>
                        {isAdmin && (
                            <Link
                                to="/admin"
                                className={menuItemClass}
                                onClick={() => (document.activeElement as HTMLElement)?.blur?.()}
                            >
                                Admin
                            </Link>
                        )}
                        <button
                            type="button"
                            className={cx(menuItemClass, "w-full border-0 bg-transparent text-left")}
                            onClick={() => logout()}
                        >
                            <LogOut01 className="size-5 text-fg-quaternary" />
                            Log out
                        </button>
                    </div>
                </div>
            </AriaPopover>
        </AriaDialogTrigger>
    );
};
