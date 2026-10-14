import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom"
import { forwardRef } from "react"
import { cn } from "@/lib/utils"

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string
  activeClassName?: string
  pendingClassName?: string
}

/**
 * NavLink helper — wraps react-router-dom's NavLink with class-name composition.
 *
 * Usage:
 *   <NavLink to="/about" className="text-muted-foreground" activeClassName="text-foreground font-semibold">
 *     About
 *   </NavLink>
 *
 * Add `activeClassName` for the style applied when the route matches.
 */
const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => (
    <RouterNavLink
      ref={ref}
      to={to}
      className={({ isActive, isPending }) =>
        cn(className, isActive && activeClassName, isPending && pendingClassName)
      }
      {...props}
    />
  ),
)
NavLink.displayName = "NavLink"

export { NavLink }
