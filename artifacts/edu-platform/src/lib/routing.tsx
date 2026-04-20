import { Link as TanStackLink, useNavigate as useTSRNavigate, useParams as useTSRParams, useRouterState } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";

export type { LinkProps } from "@tanstack/react-router";

interface LinkProps extends Omit<ComponentProps<"a">, "href"> {
  href: string;
  children?: ReactNode;
  className?: string;
}

export function Link({ href, children, ...props }: LinkProps) {
  return (
    <TanStackLink to={href} {...(props as Record<string, unknown>)}>
      {children}
    </TanStackLink>
  );
}

export function useParams<T extends Record<string, string>>(): T {
  return useTSRParams({ strict: false }) as T;
}

export function useLocation(): [string, (path: string, opts?: { replace?: boolean }) => void] {
  const navigate = useTSRNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return [
    pathname,
    (path: string, opts?: { replace?: boolean }) => navigate({ to: path, replace: opts?.replace }),
  ];
}
