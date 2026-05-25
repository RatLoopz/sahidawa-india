const React = require("react");

function createNavigation(routing) {
  const currentPathname = "/";

  return {
    Link: ({ children, href = "/", ...props }) =>
      React.createElement("a", { href, ...props }, children),
    redirect: () => undefined,
    usePathname: () => currentPathname,
    useRouter: () => ({
      push: () => undefined,
      replace: () => undefined,
      back: () => undefined,
    }),
    getPathname: () => currentPathname,
  };
}

module.exports = {
  createNavigation,
};
