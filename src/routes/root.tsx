import { Outlet, createRootRoute, createRoute } from "@tanstack/react-router";

import { GlobeDemo } from "./demo";
import { AppHome } from "./index";

function RootLayout(): React.JSX.Element {
  return <Outlet />;
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  component: AppHome,
  getParentRoute: () => rootRoute,
  path: "/",
});

const demoRoute = createRoute({
  component: GlobeDemo,
  getParentRoute: () => rootRoute,
  path: "/demo",
});

export const routeTree = rootRoute.addChildren([indexRoute, demoRoute]);
