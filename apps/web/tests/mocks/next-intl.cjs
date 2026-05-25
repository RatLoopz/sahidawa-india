const React = require("react");

function createSimpleLink(props) {
  const { children, href = "/", ...rest } = props;
  return React.createElement("a", { href, ...rest }, children);
}

function useTranslations() {
  return (key) => key;
}

function useLocale() {
  return "en";
}

function NextIntlClientProvider({ children }) {
  return React.createElement(React.Fragment, null, children);
}

module.exports = {
  useTranslations,
  useLocale,
  NextIntlClientProvider,
};
